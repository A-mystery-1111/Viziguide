from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from chat import ChatRequest, ChatResponse, chat
from diagnosis import (
    MAX_IMAGE_SIZE,
    DiagnosisResult,
    analyze_with_gemini,
    save_diagnosis,
    validate_image,
)
from security import get_current_user_id

app = FastAPI(title="ViziGuide API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/me")
async def current_user(user_id: str = Depends(get_current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}


@app.post("/api/diagnose", response_model=DiagnosisResult)
async def diagnose(
    image: UploadFile = File(...),
    description: str | None = Form(default=None, max_length=2000),
    user_id: str = Depends(get_current_user_id),
) -> DiagnosisResult:
    try:
        if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Upload a JPG, PNG, or WebP image.",
            )
        image_data = await image.read(MAX_IMAGE_SIZE + 1)
        if len(image_data) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image files must be 8 MB or smaller.",
            )
        try:
            mime_type = validate_image(image.content_type, image_data)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=str(error),
            ) from error
    finally:
        await image.close()

    try:
        result = await analyze_with_gemini(image_data, mime_type, description)
    except RuntimeError as error:
        message = str(error)
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "busy" in message.lower() or "too long" in message.lower()
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=message) from error

    try:
        await save_diagnosis(user_id, description, result)
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return result


@app.post("/api/chat", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
) -> ChatResponse:
    try:
        return await chat(user_id, request)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except RuntimeError as error:
        message = str(error)
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "busy" in message.lower() or "too long" in message.lower()
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=message) from error
