import datetime
import io
import json
import logging
import math
import os
import re
import tempfile
import uuid
from typing import Any, Dict, List, Optional

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
    title="Viziguide - Multimodal AI Hardware & Appliance Diagnostics",
    description="Multimodal diagnostic backend using OpenCV and Gemini 1.5 Pro to diagnose laptops, appliances, and electronics with safety guardrails and manual retrieval.",
    version="2.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Scoped Product Knowledge Base (Step 1 & Step 2 of Viziguide philosophy)
SCOPED_PRODUCTS = [
    {
        "id": "laptop",
        "name": "Laptop & Mobile Workstations",
        "category": "Computing",
        "icon": "laptop",
        "common_issues": [
            "Vertical/Horizontal Screen Artifacts & Lines",
            "Swollen Battery / Chassis Bulging",
            "Power LED Blinking Diagnostic Code / No POST",
            "Thermal Throttling / Loud Grinding Fan",
            "Burnt Component / Liquid Spill on Motherboard",
        ],
        "manual_reference": "Official OEM Service & Maintenance Guides (Dell, Lenovo, Apple, HP)",
        "high_risk_triggers": ["swollen battery", "battery puncture", "motherboard short", "inverter capacitor"],
    },
    {
        "id": "ceiling_fan",
        "name": "Ceiling Fan",
        "category": "Home Appliance",
        "icon": "fan",
        "common_issues": [
            "Fan Spins Very Slow (Failed Capacitor)",
            "Loud Humming or Grinding Bearing Noise",
            "Wobbling Blades / Loose Downrod Mount",
            "Completely Dead (Tripped Fuse or Blown Thermal Cutoff)",
            "Speed Regulator Has No Effect",
        ],
        "manual_reference": "Appliance Standards IEC 60335-2-80 Service Instructions",
        "high_risk_triggers": ["mains electricity", "230v", "110v", "live ceiling wiring", "capacitor discharge"],
    },
    {
        "id": "mixer_grinder",
        "name": "Mixer Grinder / Blender",
        "category": "Kitchen Appliance",
        "icon": "blender",
        "common_issues": [
            "Overload Switch Trips Repeatedly",
            "Motor Coupler Teeth Stripped or Broken",
            "Carbon Brushes Worn / Heavy Sparking",
            "Blade Jar Jammed or Leaking Liquid",
            "Burning Plastic / Motor Varnish Odor",
        ],
        "manual_reference": "Small Appliance Universal Motor & Coupler Overhaul Guidelines",
        "high_risk_triggers": ["live motor terminal", "rotor short", "brush fire hazard", "mains shock"],
    },
    {
        "id": "washing_machine",
        "name": "Washing Machine",
        "category": "Heavy Appliance",
        "icon": "washing-machine",
        "common_issues": [
            "OE / E20 Error: Water Not Draining (Pump Clog)",
            "Drum Does Not Spin (Broken Drive Belt / Worn Motor Brushes)",
            "Violent Shaking / UE Unbalance Code (Damaged Shock Absorber)",
            "Water Leaking from Dispenser or Door Gasket",
            "Door Lock Error (Failed Interlock Switch)",
        ],
        "manual_reference": "Direct Drive & Belt Appliance Diagnostics & Error Code Manuals",
        "high_risk_triggers": ["mains wiring near water", "drum capacitor", "motor voltage", "water valve flood"],
    },
    {
        "id": "wifi_router",
        "name": "Wi-Fi Router & Network Gateway",
        "category": "Networking",
        "icon": "wifi",
        "common_issues": [
            "Red/Amber LOS Indicator (Optical / Cable Signal Lost)",
            "Boot Loop / Power LED Flashing Constantly",
            "Overheating / Random Wireless Drops under Load",
            "Corrupted Firmware after Failed Update",
            "Burned Barrel Jack / Voltage Surge from Lightning",
        ],
        "manual_reference": "Standard IEEE 802.11 Enterprise Gateway Troubleshooting Guides",
        "high_risk_triggers": ["power adapter high voltage", "internal capacitor explosion"],
    },
]

