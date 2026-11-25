from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    if not smtp_configured():
        logger.warning("SMTP not configured; skipping email to %s subject=%s", to_email, subject)
        logger.info("Email preview\nTo: %s\nSubject: %s\n\n%s", to_email, subject, text_body)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    if settings.smtp_use_ssl or settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
    return True


def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    verify_url = f"{settings.frontend_url.rstrip('/')}/verify-email?token={token}"
    subject = "Confirm your Philippines Cities account"
    greeting = full_name.strip() or "there"
    text_body = (
        f"Hi {greeting},\n\n"
        "Please confirm your Philippines Cities account by clicking the link below:\n"
        f"{verify_url}\n\n"
        f"This link expires in {settings.email_verification_expire_minutes // 60} hours.\n"
        "If you did not create this account, you can ignore this email.\n"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px">Confirm your account</h2>
      <p>Hi {greeting},</p>
      <p>Please confirm your Philippines Cities account by clicking the button below.</p>
      <p>
        <a href="{verify_url}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;text-decoration:none;border-radius:999px">
          Confirm email
        </a>
      </p>
      <p>If the button does not work, copy this link into your browser:</p>
      <p><a href="{verify_url}">{verify_url}</a></p>
      <p>This link expires in {settings.email_verification_expire_minutes // 60} hours.</p>
    </div>
    """
    return send_email(to_email, subject, text_body, html_body)


def send_password_reset_email(to_email: str, full_name: str, token: str) -> bool:
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    subject = "Reset your Philippines Cities password"
    greeting = full_name.strip() or "there"
    text_body = (
        f"Hi {greeting},\n\n"
        "We received a request to reset your Philippines Cities password. "
        "Use the link below to choose a new password:\n"
        f"{reset_url}\n\n"
        f"This link expires in {settings.password_reset_expire_minutes} minutes.\n"
        "If you did not request a password reset, you can ignore this email.\n"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px">Reset your password</h2>
      <p>Hi {greeting},</p>
      <p>We received a request to reset your Philippines Cities password.</p>
      <p>
        <a href="{reset_url}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;text-decoration:none;border-radius:999px">
          Reset password
        </a>
      </p>
      <p>If the button does not work, copy this link into your browser:</p>
      <p><a href="{reset_url}">{reset_url}</a></p>
      <p>This link expires in {settings.password_reset_expire_minutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
    """
    return send_email(to_email, subject, text_body, html_body)


def send_business_invitation_email(
    to_email: str,
    business_name: str,
    inviter_name: str,
    role_label: str,
    token: str,
    expires_hours: int,
) -> bool:
    invite_url = f"{settings.frontend_url.rstrip('/')}/dashboard/invitations?token={token}"
    subject = f"You are invited to manage {business_name} on Philippines Cities"
    greeting = inviter_name.strip() or "A directory administrator"
    text_body = (
        f"Hi,\n\n"
        f"{greeting} invited you to join {business_name} on Philippines Cities as {role_label}.\n"
        f"Open the link below to review and accept the invitation:\n{invite_url}\n\n"
        f"This invitation expires in {expires_hours} hours.\n"
        "If you were not expecting this invitation, you can ignore this email.\n"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px">You are invited</h2>
      <p>Hi,</p>
      <p>{greeting} invited you to join <strong>{business_name}</strong> on Philippines Cities as <strong>{role_label}</strong>.</p>
      <p>
        <a href="{invite_url}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;text-decoration:none;border-radius:999px">
          Review invitation
        </a>
      </p>
      <p>If the button does not work, copy this link into your browser:</p>
      <p><a href="{invite_url}">{invite_url}</a></p>
      <p>This invitation expires in {expires_hours} hours.</p>
    </div>
    """
    return send_email(to_email, subject, text_body, html_body)
