import hashlib
import hmac
import json
import time
from datetime import timedelta

from app.config import settings
from app.database import SessionLocal
from app.models import Business, utcnow


def login(client, email, password):
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def register(client, email, full_name):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_directory_flow(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    assert categories, "seed categories should be available"
    assert cities, "seed cities should be available"
    category_id = categories[0]["id"]
    city_id = cities[0]["id"]

    owner = register(client, "owner@example.com", "Owner One")
    register(client, "reviewer@example.com", "Reviewer Two")

    owner_headers = login(client, "owner@example.com", "password123")
    reviewer_headers = login(client, "reviewer@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Cebu Lechon House",
            "description": "Famous roasted lechon",
            "address": "123 Colon Street",
            "phone": "032-555-0100",
            "category_id": category_id,
            "city_id": city_id,
        },
    )
    assert created.status_code == 201, created.text
    business = created.json()
    assert business["status"] == "pending"
    assert business["is_claimed"] is True

    unapproved = client.get(f"/api/businesses/{business['id']}")
    assert unapproved.status_code == 404

    approved = client.post(
        f"/api/admin/businesses/{business['id']}/approve",
        headers=admin_headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"

    billing = client.get(
        f"/api/billing/businesses/{business['id']}", headers=owner_headers
    )
    assert billing.status_code == 200, billing.text
    assert billing.json()["is_paid"] is False
    assert billing.json()["stripe_enabled"] is False
    assert (
        client.get(
            f"/api/billing/businesses/{business['id']}", headers=reviewer_headers
        ).status_code
        == 403
    )
    checkout = client.post(
        f"/api/billing/businesses/{business['id']}/checkout", headers=owner_headers
    )
    assert checkout.status_code == 503

    unpaid_article = client.post(
        f"/api/businesses/{business['id']}/articles",
        headers=owner_headers,
        json={
            "title": "Unpaid article",
            "body": "This should not be created for an unpaid listing.",
            "article_type": "product_update",
        },
    )
    assert unpaid_article.status_code == 402

    with SessionLocal() as db:
        paid_business = db.get(Business, business["id"])
        paid_business.subscription_status = "active"
        paid_business.stripe_subscription_id = "sub_test_business"
        db.add(paid_business)
        db.commit()

    paid_billing = client.get(
        f"/api/billing/businesses/{business['id']}", headers=owner_headers
    )
    assert paid_billing.status_code == 200
    assert paid_billing.json()["is_paid"] is True

    article = client.post(
        f"/api/businesses/{business['id']}/articles",
        headers=owner_headers,
        json={
            "title": "New Lechon Platter",
            "summary": "A new sharing platter is now available.",
            "body": "Try our new family-sized lechon platter every weekend.",
            "article_type": "product_update",
        },
    )
    assert article.status_code == 201, article.text
    article_id = article.json()["id"]
    article_slug = article.json()["slug"]
    assert article.json()["author"]["id"] == owner["id"]

    public_articles = client.get(f"/api/articles?business_id={business['id']}")
    assert public_articles.status_code == 200
    assert public_articles.json()["total"] == 1
    assert public_articles.json()["items"][0]["id"] == article_id
    article_detail = client.get(f"/api/articles/{article_slug}")
    assert article_detail.status_code == 200
    assert article_detail.json()["business"]["id"] == business["id"]

    forbidden_article = client.post(
        f"/api/businesses/{business['id']}/articles",
        headers=reviewer_headers,
        json={
            "title": "Not the owner",
            "body": "This user does not own the listing yet.",
            "article_type": "other",
        },
    )
    assert forbidden_article.status_code == 403

    event_without_date = client.post(
        f"/api/businesses/{business['id']}/articles",
        headers=owner_headers,
        json={
            "title": "Weekend event",
            "body": "Join us for a weekend tasting event.",
            "article_type": "event",
        },
    )
    assert event_without_date.status_code == 400

    event_article = client.post(
        f"/api/businesses/{business['id']}/articles",
        headers=owner_headers,
        json={
            "title": "Weekend tasting event",
            "body": "Join us for a weekend tasting event.",
            "article_type": "event",
            "event_starts_at": "2026-12-12T10:00:00Z",
            "event_ends_at": "2026-12-12T14:00:00Z",
        },
    )
    assert event_article.status_code == 201, event_article.text
    event_id = event_article.json()["id"]

    updated_article = client.patch(
        f"/api/articles/{article_id}",
        headers=owner_headers,
        json={"title": "New Lechon Platter and Rice"},
    )
    assert updated_article.status_code == 200, updated_article.text
    assert updated_article.json()["slug"] != article_slug

    deleted_event = client.delete(
        f"/api/articles/{event_id}", headers=owner_headers
    )
    assert deleted_event.status_code == 204

    filtered = client.get(
        f"/api/businesses?city_id={city_id}&category_id={category_id}&search=Lechon"
    )
    assert filtered.status_code == 200
    listing = filtered.json()
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == business["id"]
    assert listing["items"][0]["city"]["id"] == city_id

    review = client.post(
        f"/api/businesses/{business['id']}/reviews",
        headers=reviewer_headers,
        json={"rating": 5, "comment": "Best lechon in town"},
    )
    assert review.status_code == 201, review.text
    review_id = review.json()["id"]

    duplicate_review = client.post(
        f"/api/businesses/{business['id']}/reviews",
        headers=reviewer_headers,
        json={"rating": 4, "comment": "Second review"},
    )
    assert duplicate_review.status_code == 409

    anonymous_review = client.post(
        f"/api/businesses/{business['id']}/reviews",
        json={"rating": 4, "comment": "No token"},
    )
    assert anonymous_review.status_code == 401

    detail = client.get(f"/api/businesses/{business['id']}").json()
    assert detail["review_count"] == 1
    assert detail["average_rating"] == 5.0

    claim = client.post(
        "/api/claims",
        headers=reviewer_headers,
        json={"business_id": business["id"], "message": "I manage this branch"},
    )
    assert claim.status_code == 201, claim.text
    claim_id = claim.json()["id"]

    duplicate_claim = client.post(
        "/api/claims",
        headers=reviewer_headers,
        json={"business_id": business["id"]},
    )
    assert duplicate_claim.status_code == 409

    pending_claims = client.get("/api/admin/claims?status=pending", headers=admin_headers)
    assert pending_claims.status_code == 200
    assert any(item["id"] == claim_id for item in pending_claims.json())

    forbidden_approval = client.post(
        f"/api/admin/claims/{claim_id}/approve",
        headers=reviewer_headers,
        json={},
    )
    assert forbidden_approval.status_code == 403

    approved_claim = client.post(
        f"/api/admin/claims/{claim_id}/approve",
        headers=admin_headers,
        json={"admin_notes": "Verified ownership documents"},
    )
    assert approved_claim.status_code == 200, approved_claim.text
    assert approved_claim.json()["status"] == "approved"

    old_owner_update = client.patch(
        f"/api/businesses/{business['id']}",
        headers=owner_headers,
        json={"phone": "0999-000-0000"},
    )
    assert old_owner_update.status_code == 403

    new_owner_update = client.patch(
        f"/api/businesses/{business['id']}",
        headers=reviewer_headers,
        json={"phone": "0917-000-0000"},
    )
    assert new_owner_update.status_code == 200, new_owner_update.text
    assert new_owner_update.json()["phone"] == "0917-000-0000"

    mine = client.get("/api/businesses/mine", headers=reviewer_headers)
    assert mine.status_code == 200
    assert any(item["id"] == business["id"] for item in mine.json())

    stats = client.get("/api/admin/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json()["businesses"] >= 1
    assert stats.json()["reviews"] >= 1

    reviewer_profile = client.get("/api/auth/me", headers=reviewer_headers).json()
    assert reviewer_profile["role"] == "owner"

    supervisor = register(client, "supervisor@example.com", "Supervisor One")
    promoted = client.patch(
        f"/api/admin/users/{supervisor['id']}/role",
        headers=admin_headers,
        json={"role": "supervisor"},
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["role"] == "supervisor"
    supervisor_headers = login(client, "supervisor@example.com", "password123")

    supervisor_stats = client.get("/api/admin/stats", headers=supervisor_headers)
    assert supervisor_stats.status_code == 200
    assert client.get("/api/admin/businesses", headers=supervisor_headers).status_code == 200
    assert client.get("/api/admin/claims", headers=supervisor_headers).status_code == 403
    assert client.get("/api/admin/users", headers=supervisor_headers).status_code == 403

    admin_reviews = client.get("/api/admin/reviews", headers=supervisor_headers)
    assert admin_reviews.status_code == 200, admin_reviews.text
    assert any(item["id"] == review_id for item in admin_reviews.json())
    search_reviews = client.get(
        "/api/admin/reviews?search=lechon", headers=supervisor_headers
    )
    assert search_reviews.status_code == 200, search_reviews.text
    assert any(item["id"] == review_id for item in search_reviews.json())

    second = client.post(
        "/api/businesses",
        headers=reviewer_headers,
        json={
            "name": "Supervisor Pending Cafe",
            "description": "Pending review",
            "category_id": category_id,
            "city_id": city_id,
        },
    )
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]
    assert second.json()["status"] == "pending"
    assert (
        client.get(f"/api/businesses/{second_id}", headers=supervisor_headers).status_code
        == 200
    )

    supervisor_approval = client.post(
        f"/api/admin/businesses/{second_id}/approve",
        headers=supervisor_headers,
    )
    assert supervisor_approval.status_code == 200, supervisor_approval.text
    assert supervisor_approval.json()["status"] == "approved"

    supervisor_create = client.post(
        "/api/admin/businesses",
        headers=supervisor_headers,
        json={"name": "Not Allowed", "category_id": category_id, "city_id": city_id},
    )
    assert supervisor_create.status_code == 403

    removed_review = client.delete(f"/api/reviews/{review_id}", headers=supervisor_headers)
    assert removed_review.status_code == 204
    assert client.get(f"/api/businesses/{business['id']}").json()["review_count"] == 0

    deleted = client.delete(f"/api/businesses/{business['id']}", headers=reviewer_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/businesses/{business['id']}").status_code == 404
    assert client.get(f"/api/articles/{article_slug}").status_code == 404
    second_deleted = client.delete(f"/api/businesses/{second_id}", headers=reviewer_headers)
    assert second_deleted.status_code == 204

    final_stats = client.get("/api/admin/stats", headers=admin_headers).json()
    assert final_stats["businesses"] == 0
    assert final_stats["users"] >= 4
    assert final_stats["reviews"] == 0
    assert final_stats["claims"] == 0


def test_billing_config_and_webhook(client):
    config = client.get("/api/billing/config")
    assert config.status_code == 200
    assert config.json()["enabled"] is False

    webhook = client.post(
        "/api/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "t=1,v1=bad"},
    )
    assert webhook.status_code == 503


def test_manual_payment_approval_flow(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    register(client, "manual-owner@example.com", "Manual Owner")
    owner_headers = login(client, "manual-owner@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Manual Payment Cafe",
            "description": "A listing used to verify manual payments.",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]
    approved = client.post(
        f"/api/admin/businesses/{business_id}/approve", headers=admin_headers
    )
    assert approved.status_code == 200, approved.text

    no_reference = client.post(
        f"/api/billing/businesses/{business_id}/manual-payments",
        headers=owner_headers,
        json={"method": "bank_transfer"},
    )
    assert no_reference.status_code == 400

    submitted = client.post(
        f"/api/billing/businesses/{business_id}/manual-payments",
        headers=owner_headers,
        json={
            "method": "cash",
            "reference": "OR-1042",
            "notes": "Paid at the office.",
        },
    )
    assert submitted.status_code == 201, submitted.text
    payment_id = submitted.json()["id"]
    assert submitted.json()["status"] == "pending"
    assert submitted.json()["business"]["id"] == business_id

    duplicate = client.post(
        f"/api/billing/businesses/{business_id}/manual-payments",
        headers=owner_headers,
        json={"method": "cash"},
    )
    assert duplicate.status_code == 400

    billing = client.get(
        f"/api/billing/businesses/{business_id}", headers=owner_headers
    )
    assert billing.status_code == 200
    assert billing.json()["is_paid"] is False
    assert billing.json()["manual_payment_pending"] is True
    assert billing.json()["latest_manual_payment"]["id"] == payment_id

    pending = client.get(
        "/api/admin/manual-payments?status=pending", headers=admin_headers
    )
    assert pending.status_code == 200
    assert any(item["id"] == payment_id for item in pending.json())

    forbidden = client.post(
        f"/api/admin/manual-payments/{payment_id}/approve",
        headers=owner_headers,
        json={},
    )
    assert forbidden.status_code == 403

    past_approval = client.post(
        f"/api/admin/manual-payments/{payment_id}/approve",
        headers=admin_headers,
        json={"paid_until": (utcnow() - timedelta(days=1)).isoformat()},
    )
    assert past_approval.status_code == 400

    paid_until = utcnow() + timedelta(days=30)
    approved_payment = client.post(
        f"/api/admin/manual-payments/{payment_id}/approve",
        headers=admin_headers,
        json={"paid_until": paid_until.isoformat(), "admin_notes": "Receipt verified"},
    )
    assert approved_payment.status_code == 200, approved_payment.text
    assert approved_payment.json()["status"] == "approved"
    assert approved_payment.json()["admin_notes"] == "Receipt verified"

    paid_billing = client.get(
        f"/api/billing/businesses/{business_id}", headers=owner_headers
    )
    assert paid_billing.status_code == 200
    assert paid_billing.json()["is_paid"] is True
    assert paid_billing.json()["manual_paid_until"] is not None
    assert paid_billing.json()["manual_payment_pending"] is False

    article = client.post(
        f"/api/businesses/{business_id}/articles",
        headers=owner_headers,
        json={
            "title": "Manual payment update",
            "body": "This update is available after manual payment approval.",
            "article_type": "promo",
        },
    )
    assert article.status_code == 201, article.text
    article_slug = article.json()["slug"]
    public_articles = client.get(f"/api/articles?business_id={business_id}")
    assert public_articles.status_code == 200
    assert public_articles.json()["total"] == 1

    with SessionLocal() as db:
        expired = db.get(Business, business_id)
        expired.manual_paid_until = utcnow() - timedelta(days=1)
        db.add(expired)
        db.commit()

    hidden_articles = client.get(f"/api/articles?business_id={business_id}")
    assert hidden_articles.status_code == 200
    assert hidden_articles.json()["total"] == 0
    assert client.get(f"/api/articles/{article_slug}").status_code == 404

    second = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Manual Rejection Cafe",
            "description": "A listing used to verify rejected payments.",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]
    assert (
        client.post(
            f"/api/admin/businesses/{second_id}/approve", headers=admin_headers
        ).status_code
        == 200
    )
    reject_request = client.post(
        f"/api/billing/businesses/{second_id}/manual-payments",
        headers=owner_headers,
        json={"method": "bank_transfer", "reference": "BPI-999"},
    )
    assert reject_request.status_code == 201, reject_request.text
    reject_id = reject_request.json()["id"]
    rejected = client.post(
        f"/api/admin/manual-payments/{reject_id}/reject",
        headers=admin_headers,
        json={"admin_notes": "Reference not found"},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    rejected_billing = client.get(
        f"/api/billing/businesses/{second_id}", headers=owner_headers
    )
    assert rejected_billing.status_code == 200
    assert rejected_billing.json()["is_paid"] is False
    assert rejected_billing.json()["latest_manual_payment"]["status"] == "rejected"
    assert rejected_billing.json()["latest_manual_payment"]["admin_notes"] == "Reference not found"

    rejected_article = client.post(
        f"/api/businesses/{second_id}/articles",
        headers=owner_headers,
        json={
            "title": "Should stay locked",
            "body": "Rejected payments must not unlock publishing.",
            "article_type": "other",
        },
    )
    assert rejected_article.status_code == 402


def test_admin_subscription_approval_flow(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    register(client, "subscription-owner@example.com", "Subscription Owner")
    owner_headers = login(client, "subscription-owner@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Admin Subscription Cafe",
            "description": "A listing used to verify admin subscription controls.",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]
    assert (
        client.post(
            f"/api/admin/businesses/{business_id}/approve", headers=admin_headers
        ).status_code
        == 200
    )

    paid_until = utcnow() + timedelta(days=45)
    approved = client.post(
        f"/api/admin/businesses/{business_id}/subscription/approve",
        headers=admin_headers,
        json={"paid_until": paid_until.isoformat(), "admin_notes": "Approved by admin"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["is_paid"] is True
    assert approved.json()["article_access_override"] == "approved"
    assert approved.json()["article_access_notes"] == "Approved by admin"

    billing = client.get(
        f"/api/billing/businesses/{business_id}", headers=owner_headers
    )
    assert billing.status_code == 200
    assert billing.json()["is_paid"] is True
    assert billing.json()["article_access_override"] == "approved"

    article = client.post(
        f"/api/businesses/{business_id}/articles",
        headers=owner_headers,
        json={
            "title": "Admin approved update",
            "body": "This article is visible after admin subscription approval.",
            "article_type": "promo",
        },
    )
    assert article.status_code == 201, article.text
    article_slug = article.json()["slug"]
    assert (
        client.get(f"/api/articles?business_id={business_id}").json()["total"] == 1
    )

    disapproved = client.post(
        f"/api/admin/businesses/{business_id}/subscription/disapprove",
        headers=admin_headers,
        json={"admin_notes": "Payment could not be verified"},
    )
    assert disapproved.status_code == 200, disapproved.text
    assert disapproved.json()["is_paid"] is False
    assert disapproved.json()["article_access_override"] == "rejected"
    assert disapproved.json()["article_access_notes"] == "Payment could not be verified"

    locked_billing = client.get(
        f"/api/billing/businesses/{business_id}", headers=owner_headers
    )
    assert locked_billing.status_code == 200
    assert locked_billing.json()["is_paid"] is False
    assert locked_billing.json()["article_access_override"] == "rejected"
    assert locked_billing.json()["article_access_notes"] == "Payment could not be verified"
    assert client.get(f"/api/articles?business_id={business_id}").json()["total"] == 0
    assert client.get(f"/api/articles/{article_slug}").status_code == 404

    blocked_article = client.post(
        f"/api/businesses/{business_id}/articles",
        headers=owner_headers,
        json={
            "title": "Locked article",
            "body": "This must not be created while the subscription is disapproved.",
            "article_type": "other",
        },
    )
    assert blocked_article.status_code == 402

    blocked_payment = client.post(
        f"/api/billing/businesses/{business_id}/manual-payments",
        headers=owner_headers,
        json={"method": "cash"},
    )
    assert blocked_payment.status_code == 400

    with SessionLocal() as db:
        stripe_active = db.get(Business, business_id)
        stripe_active.subscription_status = "active"
        stripe_active.stripe_subscription_id = "sub_admin_override_test"
        db.add(stripe_active)
        db.commit()

    still_locked = client.get(f"/api/articles?business_id={business_id}")
    assert still_locked.status_code == 200
    assert still_locked.json()["total"] == 0

    reset = client.post(
        f"/api/admin/businesses/{business_id}/subscription/reset",
        headers=admin_headers,
        json={},
    )
    assert reset.status_code == 200, reset.text
    assert reset.json()["article_access_override"] is None
    assert reset.json()["is_paid"] is True
    assert client.get(f"/api/articles?business_id={business_id}").json()["total"] == 1


def test_stripe_webhook_updates_subscription(client, monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_webhook")
    monkeypatch.setattr(settings, "stripe_price_id", "price_test_webhook")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test_webhook")

    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    register(client, "webhook-owner@example.com", "Webhook Owner")
    owner_headers = login(client, "webhook-owner@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Webhook Test Cafe",
            "description": "A listing used to verify Stripe webhooks.",
            "address": "1 Webhook Street",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]
    approved = client.post(
        f"/api/admin/businesses/{business_id}/approve", headers=admin_headers
    )
    assert approved.status_code == 200, approved.text

    payload = {
        "id": "evt_test_subscription",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_webhook",
                "status": "active",
                "customer": "cus_test_webhook",
                "metadata": {"business_id": str(business_id)},
                "items": {
                    "data": [
                        {
                            "price": {"id": "price_test_webhook"},
                            "current_period_end": int(time.time()) + 3600,
                        }
                    ]
                },
            }
        },
    }
    body = json.dumps(payload).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        b"whsec_test_webhook",
        f"{timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()

    bad_signature = client.post(
        "/api/billing/webhook",
        content=body,
        headers={"stripe-signature": f"t={timestamp},v1=bad"},
    )
    assert bad_signature.status_code == 400

    webhook = client.post(
        "/api/billing/webhook",
        content=body,
        headers={"stripe-signature": f"t={timestamp},v1={signature}"},
    )
    assert webhook.status_code == 204, webhook.text

    billing = client.get(
        f"/api/billing/businesses/{business_id}", headers=owner_headers
    )
    assert billing.status_code == 200
    assert billing.json()["is_paid"] is True
    assert billing.json()["subscription_status"] == "active"


def test_oauth_endpoints(client):
    providers = client.get("/api/auth/oauth/providers")
    assert providers.status_code == 200
    assert providers.json() == {"google": False, "facebook": False}

    unavailable = client.get("/api/auth/oauth/google/start")
    assert unavailable.status_code == 503

    unknown = client.get("/api/auth/oauth/github/start")
    assert unknown.status_code == 404

    invalid_exchange = client.post(
        "/api/auth/oauth/exchange",
        json={"code": "not-a-valid-exchange-code"},
    )
    assert invalid_exchange.status_code == 401


def test_city_blog_flow(client):
    cities = client.get("/api/cities").json()
    city_id = cities[0]["id"]
    admin_headers = login(client, "admin@example.com", "adminpassword")
    register(client, "blogowner@example.com", "Blog Owner")
    owner_headers = login(client, "blogowner@example.com", "password123")

    forbidden = client.post(
        "/api/admin/city-posts",
        headers=owner_headers,
        json={
            "city_id": city_id,
            "title": "Not allowed",
            "body": "Only admins can publish city blog posts.",
        },
    )
    assert forbidden.status_code == 403

    article = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "title": "City Blog: Local guide",
            "summary": "A short guide to the city.",
            "body": "Here are the places worth visiting this month.",
            "post_type": "article",
            "is_published": True,
        },
    )
    assert article.status_code == 201, article.text
    article_data = article.json()
    article_id = article_data["id"]
    article_slug = article_data["slug"]
    assert article_data["city"]["id"] == city_id
    assert article_data["post_type"] == "article"
    assert article_data["is_published"] is True

    public_list = client.get(f"/api/city-posts?city_id={city_id}&type=article")
    assert public_list.status_code == 200
    assert any(item["id"] == article_id for item in public_list.json()["items"])
    assert client.get(f"/api/city-posts/{article_slug}").status_code == 200

    event_without_date = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "title": "City Blog: Weekend event",
            "body": "Join the city weekend event.",
            "post_type": "event",
        },
    )
    assert event_without_date.status_code == 400

    event = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "title": "City Blog: Weekend event",
            "body": "Join the city weekend event.",
            "post_type": "event",
            "event_starts_at": "2026-12-12T10:00:00Z",
            "event_ends_at": "2026-12-12T14:00:00Z",
        },
    )
    assert event.status_code == 201, event.text
    event_id = event.json()["id"]
    event_filter = client.get(f"/api/city-posts?type=event&city_id={city_id}")
    assert event_filter.status_code == 200
    assert any(item["id"] == event_id for item in event_filter.json()["items"])

    draft = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "title": "City Blog: Draft note",
            "body": "This post should stay hidden until it is published.",
            "is_published": False,
        },
    )
    assert draft.status_code == 201, draft.text
    draft_data = draft.json()
    assert draft_data["is_published"] is False
    assert client.get(f"/api/city-posts/{draft_data['slug']}").status_code == 404

    admin_drafts = client.get(
        "/api/admin/city-posts?published=false&search=Draft note",
        headers=admin_headers,
    )
    assert admin_drafts.status_code == 200
    assert any(item["id"] == draft_data["id"] for item in admin_drafts.json()["items"])

    published_draft = client.patch(
        f"/api/admin/city-posts/{draft_data['id']}",
        headers=admin_headers,
        json={"is_published": True},
    )
    assert published_draft.status_code == 200, published_draft.text
    assert published_draft.json()["is_published"] is True
    assert client.get(f"/api/city-posts/{draft_data['slug']}").status_code == 200

    renamed = client.patch(
        f"/api/admin/city-posts/{article_id}",
        headers=admin_headers,
        json={"title": "City Blog: Updated local guide"},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["slug"] != article_slug

    deleted = client.delete(
        f"/api/admin/city-posts/{event_id}", headers=admin_headers
    )
    assert deleted.status_code == 204
    assert client.get(f"/api/city-posts/{event.json()['slug']}").status_code == 404


def test_city_blog_category_flow(client):
    cities = client.get("/api/cities").json()
    admin_headers = login(client, "admin@example.com", "adminpassword")
    city_id = cities[0]["id"]

    created = client.post(
        "/api/admin/blog-categories",
        headers=admin_headers,
        json={"name": "Test neighborhood news", "description": "Local updates"},
    )
    assert created.status_code == 201, created.text
    category = created.json()
    assert category["slug"] == "test-neighborhood-news"

    duplicate = client.post(
        "/api/admin/blog-categories",
        headers=admin_headers,
        json={"name": "test neighborhood news"},
    )
    assert duplicate.status_code == 409

    public_categories = client.get("/api/blog-categories")
    assert public_categories.status_code == 200
    assert any(item["id"] == category["id"] for item in public_categories.json())

    post = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "blog_category_id": category["id"],
            "title": "Category assignment test",
            "body": "A city post used to verify blog category assignment.",
            "is_published": True,
        },
    )
    assert post.status_code == 201, post.text
    post_data = post.json()
    assert post_data["blog_category_id"] == category["id"]
    assert post_data["blog_category"]["name"] == category["name"]

    filtered = client.get(
        f"/api/city-posts?blog_category_id={category['id']}"
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["items"]] == [post_data["id"]]

    detail = client.get(f"/api/city-posts/{post_data['slug']}")
    assert detail.status_code == 200
    assert detail.json()["blog_category"]["id"] == category["id"]

    invalid_post = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": city_id,
            "blog_category_id": 999999,
            "title": "Invalid category test",
            "body": "This post should be rejected for an invalid category.",
        },
    )
    assert invalid_post.status_code == 400

    in_use = client.delete(
        f"/api/admin/blog-categories/{category['id']}", headers=admin_headers
    )
    assert in_use.status_code == 409

    updated = client.patch(
        f"/api/admin/city-posts/{post_data['id']}",
        headers=admin_headers,
        json={"blog_category_id": None},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["blog_category_id"] is None

    renamed = client.patch(
        f"/api/admin/blog-categories/{category['id']}",
        headers=admin_headers,
        json={"name": "Test neighborhood updates"},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["slug"] == "test-neighborhood-updates"

    deleted_post = client.delete(
        f"/api/admin/city-posts/{post_data['id']}", headers=admin_headers
    )
    assert deleted_post.status_code == 204
    deleted_category = client.delete(
        f"/api/admin/blog-categories/{category['id']}", headers=admin_headers
    )
    assert deleted_category.status_code == 204


def test_blog_contributor_flow(client):
    cities = client.get("/api/cities").json()
    city_id = cities[0]["id"]
    admin_headers = login(client, "admin@example.com", "adminpassword")
    contributor = register(client, "contributor@example.com", "Contributor One")
    register(client, "pendingwriter@example.com", "Pending Writer")
    contributor_headers = login(client, "contributor@example.com", "password123")
    pending_headers = login(client, "pendingwriter@example.com", "password123")
    category = client.post(
        "/api/admin/blog-categories",
        headers=admin_headers,
        json={"name": "Contributor stories"},
    ).json()

    no_access = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": city_id,
            "title": "Contributor Workflow: No access",
            "body": "Contributors need admin approval before writing.",
        },
    )
    assert no_access.status_code == 403

    application = client.post(
        "/api/contributor/apply",
        headers=contributor_headers,
        json={
            "message": "I write local travel and community stories.",
            "city_ids": [city_id],
        },
    )
    assert application.status_code == 200, application.text
    assert application.json()["status"] == "pending"
    assert application.json()["can_apply"] is False

    duplicate_application = client.post(
        "/api/contributor/apply",
        headers=contributor_headers,
        json={"message": "Please approve me.", "city_ids": [city_id]},
    )
    assert duplicate_application.status_code == 409

    pending_applications = client.get(
        "/api/admin/contributors?status=pending", headers=admin_headers
    )
    assert pending_applications.status_code == 200
    profile = next(
        item
        for item in pending_applications.json()
        if item["user"]["email"] == "contributor@example.com"
    )
    forbidden_review = client.post(
        f"/api/admin/contributors/{profile['id']}/approve",
        headers=contributor_headers,
        json={},
    )
    assert forbidden_review.status_code == 403

    approved_application = client.post(
        f"/api/admin/contributors/{profile['id']}/approve",
        headers=admin_headers,
        json={"admin_notes": "Approved for city stories."},
    )
    assert approved_application.status_code == 200, approved_application.text
    assert approved_application.json()["status"] == "approved"
    assert [city["id"] for city in approved_application.json()["cities"]] == [city_id]

    contributor_status = client.get(
        "/api/contributor/status", headers=contributor_headers
    )
    assert contributor_status.status_code == 200
    assert contributor_status.json()["status"] == "approved"
    assert contributor_status.json()["can_apply"] is False
    assert [city["id"] for city in contributor_status.json()["cities"]] == [city_id]

    other_city_id = cities[1]["id"]
    forbidden_city_post = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": other_city_id,
            "title": "Contributor Workflow: Other city",
            "body": "Contributors can only write for cities assigned by an admin.",
            "submit_for_review": False,
        },
    )
    assert forbidden_city_post.status_code == 403

    expanded_cities = client.patch(
        f"/api/admin/contributors/{profile['id']}/cities",
        headers=admin_headers,
        json={"city_ids": [city_id, other_city_id]},
    )
    assert expanded_cities.status_code == 200, expanded_cities.text
    assert {city["id"] for city in expanded_cities.json()["cities"]} == {
        city_id,
        other_city_id,
    }

    allowed_other_city_post = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": other_city_id,
            "title": "Contributor Workflow: Assigned other city",
            "body": "This draft is allowed because an admin assigned the city.",
            "submit_for_review": False,
        },
    )
    assert allowed_other_city_post.status_code == 201, allowed_other_city_post.text

    narrowed_cities = client.patch(
        f"/api/admin/contributors/{profile['id']}/cities",
        headers=admin_headers,
        json={"city_ids": [city_id]},
    )
    assert narrowed_cities.status_code == 200
    assert [city["id"] for city in narrowed_cities.json()["cities"]] == [city_id]

    removed_city_post = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": other_city_id,
            "title": "Contributor Workflow: Removed city",
            "body": "This should fail after the admin removes the city assignment.",
            "submit_for_review": False,
        },
    )
    assert removed_city_post.status_code == 403
    assert (
        client.delete(
            f"/api/contributor/posts/{allowed_other_city_post.json()['id']}",
            headers=contributor_headers,
        ).status_code
        == 204
    )

    submitted = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": city_id,
            "blog_category_id": category["id"],
            "title": "Contributor Workflow: First story",
            "summary": "A contributor-submitted city story.",
            "body": "This article is waiting for an admin review before publication.",
            "post_type": "article",
            "submit_for_review": True,
        },
    )
    assert submitted.status_code == 201, submitted.text
    submitted_data = submitted.json()
    assert submitted_data["review_status"] == "pending"
    assert submitted_data["is_published"] is False
    assert submitted_data["author"]["id"] == contributor["id"]
    assert submitted_data["blog_category_id"] == category["id"]
    assert submitted_data["blog_category"]["name"] == "Contributor stories"

    hidden = client.get(
        "/api/city-posts?search=Contributor Workflow: First story"
    )
    assert hidden.status_code == 200
    assert hidden.json()["total"] == 0

    pending_posts = client.get(
        "/api/admin/city-posts?review_status=pending&search=Contributor Workflow",
        headers=admin_headers,
    )
    assert pending_posts.status_code == 200
    assert any(item["id"] == submitted_data["id"] for item in pending_posts.json()["items"])

    approved_post = client.post(
        f"/api/admin/city-posts/{submitted_data['id']}/approve",
        headers=admin_headers,
        json={"admin_notes": "Looks good."},
    )
    assert approved_post.status_code == 200, approved_post.text
    assert approved_post.json()["review_status"] == "approved"
    assert approved_post.json()["is_published"] is True
    public_post = client.get(f"/api/city-posts/{submitted_data['slug']}")
    assert public_post.status_code == 200
    assert public_post.json()["review_status"] == "approved"
    assert "review_notes" not in public_post.json()
    assert "reviewed_by" not in public_post.json()

    draft = client.post(
        "/api/contributor/posts",
        headers=contributor_headers,
        json={
            "city_id": city_id,
            "title": "Contributor Workflow: Draft story",
            "body": "This draft will be submitted for review later.",
            "submit_for_review": False,
        },
    )
    assert draft.status_code == 201, draft.text
    assert draft.json()["review_status"] == "draft"

    my_posts = client.get("/api/contributor/posts", headers=contributor_headers)
    assert my_posts.status_code == 200
    assert {item["review_status"] for item in my_posts.json()["items"]} == {
        "approved",
        "draft",
    }

    submitted_draft = client.patch(
        f"/api/contributor/posts/{draft.json()['id']}",
        headers=contributor_headers,
        json={"submit_for_review": True},
    )
    assert submitted_draft.status_code == 200, submitted_draft.text
    assert submitted_draft.json()["review_status"] == "pending"

    rejected = client.post(
        f"/api/admin/city-posts/{draft.json()['id']}/reject",
        headers=admin_headers,
        json={"admin_notes": "Please add more local detail."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["review_status"] == "rejected"
    assert rejected.json()["is_published"] is False
    assert client.get(f"/api/city-posts/{draft.json()['slug']}").status_code == 404

    rejected_list = client.get(
        "/api/contributor/posts?status=rejected", headers=contributor_headers
    )
    assert rejected_list.status_code == 200
    assert rejected_list.json()["items"][0]["review_notes"] == "Please add more local detail."

    resubmitted = client.patch(
        f"/api/contributor/posts/{draft.json()['id']}",
        headers=contributor_headers,
        json={
            "body": "This revised draft now includes more local detail and context.",
            "submit_for_review": True,
        },
    )
    assert resubmitted.status_code == 200, resubmitted.text
    assert resubmitted.json()["review_status"] == "pending"
    assert resubmitted.json()["review_notes"] is None

    approved_again = client.post(
        f"/api/admin/city-posts/{draft.json()['id']}/approve",
        headers=admin_headers,
        json={},
    )
    assert approved_again.status_code == 200
    assert approved_again.json()["is_published"] is True

    contributor_delete = client.delete(
        f"/api/contributor/posts/{draft.json()['id']}",
        headers=contributor_headers,
    )
    assert contributor_delete.status_code == 403
    admin_delete = client.delete(
        f"/api/admin/city-posts/{draft.json()['id']}", headers=admin_headers
    )
    assert admin_delete.status_code == 204

    pending_application = client.post(
        "/api/contributor/apply",
        headers=pending_headers,
        json={"message": "I would like to contribute.", "city_ids": [city_id]},
    )
    assert pending_application.status_code == 200
    pending_profile = next(
        item
        for item in client.get(
            "/api/admin/contributors?search=pendingwriter", headers=admin_headers
        ).json()
        if item["user"]["email"] == "pendingwriter@example.com"
    )
    rejected_application = client.post(
        f"/api/admin/contributors/{pending_profile['id']}/reject",
        headers=admin_headers,
        json={"admin_notes": "Please share writing samples first."},
    )
    assert rejected_application.status_code == 200
    assert rejected_application.json()["status"] == "rejected"

    rejected_status = client.get("/api/contributor/status", headers=pending_headers)
    assert rejected_status.status_code == 200
    assert rejected_status.json()["status"] == "rejected"
    assert rejected_status.json()["can_apply"] is True

    reapply = client.post(
        "/api/contributor/apply",
        headers=pending_headers,
        json={"message": "Here are my writing samples.", "city_ids": [city_id]},
    )
    assert reapply.status_code == 200
    assert reapply.json()["status"] == "pending"


def test_cover_image_upload_limit(client):
    from pathlib import Path
    from urllib.parse import urlparse

    register(client, "uploader@example.com", "Cover Uploader")
    headers = login(client, "uploader@example.com", "password123")

    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    uploaded = client.post(
        "/api/uploads/cover-image",
        headers=headers,
        files={"file": ("cover.png", png, "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    payload = uploaded.json()
    assert payload["size"] == len(png)
    assert "/uploads/covers/" in payload["url"]
    path = Path("uploads") / urlparse(payload["url"]).path.removeprefix("/uploads/")
    assert path.exists()
    assert client.get(f"/uploads/{path.relative_to('uploads').as_posix()}").status_code == 200
    path.unlink()

    too_large = b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024)
    rejected = client.post(
        "/api/uploads/cover-image",
        headers=headers,
        files={"file": ("big.png", too_large, "image/png")},
    )
    assert rejected.status_code == 413


def test_city_post_rich_text_is_sanitized(client):
    cities = client.get("/api/cities").json()
    admin_headers = login(client, "admin@example.com", "adminpassword")
    created = client.post(
        "/api/admin/city-posts",
        headers=admin_headers,
        json={
            "city_id": cities[0]["id"],
            "title": "Rich text safety check",
            "body": (
                "<h2>Hello</h2><p>Safe <strong>article</strong> body.</p>"
                '<p><a href="javascript:alert(1)">bad link</a></p>'
                "<script>alert(1)</script>"
            ),
            "is_published": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["body"]
    assert "<h2>Hello</h2>" in body
    assert "<strong>article</strong>" in body
    assert "javascript:" not in body
    assert "<script" not in body
    public = client.get(f"/api/city-posts/{created.json()['slug']}")
    assert public.status_code == 200
    assert public.json()["body"] == body
    assert client.delete(
        f"/api/admin/city-posts/{created.json()['id']}", headers=admin_headers
    ).status_code == 204


def test_featured_listing_flow(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    category_id = categories[0]["id"]
    city_id = cities[0]["id"]

    register(client, "featured-owner@example.com", "Featured Owner")
    register(client, "featured-other@example.com", "Featured Other")
    owner_headers = login(client, "featured-owner@example.com", "password123")
    other_headers = login(client, "featured-other@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    businesses = []
    for name in ("Featured Order Alpha", "Featured Order Beta"):
        created = client.post(
            "/api/businesses",
            headers=owner_headers,
            json={
                "name": name,
                "description": "Featured listing test business",
                "address": "1 Featured Street",
                "category_id": category_id,
                "city_id": city_id,
            },
        )
        assert created.status_code == 201, created.text
        approved = client.post(
            f"/api/admin/businesses/{created.json()['id']}/approve",
            headers=admin_headers,
        )
        assert approved.status_code == 200, approved.text
        businesses.append(approved.json())

    featured_business = businesses[0]
    other_business = businesses[1]

    stripe_request = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=owner_headers,
        json={"payment_method": "stripe"},
    )
    assert stripe_request.status_code == 503

    missing_reference = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=owner_headers,
        json={"payment_method": "bank_transfer"},
    )
    assert missing_reference.status_code == 400

    forbidden = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=other_headers,
        json={"payment_method": "cash"},
    )
    assert forbidden.status_code == 403

    created_request = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=owner_headers,
        json={
            "payment_method": "bank_transfer",
            "payment_reference": "BPI-FEATURED-001",
            "message": "Please feature our business in this city and category.",
        },
    )
    assert created_request.status_code == 201, created_request.text
    request_data = created_request.json()
    assert request_data["status"] == "pending"
    assert request_data["payment_status"] == "pending"
    assert request_data["business"]["category"]["id"] == category_id
    assert request_data["business"]["city"]["id"] == city_id
    request_id = request_data["id"]

    duplicate = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=owner_headers,
        json={"payment_method": "cash"},
    )
    assert duplicate.status_code == 400

    pending = client.get(
        "/api/admin/featured-requests?status=pending", headers=admin_headers
    )
    assert pending.status_code == 200, pending.text
    assert any(item["id"] == request_id for item in pending.json())

    featured_until = (utcnow() + timedelta(days=45)).isoformat()
    approved = client.post(
        f"/api/admin/featured-requests/{request_id}/approve",
        headers=admin_headers,
        json={
            "featured_until": featured_until,
            "admin_notes": "Payment verified.",
        },
    )
    assert approved.status_code == 200, approved.text
    approved_data = approved.json()
    assert approved_data["status"] == "approved"
    assert approved_data["payment_status"] == "paid"
    assert approved_data["featured_until"] is not None

    detail = client.get(f"/api/businesses/{featured_business['id']}")
    assert detail.status_code == 200
    assert detail.json()["is_featured"] is True
    assert detail.json()["featured_until"] is not None

    public_list = client.get(
        f"/api/businesses?city_id={city_id}&category_id={category_id}"
        "&search=Featured Order"
    )
    assert public_list.status_code == 200
    items = public_list.json()["items"]
    assert len(items) == 2
    assert items[0]["id"] == featured_business["id"]
    assert items[0]["is_featured"] is True
    assert items[1]["id"] == other_business["id"]
    assert items[1]["is_featured"] is False

    removed = client.delete(
        f"/api/admin/businesses/{featured_business['id']}/featured",
        headers=admin_headers,
    )
    assert removed.status_code == 204
    detail_after_removal = client.get(
        f"/api/businesses/{featured_business['id']}"
    ).json()
    assert detail_after_removal["is_featured"] is False
    assert detail_after_removal["featured_until"] is None

    rejected_request = client.post(
        f"/api/featured/businesses/{featured_business['id']}/requests",
        headers=owner_headers,
        json={"payment_method": "cash", "payment_notes": "Paid in cash."},
    )
    assert rejected_request.status_code == 201, rejected_request.text
    rejected = client.post(
        f"/api/admin/featured-requests/{rejected_request.json()['id']}/reject",
        headers=admin_headers,
        json={"admin_notes": "Payment could not be verified."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["payment_status"] == "rejected"


def test_featured_stripe_checkout_webhook(client, monkeypatch):
    from app.routers import featured as featured_router

    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_featured")
    monkeypatch.setattr(settings, "stripe_featured_price_id", "price_test_featured")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test_featured")
    monkeypatch.setattr(
        featured_router,
        "ensure_stripe_customer",
        lambda db, user: "cus_test_featured",
    )
    monkeypatch.setattr(
        featured_router,
        "stripe_request",
        lambda method, path, data=None: {
            "id": "cs_test_featured",
            "url": "https://checkout.stripe.test/featured",
        },
    )

    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    register(client, "featured-stripe@example.com", "Featured Stripe")
    owner_headers = login(client, "featured-stripe@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Featured Stripe Cafe",
            "description": "A listing used to verify featured Stripe checkout.",
            "address": "2 Featured Street",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]
    approved = client.post(
        f"/api/admin/businesses/{business_id}/approve", headers=admin_headers
    )
    assert approved.status_code == 200, approved.text

    checkout = client.post(
        f"/api/featured/businesses/{business_id}/requests",
        headers=owner_headers,
        json={"payment_method": "stripe", "message": "Feature us."},
    )
    assert checkout.status_code == 201, checkout.text
    checkout_data = checkout.json()
    assert checkout_data["checkout_url"] == "https://checkout.stripe.test/featured"
    request_id = checkout_data["request"]["id"]
    assert checkout_data["request"]["payment_status"] == "pending"

    payload = {
        "id": "evt_test_featured",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_featured",
                "payment_intent": "pi_test_featured",
                "metadata": {
                    "featured_request_id": str(request_id),
                    "business_id": str(business_id),
                    "purpose": "featured",
                },
            }
        },
    }
    body = json.dumps(payload).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        b"whsec_test_featured",
        f"{timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()
    webhook = client.post(
        "/api/billing/webhook",
        content=body,
        headers={"stripe-signature": f"t={timestamp},v1={signature}"},
    )
    assert webhook.status_code == 204, webhook.text

    pending = client.get(
        "/api/admin/featured-requests?status=pending", headers=admin_headers
    ).json()
    request_data = next(item for item in pending if item["id"] == request_id)
    assert request_data["payment_status"] == "paid"
    assert request_data["payment_reference"] == "pi_test_featured"

    approved_request = client.post(
        f"/api/admin/featured-requests/{request_id}/approve",
        headers=admin_headers,
        json={"featured_until": (utcnow() + timedelta(days=30)).isoformat()},
    )
    assert approved_request.status_code == 200, approved_request.text
    assert approved_request.json()["status"] == "approved"


def test_editor_role_content_access(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    admin_headers = login(client, "admin@example.com", "adminpassword")
    editor = register(client, "editor@example.com", "Editor One")
    editor_headers = login(client, "editor@example.com", "password123")

    assigned = client.patch(
        f"/api/admin/users/{editor['id']}/role",
        headers=admin_headers,
        json={"role": "editor"},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["role"] == "editor"

    assert client.get("/api/admin/stats", headers=editor_headers).status_code == 200
    assert (
        client.get("/api/admin/businesses?status=pending", headers=editor_headers)
        .status_code
        == 200
    )
    assert client.get("/api/admin/articles", headers=editor_headers).status_code == 200
    assert (
        client.get("/api/admin/contributors", headers=editor_headers).status_code
        == 200
    )
    assert client.get("/api/admin/users", headers=editor_headers).status_code == 403
    assert client.get("/api/admin/claims", headers=editor_headers).status_code == 403
    assert (
        client.get("/api/admin/manual-payments", headers=editor_headers).status_code
        == 403
    )

    register(client, "editor-owner@example.com", "Editor Owner")
    owner_headers = login(client, "editor-owner@example.com", "password123")
    business = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Editor Managed Cafe",
            "description": "A listing used to test editor article access.",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert business.status_code == 201, business.text
    business_id = business.json()["id"]
    assert (
        client.post(
            f"/api/admin/businesses/{business_id}/approve", headers=editor_headers
        ).status_code
        == 200
    )

    article = client.post(
        f"/api/businesses/{business_id}/articles",
        headers=editor_headers,
        json={
            "title": "Editor-created draft update",
            "body": "Editors can add content for any business listing.",
            "article_type": "product_update",
            "is_published": False,
        },
    )
    assert article.status_code == 201, article.text
    article_data = article.json()
    assert article_data["is_published"] is False

    all_articles = client.get(
        "/api/admin/articles?search=Editor-created draft update",
        headers=editor_headers,
    )
    assert all_articles.status_code == 200, all_articles.text
    assert any(item["id"] == article_data["id"] for item in all_articles.json()["items"])

    published = client.patch(
        f"/api/articles/{article_data['id']}",
        headers=editor_headers,
        json={"is_published": True},
    )
    assert published.status_code == 200, published.text
    assert published.json()["is_published"] is True

    unpublished = client.patch(
        f"/api/articles/{article_data['id']}",
        headers=editor_headers,
        json={"is_published": False},
    )
    assert unpublished.status_code == 200, unpublished.text
    assert unpublished.json()["is_published"] is False

    city_post = client.post(
        "/api/admin/city-posts",
        headers=editor_headers,
        json={
            "city_id": cities[0]["id"],
            "title": "Editor city desk update",
            "body": "Editors can publish city blog content for readers.",
            "is_published": True,
        },
    )
    assert city_post.status_code == 201, city_post.text
    rejected = client.post(
        f"/api/admin/city-posts/{city_post.json()['id']}/reject",
        headers=editor_headers,
        json={"admin_notes": "Editor review decision."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["review_status"] == "rejected"

    assert (
        client.delete(
            f"/api/admin/city-posts/{city_post.json()['id']}",
            headers=editor_headers,
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/articles/{article_data['id']}", headers=editor_headers
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/admin/city-posts/{city_post.json()['id']}",
            headers=admin_headers,
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/articles/{article_data['id']}", headers=admin_headers
        ).status_code
        == 204
    )


def test_account_billing_summary(client):
    categories = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    register(client, "account-billing@example.com", "Account Billing")
    register(client, "account-billing-other@example.com", "Other Billing")
    owner_headers = login(client, "account-billing@example.com", "password123")
    other_headers = login(client, "account-billing-other@example.com", "password123")
    admin_headers = login(client, "admin@example.com", "adminpassword")

    created = client.post(
        "/api/businesses",
        headers=owner_headers,
        json={
            "name": "Account Billing Cafe",
            "description": "A listing used to verify the account billing summary.",
            "category_id": categories[0]["id"],
            "city_id": cities[0]["id"],
        },
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]
    assert (
        client.post(
            f"/api/admin/businesses/{business_id}/approve", headers=admin_headers
        ).status_code
        == 200
    )

    payment = client.post(
        f"/api/billing/businesses/{business_id}/manual-payments",
        headers=owner_headers,
        json={"method": "cash", "reference": "ACCOUNT-001"},
    )
    assert payment.status_code == 201, payment.text
    payment_id = payment.json()["id"]

    account = client.get("/api/billing/account", headers=owner_headers)
    assert account.status_code == 200, account.text
    summary = account.json()
    assert summary["active_article_subscriptions"] == 0
    assert summary["active_featured_listings"] == 0
    assert summary["pending_payments"] == 1
    assert summary["has_stripe_customer"] is False
    assert len(summary["businesses"]) == 1
    item = summary["businesses"][0]
    assert item["business"]["id"] == business_id
    assert item["business"]["category"]["id"] == categories[0]["id"]
    assert item["article"]["manual_payment_pending"] is True
    assert item["article"]["latest_manual_payment"]["id"] == payment_id
    assert len(item["manual_payments"]) == 1
    assert item["featured_requests"] == []

    approved_payment = client.post(
        f"/api/admin/manual-payments/{payment_id}/approve",
        headers=admin_headers,
        json={"paid_until": (utcnow() + timedelta(days=30)).isoformat()},
    )
    assert approved_payment.status_code == 200, approved_payment.text

    featured_request = client.post(
        f"/api/featured/businesses/{business_id}/requests",
        headers=owner_headers,
        json={"payment_method": "cash", "payment_notes": "Paid in cash."},
    )
    assert featured_request.status_code == 201, featured_request.text
    featured_id = featured_request.json()["id"]

    account = client.get("/api/billing/account", headers=owner_headers)
    assert account.status_code == 200, account.text
    summary = account.json()
    assert summary["active_article_subscriptions"] == 1
    assert summary["active_featured_listings"] == 0
    assert summary["pending_payments"] == 1
    item = summary["businesses"][0]
    assert item["article"]["is_paid"] is True
    assert item["article"]["latest_manual_payment"]["status"] == "approved"
    assert item["featured"]["pending_request"]["id"] == featured_id
    assert item["featured_requests"][0]["id"] == featured_id

    approved_featured = client.post(
        f"/api/admin/featured-requests/{featured_id}/approve",
        headers=admin_headers,
        json={"featured_until": (utcnow() + timedelta(days=30)).isoformat()},
    )
    assert approved_featured.status_code == 200, approved_featured.text

    account = client.get("/api/billing/account", headers=owner_headers)
    assert account.status_code == 200, account.text
    summary = account.json()
    assert summary["active_featured_listings"] == 1
    assert summary["pending_payments"] == 0
    item = summary["businesses"][0]
    assert item["featured"]["is_featured"] is True
    assert item["featured"]["latest_request"]["status"] == "approved"
    assert len(item["featured_requests"]) == 1

    other_account = client.get("/api/billing/account", headers=other_headers)
    assert other_account.status_code == 200
    assert other_account.json()["businesses"] == []
    assert other_account.json()["pending_payments"] == 0

    assert client.get("/api/billing/account").status_code == 401
