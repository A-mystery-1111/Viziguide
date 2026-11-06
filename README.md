# Viziguide - Multimodal AI Laptop Hardware & Software Diagnostics

An AI-powered diagnostic backend for diagnosing laptop hardware and software problems using uploaded photos and diagnostic videos. Powered by **FastAPI**, **OpenCV**, and **Google Gemini 1.5 Pro**.

---

## 🚀 Key Features

- **Multimodal Analysis**: Accepts single or multiple images (photos of motherboards, ports, screens, chassis), diagnostic videos, and user-provided problem descriptions.
- **OpenCV Video Frame Extraction**: Automatically extracts **1 frame per second** from uploaded videos, strictly **capped at 10 frames per video** to keep payload sizes optimized while capturing chronological anomalies (e.g., LED blink codes, boot loops, screen flicker).
- **Gemini 1.5 Pro Technician System Prompt**: Leverages Google's flagship multimodal model instructed as a certified Master Laptop Technician to output:
  1. **Observed Symptoms & Physical Anomalies**
  2. **Likely Root Cause**
  3. **Diagnostic Confidence (High/Med/Low)**
  4. **Step-by-Step Fix (Phase 1: Non-invasive / Phase 2: Hardware repair)**
  5. **Safety Warnings**
- **Structured & Markdown Responses**: Returns both the full markdown diagnostic report and structured parsed sections for frontend consumption.
- **CORS Enabled**: Ready for frontend integrations (React, Next.js, Vue, or plain HTML/JS).

---

## 📁 Project Structure

```
Viziguide/
├── backend/
│   ├── __init__.py
│   └── main.py            # FastAPI app, OpenCV extraction, Gemini integration
├── .env.example           # Environment template for Gemini API key and configs
├── .gitignore             # Standard Python and environment gitignore
├── requirements.txt       # Project dependencies
└── README.md              # Documentation and usage guide
```

---

## 🛠️ Quick Start

### 1. Create a Virtual Environment

```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API Key

Copy the `.env.example` file to `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Edit `.env` and add your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey):

```env
GEMINI_API_KEY=AIzaSy...your_actual_key_here
GEMINI_MODEL=gemini-1.5-pro
HOST=0.0.0.0
PORT=8000
```

### 4. Run the Backend Server

```bash
# Option A: Run directly with Python
python backend/main.py

# Option B: Run via Uvicorn CLI
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at `http://localhost:8000`.

---

## 📖 API Documentation

Once the server is running, visit:
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service info and root health probe |
| `GET` | `/health` | Liveness check & API key status check |
| `POST` | `/diagnose` | Core multimodal diagnostic endpoint |

---

## 🧪 Testing the `/diagnose` Endpoint

### Example 1: Photos + Description (cURL)

```bash
curl -X POST "http://localhost:8000/diagnose" \
  -F "images=@laptop_screen_defect.jpg" \
  -F "images=@motherboard_damage.jpg" \
  -F "description=Laptop screen displays vertical green and magenta lines upon boot. Fan spins at maximum speed."
```

### Example 2: Video + Description (cURL)

```bash
curl -X POST "http://localhost:8000/diagnose" \
  -F "video=@boot_loop_power_led.mp4" \
  -F "description=Dell XPS 13 does not turn on. Power LED blinks 3 amber then 5 white flashes."
```

### Example 3: Python Client Request

```python
import requests

url = "http://localhost:8000/diagnose"

files = [
    ("images", ("screen.jpg", open("screen.jpg", "rb"), "image/jpeg")),
    ("videos", ("boot_blink.mp4", open("boot_blink.mp4", "rb"), "video/mp4")),
]
data = {
    "description": "Lenovo ThinkPad X1 Carbon has no display on power on, but keyboard backlights pulse."
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

---

## 📋 Response Schema

```json
{
  "status": "success",
  "model": "gemini-1.5-pro",
  "inputs": {
    "images_count": 1,
    "videos_count": 1,
    "frames_extracted": 10,
    "has_description": true
  },
  "diagnosis": "### 1. Observed Symptoms & Physical Anomalies\n...\n### 2. Likely Root Cause\n...\n### 3. Diagnostic Confidence (High/Med/Low)\n...\n### 4. Step-by-Step Fix\n...\n### 5. Safety Warnings\n...",
  "sections": {
    "observed_symptoms": "...",
    "root_cause": "...",
    "confidence": "High...",
    "step_by_step_fix": "#### Phase 1: Non-invasive...\n#### Phase 2: Hardware repair...",
    "safety_warnings": "..."
  }
}
```

---

## 🛡️ Frame Extraction Technical Details

- **Sampling**: `1 FPS` (`frame_interval = max(1, round(fps / 1.0))`)
- **Safety Cap**: `10 frames` maximum per video to optimize multimodal payload size and minimize latency.
- **Color Correction**: Automatically converts OpenCV's default BGR color space to RGB before passing PIL Image instances to the Gemini SDK.
- **Resource Cleanup**: Uses temporary files with atomic deletion in a `finally` block to prevent disk bloat.

