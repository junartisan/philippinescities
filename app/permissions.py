from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Business,
    BusinessTeamMember,
    BusinessTeamRole,
    User,
    UserRole,
)
from app.roles import has_role

BRAND_FIELDS = {
    "name",
    "description",
    "category_id",
    "website",
    "logo_url",
}
BRANCH_FIELDS = {
    "address",
    "city_id",
    "phone",
    "email",
    "hours",
}
PROMO_FIELDS = {
    "promo_headline",
    "promo_details",
}
PROFILE_FIELDS = BRAND_FIELDS | BRANCH_FIELDS | PROMO_FIELDS


def _member_role(db: Session, business_id: int, user_id: int) -> BusinessTeamRole | None:
    return db.scalar(
        select(BusinessTeamMember.role).where(
            BusinessTeamMember.business_id == business_id,
            BusinessTeamMember.user_id == user_id,
        )
    )


def business_access_role(db: Session, user: User, business: Business) -> str | None:
    if has_role(user, UserRole.admin) or business.owner_id == user.id:
        return "owner"

    if business.parent_id is not None:
        parent = db.get(Business, business.parent_id)
        if parent is not None and parent.owner_id == user.id:
            return "corporate_admin"
        if parent is not None and _member_role(db, parent.id, user.id) == BusinessTeamRole.corporate_admin:
            return "corporate_admin"

    if business.parent_id is None and business.owner_id == user.id:
        return "owner"

    direct_role = _member_role(db, business.id, user.id)
    if direct_role == BusinessTeamRole.corporate_admin:
        return "corporate_admin"
    if direct_role == BusinessTeamRole.branch_manager:
        return "branch_manager"
    if direct_role == BusinessTeamRole.staff:
        return "staff"
    return None


def editable_business_fields(business: Business, role: str | None) -> set[str]:
    if role == "owner":
        return set(PROFILE_FIELDS)
    if role == "corporate_admin":
        return set(BRAND_FIELDS | PROMO_FIELDS) if business.parent_id else set(PROFILE_FIELDS)
    if role == "branch_manager":
        return set(BRANCH_FIELDS | PROMO_FIELDS) if business.parent_id else set(PROMO_FIELDS)
    if role == "staff":
        return set(PROMO_FIELDS)
    return set()


def can_edit_business_fields(
    db: Session,
    user: User,
    business: Business,
    fields: set[str],
) -> bool:
    role = business_access_role(db, user, business)
    return fields.issubset(editable_business_fields(business, role))


def can_manage_team(db: Session, user: User, business: Business) -> bool:
    return business_access_role(db, user, business) in {"owner", "corporate_admin"}


def can_change_parent(db: Session, user: User, business: Business) -> bool:
    return business_access_role(db, user, business) == "owner"
