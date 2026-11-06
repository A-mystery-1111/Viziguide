import io
import logging
import math
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from PIL import Image
from pydantic import BaseModel, Field

# Load environment variables from .env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("viziguide.backend")

# Initialize FastAPI application
app = FastAPI(
    title="Viziguide - Laptop Hardware & Software AI Diagnostics",
    description="Multimodal diagnostic backend using OpenCV and Gemini 1.5 Pro to analyze laptop issues from photos and videos.",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini Technician System Prompt
TECHNICIAN_SYSTEM_PROMPT = """You are a certified Master Laptop Hardware & Systems Diagnostic Technician with over 20 years of experience diagnosing, troubleshooting, and repairing laptop computers across all major manufacturers (e.g., Apple MacBook, Dell XPS/Latitude, Lenovo ThinkPad, HP Spectre/EliteBook, ASUS ROG/ZenBook, Acer, Framework, and Razer).

Your role is to conduct a rigorous diagnostic assessment based on visual evidence (uploaded photographs, chronological video frames extracted at 1 frame per second from diagnostic clips) and any user-provided symptom description.

Evaluate hardware physical integrity, motherboard components, display defects (backlight bleed, stage lighting, panel cracks, flex cable damage, GPU artifacting), thermal indicators (vent blockage, thermal pad degradation, burnt ICs), port and chassis damage, battery swelling, power/charging LEDs, and software/firmware indicators (BSOD bugchecks, kernel panic logs, UEFI/BIOS error codes, blinking LED diagnostic codes).

You MUST format your diagnostic report with the following 5 distinct sections and headers:

### 1. Observed Symptoms & Physical Anomalies
- Provide an itemized, precise analysis of all visual and physical anomalies observed in the photos and video frames.
- Correlate visual findings with any user-reported symptoms.
- Point out any specific components, ports, screen regions, or indicators involved.

### 2. Likely Root Cause
- Deliver an in-depth technical explanation of the primary root cause (distinguishing clearly between hardware component failure, firmware/BIOS corruption, thermal throttling, GPU failure, loose interconnect, or OS/driver corruption).
- Identify potential secondary or cascading damage that should be inspected.

### 3. Diagnostic Confidence (High/Med/Low)
- State the overall confidence rating explicitly: [High / Med / Low]
- Justify the confidence level technically. Note what cannot be confirmed purely from visual inspection and would require bench equipment (multimeter, thermal imager, schematics, boardview).

### 4. Step-by-Step Fix
#### Phase 1: Non-invasive (Software & Basic Troubleshooting)
- Safe, non-destructive initial steps (e.g., hard EC/SMC reset, external display validation, BIOS defaults reset, clean driver reinstallation, Safe Mode triage, power drain).
#### Phase 2: Hardware repair (Disassembly, Component Replacement & Soldering)
- Physical repair procedure, including required tools (e.g., spudger, JIS/Phillips #00, Torx T5, multimeter, thermal paste, soldering station), component replacement specifications, ribbon cable handling, and torque precautions.

### 5. Safety Warnings
- Explicit, critical precautions to prevent electric shock, motherboard ESD damage, thermal runaway from swollen/punctured lithium-ion batteries, high-voltage capacitor discharge, and glass injury.

Maintain a professional, authoritative, and safety-conscious technician tone. Never skip any of the required sections."""


# Pydantic Models for Response
class InputsSummary(BaseModel):
    images_count: int = Field(description="Number of uploaded static images processed")
    videos_count: int = Field(description="Number of uploaded video files processed")
    frames_extracted: int = Field(description="Total video frames extracted at 1 frame/sec (capped at 10 per video)")
    has_description: bool = Field(description="Whether a text description was provided")


class ParsedSections(BaseModel):
    observed_symptoms: Optional[str] = None
    root_cause: Optional[str] = None
    confidence: Optional[str] = None
    step_by_step_fix: Optional[str] = None
    safety_warnings: Optional[str] = None


class DiagnosisResponse(BaseModel):
    status: str
    model: str
    inputs: InputsSummary
    diagnosis: str
    sections: ParsedSections


def extract_frames_from_video(
    video_bytes: bytes,
    max_frames: int = 10,
    fps_sample_rate: float = 1.0,
    filename_hint: str = "video.mp4",
) -> List[Image.Image]:
    """
    Extracts frames from video bytes at a rate of 1 frame per second,
    capped at max_frames (default: 10 frames), to optimize payload sizes for multimodal LLMs.

    Args:
        video_bytes: Raw bytes of the uploaded video.
        max_frames: Maximum number of frames to extract (cap = 10).
        fps_sample_rate: Frames to sample per second (default = 1.0).
        filename_hint: Used to preserve original file extension for OpenCV container decoding.

    Returns:
        List of PIL.Image objects in RGB format.
    """
    # Determine appropriate extension for OpenCV video container
    _, ext = os.path.splitext(filename_hint)
    if not ext or ext.lower() not in [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"]:
        ext = ".mp4"

    temp_video_path = None
    extracted_frames: List[Image.Image] = []

    try:
        # OpenCV cv2.VideoCapture requires a filesystem path
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_video_file:
            temp_video_file.write(video_bytes)
            temp_video_file.flush()
            temp_video_path = temp_video_file.name

        cap = cv2.VideoCapture(temp_video_path)
        if not cap.isOpened():
            logger.warning(f"Failed to open video file {filename_hint} with OpenCV.")
            return []

        # Read native video frame rate
        native_fps = cap.get(cv2.CAP_PROP_FPS)
        if not native_fps or native_fps <= 0 or math.isnan(native_fps):
            native_fps = 30.0  # standard fallback

        # Calculate interval to capture 1 frame per second
        frame_interval = max(1, int(round(native_fps / fps_sample_rate)))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        logger.info(
            f"Processing video '{filename_hint}': native_fps={native_fps:.2f}, "
            f"total_frames={total_frames}, frame_interval={frame_interval}, max_cap={max_frames}"
        )

        frame_counter = 0
        while cap.isOpened() and len(extracted_frames) < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_counter % frame_interval == 0:
                # Convert BGR (OpenCV) to RGB (PIL)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                extracted_frames.append(pil_image)

            frame_counter += 1

        cap.release()
        logger.info(f"Successfully extracted {len(extracted_frames)} frames from '{filename_hint}'.")

    except Exception as exc:
        logger.error(f"Error extracting frames from video '{filename_hint}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process video file '{filename_hint}': {str(exc)}",
        )
    finally:
        # Guarantee cleanup of temporary file
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except OSError as cleanup_err:
                logger.warning(f"Could not remove temp file {temp_video_path}: {cleanup_err}")

    return extracted_frames


def parse_diagnostic_sections(markdown_text: str) -> ParsedSections:
    """
    Parses the standard 5 sections from the Gemini technician diagnostic output.
    """
    sections = ParsedSections()

    patterns = {
        "observed_symptoms": r"(?:###?\s*(?:1\.?\s*)?Observed Symptoms & Physical Anomalies)(.*?)(?=###?\s*(?:2\.?\s*)?Likely Root Cause|$)",
        "root_cause": r"(?:###?\s*(?:2\.?\s*)?Likely Root Cause)(.*?)(?=###?\s*(?:3\.?\s*)?Diagnostic Confidence|$)",
        "confidence": r"(?:###?\s*(?:3\.?\s*)?Diagnostic Confidence(?:\s*\(High/Med/Low\))?)(.*?)(?=###?\s*(?:4\.?\s*)?Step-by-Step Fix|$)",
        "step_by_step_fix": r"(?:###?\s*(?:4\.?\s*)?Step-by-Step Fix)(.*?)(?=###?\s*(?:5\.?\s*)?Safety Warnings|$)",
        "safety_warnings": r"(?:###?\s*(?:5\.?\s*)?Safety Warnings)(.*?)$",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, markdown_text, re.DOTALL | re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            setattr(sections, key, extracted if extracted else None)

    return sections


@app.get("/")
async def root():
    """Health check and service information."""
    return {
        "service": "Viziguide Multimodal AI Laptop Diagnostics API",
        "version": "1.0.0",
        "docs": "/docs",
        "diagnose_endpoint": "/diagnose",
    }


@app.get("/health")
async def health():
    """Liveness probe."""
    api_key_configured = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "healthy",
        "gemini_api_key_configured": api_key_configured,
        "default_model": os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
    }


@app.post("/diagnose", response_model=DiagnosisResponse)
async def diagnose(
    images: Optional[List[UploadFile]] = File(None, description="One or more laptop photos (JPEG, PNG, WebP)"),
    image: Optional[UploadFile] = File(None, description="Single laptop photo alias"),
    videos: Optional[List[UploadFile]] = File(None, description="One or more diagnostic videos (MP4, MOV, MKV, WebM)"),
    video: Optional[UploadFile] = File(None, description="Single diagnostic video alias"),
    description: Optional[str] = Form(None, description="User symptom description or operational context"),
):
    """
    Multimodal diagnostic endpoint.
    Accepts single or multiple photos, video clips, and an optional problem description.
    Extracts 1 frame per second from uploaded videos (capped at 10 frames per video) using OpenCV,
    and submits all visual evidence to gemini-1.5-pro for expert technician analysis.
    """
    # Verify Gemini API key configuration
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key or gemini_api_key.strip() in ("", "your_gemini_api_key_here"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "GEMINI_API_KEY is not configured. Please set a valid Google Gemini API key "
                "in your .env file or environment variables."
            ),
        )

    # Aggregate images (support both plural 'images' list and singular 'image' alias)
    all_image_files: List[UploadFile] = []
    if images:
        all_image_files.extend([f for f in images if f.filename])
    if image and image.filename:
        all_image_files.append(image)

    # Aggregate videos (support both plural 'videos' list and singular 'video' alias)
    all_video_files: List[UploadFile] = []
    if videos:
        all_video_files.extend([v for v in videos if v.filename])
    if video and video.filename:
        all_video_files.append(video)

    has_description = bool(description and description.strip())

    # Validation: Ensure at least one input is provided
    if not all_image_files and not all_video_files and not has_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image, video, or symptom description must be provided for laptop diagnosis.",
        )

    # 1. Process Uploaded Images
    pil_images: List[Image.Image] = []
    for img_upload in all_image_files:
        try:
            img_bytes = await img_upload.read()
            if not img_bytes:
                continue
            pil_img = Image.open(io.BytesIO(img_bytes))
            pil_img.load()
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            pil_images.append(pil_img)
        except Exception as img_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image file '{img_upload.filename}': {str(img_err)}",
            )

    # 2. Process Uploaded Videos (Extract 1 frame per second, capped at 10 frames per video)
    all_extracted_frames: List[Image.Image] = []
    for vid_upload in all_video_files:
        try:
            vid_bytes = await vid_upload.read()
            if not vid_bytes:
                continue
            frames = extract_frames_from_video(
                video_bytes=vid_bytes,
                max_frames=10,
                fps_sample_rate=1.0,
                filename_hint=vid_upload.filename or "video.mp4",
            )
            all_extracted_frames.extend(frames)
        except HTTPException:
            raise
        except Exception as vid_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process video '{vid_upload.filename}': {str(vid_err)}",
            )

    # 3. Assemble Multimodal Payload for Gemini
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
    logger.info(
        f"Preparing Gemini diagnosis: {len(pil_images)} photos, "
        f"{len(all_extracted_frames)} video frames from {len(all_video_files)} video(s), "
        f"description_provided={has_description}"
    )

    content_parts: List[Any] = []

    # Include user description if provided
    if has_description:
        content_parts.append(
            f"### User-Reported Laptop Problem & Symptoms:\n{description.strip()}\n"
        )

    # Include uploaded static images
    if pil_images:
        content_parts.append(
            f"\n### Static Visual Evidence ({len(pil_images)} photograph{'s' if len(pil_images) > 1 else ''}):\n"
            "Examine each photo for physical trauma, port warping, component burns, cracked traces, or screen defects:"
        )
        content_parts.extend(pil_images)

    # Include extracted video frames
    if all_extracted_frames:
        content_parts.append(
            f"\n### Dynamic Video Evidence ({len(all_extracted_frames)} chronological frame{'s' if len(all_extracted_frames) > 1 else ''} sampled at 1 fps):\n"
            "Analyze chronological sequence for flickering displays, LED blink codes, boot loops, fan spin behavior, or intermittent anomalies:"
        )
        content_parts.extend(all_extracted_frames)

    # If only text was provided without visual evidence, add guidance
    if not pil_images and not all_extracted_frames:
        content_parts.append(
            "Note: No photos or videos were uploaded. Provide the best possible diagnostic assessment "
            "based strictly on the user's reported symptoms and note recommendations for visual inspection."
        )

    # 4. Invoke Google Generative AI SDK
    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=TECHNICIAN_SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                top_p=0.95,
            ),
        )

        response = model.generate_content(content_parts)
        diagnosis_text = response.text if response and hasattr(response, "text") else ""

        if not diagnosis_text:
            raise RuntimeError("Gemini model returned an empty response.")

    except Exception as gemini_err:
        logger.error(f"Gemini API invocation error: {gemini_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Generative AI diagnostic generation failed: {str(gemini_err)}",
        )

    # 5. Parse Sections for Structured Output
    parsed_sections = parse_diagnostic_sections(diagnosis_text)

    return DiagnosisResponse(
        status="success",
        model=model_name,
        inputs=InputsSummary(
            images_count=len(pil_images),
            videos_count=len(all_video_files),
            frames_extracted=len(all_extracted_frames),
            has_description=has_description,
        ),
        diagnosis=diagnosis_text,
        sections=parsed_sections,
    )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)