# Master Technician System Prompt incorporating Safety Guardrails & Scoped Manual Retrieval
TECHNICIAN_SYSTEM_PROMPT = """You are a certified Master Diagnostic Technician & Systems Engineer for electronics, computers, and home appliances with 20+ years of bench repair experience.
You specialize in five focused product categories:
1. Laptop Computers (motherboards, displays, batteries, thermal cooling)
2. Ceiling Fans (capacitors, bearings, speed regulators, windings)
3. Mixer Grinders (overload protectors, couplers, carbon brushes, motor jars)
4. Washing Machines (drain pumps, drive belts, shock absorbers, door latches)
5. Wi-Fi Routers (firmware, optical LOS, power supply regulators, thermal)

Your mission is to analyze visual evidence (photos, video frames sampled at 1 fps) and user symptoms, identify the product and fault accurately, and produce a safe, rigorous diagnostic report based strictly on verified technical principles and official repair manuals.

CRITICAL SAFETY & GUARDRAIL RULES:
- High-Risk Guardrail: If an issue involves 110V/230V mains electricity, high-voltage capacitors, swollen/punctured lithium-ion batteries, motor rewinding, or hazardous live wiring, you MUST explicitly flag it as HIGH RISK and urge the user to hire a certified professional instead of DIY.
- Confidence Threshold: Clearly rate confidence as [High], [Med], or [Low]. If photos are blurry, lighting is bad, or internal testing (multimeter/oscilloscope) is required, label confidence as Med or Low and tell the user what specific closer photo, angle, or test is needed before attempting repair.
- Step-by-Step Fix: Divide fix into Phase 1 (Non-invasive: basic reset, cleaning, software, external checks) and Phase 2 (Hardware Repair: disassembly, tools required, component replacement). Always list mandatory initial safety steps like "UNPLUG FROM MAINS FIRST".

You MUST strictly format your diagnostic report with the following 6 headers:

### 0. Identified Product & Target Component
- Identified device (e.g., Apple MacBook Air M1, Crompton Ceiling Fan, Preethi Mixer Grinder, LG Front-Load Washer, TP-Link Router).
- Specific component/subassembly affected (e.g., Display LVDS Cable, Motor Run Capacitor, Drain Pump Impeller).

### 1. Observed Symptoms & Physical Anomalies
- Itemized breakdown of all visible physical signs in the photos and video frames (e.g., thermal discoloration, stripped coupler teeth, status LED blink pattern, cracked LCD substrate, water leakage residue).
- Correlation with the user's reported description.

### 2. Likely Root Cause
- Deep technical root-cause analysis distinguishing between mechanical wear, electrical breakdown, thermal stress, or firmware/software faults.
- Identify potential secondary damage to inspect.

### 3. Diagnostic Confidence (High/Med/Low)
- State confidence explicitly: "Diagnostic Confidence: [High | Med | Low]"
- Provide technical justification for this rating. If Low or Med, state what additional photo angle or physical multimeter measurement is needed.

### 4. Step-by-Step Fix
#### Phase 1: Non-invasive (Software & Basic Troubleshooting)
- Safe, non-destructive initial steps (e.g., reset procedure, external check, clearing debris).
#### Phase 2: Hardware repair (Disassembly, Component Replacement & Tools)
- Clear repair instructions including required tools (e.g., JIS screwdriver, multimeter, soldering iron, spudger, socket wrench), part specifications, and reassembly precautions.

### 5. Safety Warnings & Risk Level
- State Risk Level: [LOW RISK - DIY SAFE | MEDIUM RISK - PROCEED WITH CAUTION | HIGH RISK - PROFESSIONAL REQUIRED]
- Clear bulleted safety rules (e.g., disconnect mains plug, discharge capacitor, wear eye protection, ESD grounding).
- If HIGH RISK, explicitly instruct the user to consult a licensed technician."""


# Pydantic Models for Response
class InputsSummary(BaseModel):
    product_hint: Optional[str] = Field(default=None, description="User-selected product category")
    images_count: int = Field(description="Number of uploaded static images processed")
    videos_count: int = Field(description="Number of uploaded video files processed")
    frames_extracted: int = Field(description="Total video frames extracted at 1 frame/sec")
    has_description: bool = Field(description="Whether a text description was provided")


