from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import User, UserRole, UserRoleAssignment

USER_ROLE_RANK = {
    UserRole.user: 0,
    UserRole.owner: 1,
    UserRole.editor: 2,
    UserRole.supervisor: 3,
    UserRole.admin: 4,
}


def coerce_role(role: UserRole | str) -> UserRole:
    return role if isinstance(role, UserRole) else UserRole(role)


def effective_roles(user: User) -> set[UserRole]:
    roles = {coerce_role(user.role)}
    roles.update(coerce_role(role) for role in getattr(user, "roles", None) or [])
    return roles


def has_role(user: User, role: UserRole | str) -> bool:
    return coerce_role(role) in effective_roles(user)


def has_any_role(user: User, roles: Iterable[UserRole | str]) -> bool:
    requested = {coerce_role(role) for role in roles}
    return bool(requested.intersection(effective_roles(user)))


def set_roles(
    db: Session,
    user: User,
    roles: Iterable[UserRole | str],
) -> list[UserRole]:
    normalized = list(dict.fromkeys(coerce_role(role) for role in roles))
    if not normalized:
        raise ValueError("At least one role is required")
    user.role_assignments = [UserRoleAssignment(role=role) for role in normalized]
    user.role = max(normalized, key=lambda role: USER_ROLE_RANK[role])
    db.add(user)
    return normalized
