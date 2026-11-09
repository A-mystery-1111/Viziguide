import base64
import re
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from config import get_settings

MAX_IMAGE_SIZE = 8 * 1024 * 1024
GEMINI_MODEL = "gemini-2.5-flash"
DISCLAIMER = (
    "This is general guidance based on a photo, not a professional inspection. "
    "Stop if anything feels unsafe and follow the product manual."
)

MIME_SIGNATURES = {
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
}

RISK_TERMS = re.compile(
    r"\b(?:mains?|electricity|electrical|live wire|high voltage|"
    r"gas|propane|lpg|natural gas|pressure|pressurized|compressed air)\b",
    re.IGNORECASE,
)


class RepairStep(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    title: str = Field(min_length=1, max_length=120)
    instruction: str = Field(min_length=1, max_length=600)


class DiagnosisResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    product_identified: str = Field(min_length=1, max_length=200)
    issue: str = Field(min_length=1, max_length=600)
    confidence: float = Field(ge=0, le=1)
    severity: Literal["low", "medium", "high"]
    steps: list[RepairStep] = Field(max_length=8)
    safety_warnings: list[str] = Field(max_length=8)
    needs_professional: bool
    disclaimer: str = DISCLAIMER


GEMINI_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "product_identified": {"type": "STRING"},
        "issue": {"type": "STRING"},
        "confidence": {"type": "NUMBER"},
        "severity": {"type": "STRING", "enum": ["low", "medium", "high"]},
        "steps": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "instruction": {"type": "STRING"},
                },
                "required": ["title", "instruction"],
            },
        },
        "safety_warnings": {"type": "ARRAY", "items": {"type": "STRING"}},
        "needs_professional": {"type": "BOOLEAN"},
    },
    "required": [
        "product_identified",
        "issue",
        "confidence",
        "severity",
        "steps",
        "safety_warnings",
        "needs_professional",
    ],
}


def validate_image(content_type: str | None, data: bytes) -> str:
    if content_type not in MIME_SIGNATURES:
        raise ValueError("Upload a JPG, PNG, or WebP image.")
    if not MIME_SIGNATURES[content_type](data):
        raise ValueError("The uploaded file does not match its image type.")
    return content_type


def ensure_safe_result(result: DiagnosisResult, description: str | None) -> DiagnosisResult:
    result_text = " ".join(
        [
            description or "",
            result.product_identified,
            result.issue,
            *(step.title + " " + step.instruction for step in result.steps),
            *result.safety_warnings,
        ]
    )
    warnings = list(result.safety_warnings)
    needs_professional = result.needs_professional

    if RISK_TERMS.search(result_text):
        needs_professional = True
        professional_warning = (
            "This may involve mains electricity, gas, or pressure. "
            "For your safety, have a qualified professional handle it."
        )
        if professional_warning not in warnings:
            warnings.insert(0, professional_warning)

    issue = result.issue
    if result.confidence < 0.6:
        clearer_photo_warning = (
            "I’m not confident from this photo. Please upload a clearer, well-lit photo "
            "showing the whole product and the problem."
        )
        if clearer_photo_warning not in warnings:
            warnings.insert(0, clearer_photo_warning)
        issue = (
            "I can’t clearly identify the issue from this photo. Please upload a clearer, "
            "well-lit photo showing the whole product and the problem."
        )

    return DiagnosisResult.model_validate(
        result.model_dump() | {
            "issue": issue,
            "safety_warnings": warnings[:8],
            "needs_professional": needs_professional,
            "disclaimer": DISCLAIMER,
        }
    )


async def analyze_with_gemini(
    image: bytes,
    mime_type: str,
    description: str | None,
) -> DiagnosisResult:
    settings = get_settings()
    api_key = settings.ai_api_key.get_secret_value()
    if not api_key:
        raise RuntimeError("The vision AI service is not configured.")

    prompt = (
        "Inspect the attached product photo and return only the JSON object matching the "
        "provided schema. Use simple, short language. Identify the product and the most "
        "likely issue, give a confidence from 0 to 1, and rate severity as low, medium, "
        "or high. Give up to 5 short repair steps only when they are safe for a typical "
        "person. Never tell someone to open or work on mains-powered electrical parts, "
        "gas lines or appliances, or pressurized equipment. For any task involving mains "
        "electricity, gas, or pressure, set needs_professional to true and include a clear "
        "warning. If you cannot identify the product confidently, say so and request a "
        "clearer photo. Do not claim certainty that the photo does not support. "
        f"User description: {description.strip() if description and description.strip() else 'None provided.'}"
    )
    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64.b64encode(image).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": GEMINI_RESPONSE_SCHEMA,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                headers={"x-goog-api-key": api_key},
                json=request_body,
            )
        response.raise_for_status()
        payload = response.json()
        generated_text = payload["candidates"][0]["content"]["parts"][0]["text"]
        result = DiagnosisResult.model_validate_json(generated_text)
    except httpx.TimeoutException as error:
        raise RuntimeError("The vision AI service took too long to respond.") from error
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            raise RuntimeError("The vision AI service is busy. Please try again shortly.") from error
        raise RuntimeError("The vision AI service could not analyze this image.") from error
    except (httpx.RequestError, KeyError, IndexError, TypeError, ValueError, ValidationError) as error:
        raise RuntimeError("The vision AI service returned an invalid diagnosis.") from error

    return ensure_safe_result(result, description)


async def save_diagnosis(
    user_id: str,
    description: str | None,
    result: DiagnosisResult,
) -> None:
    settings = get_settings()
    supabase_url = settings.supabase_url.rstrip("/")
    secret_key = settings.supabase_secret_key.get_secret_value()
    if not supabase_url or not secret_key:
        raise RuntimeError("Supabase database access is not configured.")

    payload = {
        "user_id": user_id,
        "description": description.strip() if description and description.strip() else "No description provided.",
        "result": result.model_dump(mode="json"),
        "disclaimer": result.disclaimer,
        "status": "completed",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{supabase_url}/rest/v1/diagnoses",
                headers={
                    "apikey": secret_key,
                    "Authorization": f"Bearer {secret_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json=payload,
            )
        response.raise_for_status()
    except httpx.TimeoutException as error:
        raise RuntimeError("Saving the diagnosis timed out. Please try again.") from error
    except httpx.HTTPStatusError as error:
        raise RuntimeError("The diagnosis could not be saved to your account.") from error
    except httpx.RequestError as error:
        raise RuntimeError("Could not connect to Supabase to save the diagnosis.") from error