class ParsedSections(BaseModel):
    identified_product: Optional[str] = None
    observed_symptoms: Optional[str] = None
    root_cause: Optional[str] = None
    confidence: Optional[str] = None
    confidence_level: str = "Med"  # High, Med, Low
    is_high_risk: bool = False
    risk_level: str = "MEDIUM RISK"
    step_by_step_fix: Optional[str] = None
    safety_warnings: Optional[str] = None


class DiagnosisResponse(BaseModel):
    status: str
    model: str
    inputs: InputsSummary
    diagnosis: str
    sections: ParsedSections


class FeedbackRequest(BaseModel):
    diagnosis_id: Optional[str] = None
    product: Optional[str] = None
    is_correct: bool
    confidence_was: Optional[str] = None
    user_notes: Optional[str] = None
    actual_issue: Optional[str] = None


def extract_frames_from_video(
    video_bytes: bytes,
    max_frames: int = 10,
    fps_sample_rate: float = 1.0,
    filename_hint: str = "video.mp4",
) -> List[Image.Image]:
    """
    Extracts frames from video bytes at 1 frame per second, capped at max_frames (10 frames),
    to keep multimodal payload sizes optimized while capturing dynamic faults.
    """
    _, ext = os.path.splitext(filename_hint)
    if not ext or ext.lower() not in [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"]:
        ext = ".mp4"

    temp_video_path = None
    extracted_frames: List[Image.Image] = []

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_video_file:
            temp_video_file.write(video_bytes)
            temp_video_file.flush()
            temp_video_path = temp_video_file.name

        cap = cv2.VideoCapture(temp_video_path)
        if not cap.isOpened():
            logger.warning(f"Failed to open video file {filename_hint} with OpenCV.")
            return []

        native_fps = cap.get(cv2.CAP_PROP_FPS)
        if not native_fps or native_fps <= 0 or math.isnan(native_fps):
            native_fps = 30.0

        frame_interval = max(1, int(round(native_fps / fps_sample_rate)))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        logger.info(
            f"Processing video '{filename_hint}': fps={native_fps:.2f}, "
            f"frames={total_frames}, interval={frame_interval}, max_cap={max_frames}"
        )

        frame_counter = 0
        while cap.isOpened() and len(extracted_frames) < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_counter % frame_interval == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                extracted_frames.append(pil_image)

            frame_counter += 1

        cap.release()
        logger.info(f"Extracted {len(extracted_frames)} frames from '{filename_hint}'.")

    except Exception as exc:
        logger.error(f"Error extracting video frames: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process video file '{filename_hint}': {str(exc)}",
        )
    finally:
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except OSError as cleanup_err:
                logger.warning(f"Could not remove temp file {temp_video_path}: {cleanup_err}")

    return extracted_frames


def parse_diagnostic_sections(markdown_text: str) -> ParsedSections:
    """
    Parses sections, confidence rating, and safety risk levels from the technician report.
    """
    sections = ParsedSections()

    patterns = {
        "identified_product": r"(?:###?\s*(?:0\.?\s*)?Identified Product & Target Component)(.*?)(?=###?\s*(?:1\.?\s*)?Observed Symptoms|$)",
        "observed_symptoms": r"(?:###?\s*(?:1\.?\s*)?Observed Symptoms & Physical Anomalies)(.*?)(?=###?\s*(?:2\.?\s*)?Likely Root Cause|$)",
        "root_cause": r"(?:###?\s*(?:2\.?\s*)?Likely Root Cause)(.*?)(?=###?\s*(?:3\.?\s*)?Diagnostic Confidence|$)",
        "confidence": r"(?:###?\s*(?:3\.?\s*)?Diagnostic Confidence(?:\s*\(High/Med/Low\))?)(.*?)(?=###?\s*(?:4\.?\s*)?Step-by-Step Fix|$)",
        "step_by_step_fix": r"(?:###?\s*(?:4\.?\s*)?Step-by-Step Fix)(.*?)(?=###?\s*(?:5\.?\s*)?Safety Warnings|$)",
        "safety_warnings": r"(?:###?\s*(?:5\.?\s*)?Safety Warnings & Risk Level)(.*?)$",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, markdown_text, re.DOTALL | re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            setattr(sections, key, extracted if extracted else None)

    # Determine confidence level
    conf_text = (sections.confidence or "") + " " + markdown_text[:800]
    if re.search(r"\bhigh\b", conf_text, re.IGNORECASE):
        sections.confidence_level = "High"
    elif re.search(r"\blow\b", conf_text, re.IGNORECASE):
        sections.confidence_level = "Low"
    else:
        sections.confidence_level = "Med"

    # Determine High-Risk Guardrail
    high_risk_keywords = [
        "high risk",
        "professional required",
        "certified technician",
        "mains voltage",
        "220v",
        "230v",
        "240v",
        "electrocution",
        "thermal runaway",
        "swollen battery",
        "high-voltage capacitor",
        "fire hazard",
    ]
    check_text = (sections.safety_warnings or "") + " " + markdown_text
    is_high = any(kw in check_text.lower() for kw in high_risk_keywords)
    sections.is_high_risk = is_high
    if is_high:
        sections.risk_level = "HIGH RISK - PROFESSIONAL REQUIRED"
    elif "medium risk" in check_text.lower():
        sections.risk_level = "MEDIUM RISK - PROCEED WITH CAUTION"
    else:
        sections.risk_level = "LOW RISK - DIY SAFE"

    return sections


# API Endpoints
@app.get("/health")
async def health():
    """Liveness probe and system status."""
    api_key_configured = bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here")
    return {
        "status": "healthy",
        "gemini_api_key_configured": api_key_configured,
        "default_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        "scoped_products_count": len(SCOPED_PRODUCTS),
    }


@app.get("/products")
async def get_products():
    """Returns the narrow-scoped supported products and common faults for RAG guidance."""
    return {"products": SCOPED_PRODUCTS}


@app.post("/feedback")
async def record_feedback(feedback: FeedbackRequest):
    """
    Step 9: Improve over time.
    Collects user feedback on diagnosis accuracy to build the fine-tuning dataset.
    """
    feedback_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "product": feedback.product,
        "is_correct": feedback.is_correct,
        "confidence_was": feedback.confidence_was,
        "user_notes": feedback.user_notes,
        "actual_issue": feedback.actual_issue,
    }

    try:
        feedback_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        os.makedirs(feedback_dir, exist_ok=True)
        feedback_file = os.path.join(feedback_dir, "feedback_log.jsonl")
        with open(feedback_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(feedback_entry) + "\n")
        logger.info(f"Recorded diagnosis feedback: is_correct={feedback.is_correct}, product={feedback.product}")
    except Exception as e:
        logger.warning(f"Could not append to feedback log: {e}")

    return {
        "status": "success",
        "message": "Thank you! Your feedback helps fine-tune Viziguide's fault diagnostic models.",
        "feedback_id": feedback_entry["id"],
    }


@app.post("/diagnose", response_model=DiagnosisResponse)
async def diagnose(
    images: Optional[List[UploadFile]] = File(None, description="One or more equipment photos"),
    image: Optional[UploadFile] = File(None, description="Single photo alias"),
    videos: Optional[List[UploadFile]] = File(None, description="One or more diagnostic videos"),
    video: Optional[UploadFile] = File(None, description="Single video alias"),
    product_category: Optional[str] = Form(None, description="Optional scoped product selection"),
    description: Optional[str] = Form(None, description="User symptom description or operational context"),
):
    """
    Multimodal diagnostic endpoint.
    Accepts photos, video clips, product category hint, and symptom descriptions.
    Extracts 1 frame/sec from videos (capped at 10 frames), applies Gemini 1.5 Pro,
    and returns a structured technical report with safety guardrails.
    """
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key or gemini_api_key.strip() in ("", "your_gemini_api_key_here"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "GEMINI_API_KEY is not configured. Please set a valid Google Gemini API key "
                "in your .env file."
            ),
        )

    # Aggregate images
    all_image_files: List[UploadFile] = []
    if images:
        all_image_files.extend([f for f in images if f.filename])
    if image and image.filename:
        all_image_files.append(image)

    # Aggregate videos
    all_video_files: List[UploadFile] = []
    if videos:
        all_video_files.extend([v for v in videos if v.filename])
    if video and video.filename:
        all_video_files.append(video)

    has_description = bool(description and description.strip())

    if not all_image_files and not all_video_files and not has_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one photo, video, or symptom description must be provided for diagnosis.",
        )

    # 1. Process Photos
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

    # 2. Process Videos (1 FPS, max 10 frames per video)
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

    # 3. Assemble Multimodal Prompt
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    content_parts: List[Any] = []

    # Category / Scoped context
    scope_context = ""
    if product_category and product_category.lower() != "auto":
        matching = next((p for p in SCOPED_PRODUCTS if p["id"] == product_category.lower()), None)
        if matching:
            scope_context = (
                f"\nScoped Product Category: {matching['name']} ({matching['category']})\n"
                f"Verified Manual Reference: {matching['manual_reference']}\n"
                f"Common Fault Reference: {', '.join(matching['common_issues'])}\n"
            )

    if scope_context or has_description:
        user_text = "### Diagnostic Request & Reported Context:\n"
        if scope_context:
            user_text += scope_context
        if has_description:
            user_text += f"\nUser Symptom Description:\n{description.strip()}\n"
        content_parts.append(user_text)

    # Static images
    if pil_images:
        content_parts.append(
            f"\n### Static Evidence ({len(pil_images)} photograph{'s' if len(pil_images) > 1 else ''}):\n"
            "Examine carefully for physical damage, burnt traces, cracks, stripped couplers, or leak stains:"
        )
        content_parts.extend(pil_images)

    # Extracted video frames
    if all_extracted_frames:
        content_parts.append(
            f"\n### Dynamic Evidence ({len(all_extracted_frames)} chronological video frames sampled at 1 fps):\n"
            "Analyze chronological sequence for blink codes, sparking, wobble, boot loops, or flickering:"
        )
        content_parts.extend(all_extracted_frames)

    if not pil_images and not all_extracted_frames:
        content_parts.append(
            "Note: No photos or videos were uploaded. Provide the best possible diagnostic assessment "
            "based strictly on reported symptoms, verified manual troubleshooting, and note clear visual inspection instructions."
        )

    # 4. Generate diagnosis with Gemini (with transport='rest' and fallback candidate models)
    genai.configure(api_key=gemini_api_key, transport="rest")

    candidate_models = [model_name]
    for fallback in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    response = None
    used_model = model_name
    last_err = None

    for candidate in candidate_models:
        try:
            logger.info(f"Attempting diagnosis with Gemini model: {candidate}")
            model = genai.GenerativeModel(
                model_name=candidate,
                system_instruction=TECHNICIAN_SYSTEM_PROMPT,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    top_p=0.95,
                ),
            )
            response = model.generate_content(content_parts)
            if response and hasattr(response, "text") and response.text:
                used_model = candidate
                logger.info(f"Successfully generated diagnosis with model: {used_model}")
                break
        except Exception as candidate_err:
            last_err = candidate_err
            logger.warning(f"Model '{candidate}' failed: {candidate_err}. Trying next candidate...")
            continue

    diagnosis_text = response.text if response and hasattr(response, "text") else ""

    if not diagnosis_text:
        logger.error(f"All candidate Gemini models failed. Last error: {last_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI diagnostic generation failed: {str(last_err)}",
        )

    # 5. Parse Sections & Safety Flags
    parsed_sections = parse_diagnostic_sections(diagnosis_text)

    return DiagnosisResponse(
        status="success",
        model=used_model,
        inputs=InputsSummary(
            product_hint=product_category,
            images_count=len(pil_images),
            videos_count=len(all_video_files),
            frames_extracted=len(all_extracted_frames),
            has_description=has_description,
        ),
        diagnosis=diagnosis_text,
        sections=parsed_sections,
    )


# Mount Frontend statically if directory exists
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
