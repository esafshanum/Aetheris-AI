from fastapi import APIRouter, Depends
from backend.app.config import settings
from backend.app.models import User
from backend.app.schemas import SettingsResponse
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
def get_settings(current_user: User = Depends(get_current_user)):
    # Returns true if an API key is configured in the server environment
    return {
        "has_api_key": bool(settings.OPENAI_API_KEY or settings.GROQ_API_KEY),
        "has_sarvam_key": bool(settings.SARVAM_API_KEY)
    }
