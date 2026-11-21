from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Business, FeaturedPaymentStatus, FeaturedRequest, User

STRIPE_API_URL = "https://api.stripe.com/v1"


def stripe_configured() -> bool:
    return bool(
        settings.stripe_secret_key
        and settings.stripe_price_id
        and settings.stripe_webhook_secret
    )


def stripe_featured_configured() -> bool:
    return bool(
        settings.stripe_secret_key
        and settings.stripe_featured_price_id
        and settings.stripe_webhook_secret
    )


def _flatten_params(data: dict[str, Any], prefix: str | None = None) -> list[tuple[str, str]]:
    params: list[tuple[str, str]] = []
    for key, value in data.items():
        name = f"{prefix}[{key}]" if prefix else key
        if value is None:
            continue
        if isinstance(value, dict):
            params.extend(_flatten_params(value, name))
        elif isinstance(value, (list, tuple)):
            for index, item in enumerate(value):
                if isinstance(item, dict):
                    params.extend(_flatten_params(item, f"{name}[{index}]"))
                else:
                    params.append((f"{name}[{index}]", str(item)))
        elif isinstance(value, bool):
            params.append((name, "true" if value else "false"))
        else:
            params.append((name, str(value)))
    return params


def stripe_request(method: str, path: str, data: dict[str, Any] | None = None) -> dict:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured",
        )
    url = f"{STRIPE_API_URL}/{path.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {settings.stripe_secret_key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    params = _flatten_params(data or {})
    try:
        if method.upper() == "GET":
            response = httpx.get(url, headers=headers, params=params, timeout=20)
        else:
            response = httpx.request(
                method.upper(),
                url,
                headers=headers,
                content=urlencode(params),
                timeout=20,
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe request failed",
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe returned an invalid response",
        )
    return payload


def ensure_stripe_customer(db: Session, user: User) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe_request(
        "POST",
        "customers",
        {
            "email": user.email,
            "name": user.full_name,
            "metadata": {"user_id": str(user.id)},
        },
    )
    customer_id = str(customer.get("id") or "").strip()
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a customer",
        )
    user.stripe_customer_id = customer_id
    db.add(user)
    db.commit()
    db.refresh(user)
    return customer_id


def verify_stripe_signature(payload: bytes, signature_header: str | None) -> dict:
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhooks are not configured",
        )
    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature",
        )

    timestamp: str | None = None
    signatures: list[str] = []
    for part in signature_header.split(","):
        key, _, value = part.partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1":
            signatures.append(value)
    if not timestamp or not signatures:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        )
    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        ) from exc
    if abs(time.time() - timestamp_value) > 300:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expired Stripe signature",
        )

    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(
        settings.stripe_webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        )
    try:
        event = json.loads(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe payload",
        ) from exc
    if not isinstance(event, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe payload",
        )
    return event


def _business_id_from_metadata(metadata: object) -> int | None:
    if not isinstance(metadata, dict):
        return None
    value = metadata.get("business_id")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _featured_request_id_from_session(session: dict) -> int | None:
    metadata = session.get("metadata")
    value = metadata.get("featured_request_id") if isinstance(metadata, dict) else None
    if value is None:
        reference = str(session.get("client_reference_id") or "")
        if reference.startswith("featured:"):
            value = reference.split(":", 1)[1]
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _sync_featured_checkout(db: Session, session: dict) -> None:
    request_id = _featured_request_id_from_session(session)
    if request_id is None:
        return
    featured_request = db.get(FeaturedRequest, request_id)
    if featured_request is None:
        return
    session_id = str(session.get("id") or "").strip()
    if session_id:
        featured_request.stripe_session_id = session_id[:255]
    featured_request.payment_status = FeaturedPaymentStatus.paid
    payment_intent = str(session.get("payment_intent") or "").strip()
    if payment_intent and not featured_request.payment_reference:
        featured_request.payment_reference = payment_intent[:255]
    db.add(featured_request)
    db.commit()


def _subscription_period_end(subscription: dict) -> datetime | None:
    value = subscription.get("current_period_end")
    if not value:
        items = subscription.get("items")
        if isinstance(items, dict):
            data = items.get("data")
            if isinstance(data, list) and data and isinstance(data[0], dict):
                value = data[0].get("current_period_end")
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc) if value else None
    except (TypeError, ValueError, OSError):
        return None


def _subscription_price_id(subscription: dict) -> str | None:
    items = subscription.get("items")
    if not isinstance(items, dict):
        return None
    data = items.get("data")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        return None
    price = data[0].get("price")
    if not isinstance(price, dict):
        return None
    value = price.get("id")
    return str(value)[:255] if value else None


def _subscription_customer_id(subscription: dict) -> str | None:
    customer = subscription.get("customer")
    if isinstance(customer, dict):
        customer = customer.get("id")
    value = str(customer or "").strip()
    return value[:255] or None


def _find_business(
    db: Session,
    subscription: dict,
    metadata: object = None,
) -> Business | None:
    business_id = _business_id_from_metadata(metadata or subscription.get("metadata"))
    if business_id is not None:
        business = db.get(Business, business_id)
        if business is not None:
            return business
    subscription_id = str(subscription.get("id") or "").strip()
    if subscription_id:
        return db.scalar(
            select(Business).where(Business.stripe_subscription_id == subscription_id)
        )
    return None


def sync_subscription(db: Session, subscription: dict) -> Business | None:
    business = _find_business(db, subscription)
    if business is None:
        return None

    subscription_id = str(subscription.get("id") or "").strip()
    status_value = str(subscription.get("status") or "").strip()[:32] or None
    customer_id = _subscription_customer_id(subscription)

    if subscription_id:
        business.stripe_subscription_id = subscription_id[:255]
    business.subscription_status = status_value
    business.stripe_price_id = _subscription_price_id(subscription)
    business.subscription_current_period_end = _subscription_period_end(subscription)
    if customer_id and business.owner is not None and not business.owner.stripe_customer_id:
        business.owner.stripe_customer_id = customer_id
    db.add(business)
    db.commit()
    db.refresh(business)
    return business


def handle_stripe_event(db: Session, event: dict) -> None:
    event_type = str(event.get("type") or "")
    data = event.get("data")
    obj = data.get("object") if isinstance(data, dict) else None
    if not isinstance(obj, dict):
        return

    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        sync_subscription(db, obj)
        return

    if event_type in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    }:
        if _featured_request_id_from_session(obj) is not None:
            _sync_featured_checkout(db, obj)
            return

    if event_type != "checkout.session.completed":
        return

    metadata = obj.get("metadata")
    business_id = _business_id_from_metadata(metadata)
    if business_id is None:
        reference = str(obj.get("client_reference_id") or "")
        if reference.startswith("business:"):
            try:
                business_id = int(reference.split(":", 1)[1])
            except ValueError:
                business_id = None
    business = db.get(Business, business_id) if business_id is not None else None
    if business is None:
        return

    customer_id = str(obj.get("customer") or "").strip()
    if customer_id and business.owner is not None and not business.owner.stripe_customer_id:
        business.owner.stripe_customer_id = customer_id[:255]
    subscription_id = str(obj.get("subscription") or "").strip()
    if subscription_id and not business.stripe_subscription_id:
        business.stripe_subscription_id = subscription_id[:255]
    db.add(business)
    db.commit()

    if subscription_id and settings.stripe_secret_key:
        try:
            subscription = stripe_request("GET", f"subscriptions/{subscription_id}")
        except HTTPException:
            return
        sync_subscription(db, subscription)
