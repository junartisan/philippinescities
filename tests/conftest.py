import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
os.environ["SECRET_KEY"] = "test-secret-key-with-at-least-32-bytes"
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "adminpassword"

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import User, utcnow


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        with SessionLocal() as db:
            admin = db.query(User).filter(User.email == "admin@example.com").first()
            if admin and admin.email_verified_at is None:
                admin.email_verified_at = utcnow()
                db.add(admin)
                db.commit()
        yield test_client
