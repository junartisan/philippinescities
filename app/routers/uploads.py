from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.config import settings
from app.deps import get_current_active_user
from app.models import User, utcnow

router = APIRouter(prefix="/uploads", tags=["Uploads"])

ALLOWED_IMAGE_TYPES = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class CoverImageOut(BaseModel):
    url: str
    content_type: str
    size: int


def _detect_image_extension(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


@router.post(
    "/cover-image",
    response_model=CoverImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_cover_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_active_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cover image must be a JPG, PNG, WebP, or GIF file",
        )

    data = await file.read(settings.max_cover_image_bytes + 1)
    if len(data) > settings.max_cover_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Cover image must be 5 MB or smaller",
        )
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cover image file is empty",
        )

    extension = _detect_image_extension(data)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cover image file is not a valid image",
        )

    now = utcnow()
    relative_path = (
        Path("covers")
        / f"{now.year:04d}"
        / f"{now.month:02d}"
        / f"{uuid4().hex}{extension}"
    )
    destination = Path(settings.upload_dir) / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)

    url = f"{settings.backend_url.rstrip('/')}/uploads/{relative_path.as_posix()}"
    return CoverImageOut(url=url, content_type=content_type, size=len(data))
