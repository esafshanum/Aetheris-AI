import base64
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import httpx
from backend.app.config import settings
from backend.app.auth import get_current_user
from backend.app.models import User

router = APIRouter(prefix="/api/voice", tags=["Voice"])

class TTSRequest(BaseModel):
    text: str
    language: str = "hi-IN"
    gender: str = "female"

@router.post("/tts")
async def text_to_speech(
    payload: TTSRequest,
    x_sarvam_key: Optional[str] = Header(None, alias="X-Sarvam-Key"),
    current_user: User = Depends(get_current_user)
):
    api_key = x_sarvam_key or settings.SARVAM_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Sarvam AI API Key is not configured. Please add it in your settings panel or .env file."
        )

    cleaned_text = payload.text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    speaker = "meera" if payload.gender == "female" else "arjun"

    async with httpx.AsyncClient(verify=False) as client:
        try:
            response = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "api-subscription-key": api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "text": cleaned_text,
                    "target_language_code": payload.language,
                    "speaker": speaker,
                    "model": "bulbul:v3"
                },
                timeout=20.0
            )

            if response.status_code != 200:
                detail = "Failed to communicate with Sarvam AI."
                try:
                    err_json = response.json()
                    detail = err_json.get("message") or err_json.get("error") or detail
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=detail)

            res_data = response.json()
            audios = res_data.get("audios", [])
            if not audios:
                raise HTTPException(status_code=500, detail="No audio data returned by Sarvam AI.")

            # Decode base64 audio
            audio_base64 = audios[0]
            audio_binary = base64.b64decode(audio_base64)

            return Response(content=audio_binary, media_type="audio/wav")

        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Network error calling Sarvam AI API: {str(e)}")
