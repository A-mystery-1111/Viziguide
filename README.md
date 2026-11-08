# Viziguide — Multimodal AI Hardware & Appliance Diagnostics

> **Practical AI Hardware Diagnosis**: Pretrained Vision-Language Models (Gemini 1.5 Pro) + Verified Service Manuals (RAG) + OpenCV 1 FPS Dynamic Frame Extraction + Safety Guardrails + Continuous Improvement Feedback Loop.

---

## 💡 The Viziguide Methodology

Most of Viziguide **does not require training a model from scratch**. Training from scratch requires massive data and compute. The practical, production-grade approach implemented here is:

| Feature | Approach | Training Needed? |
|---|---|---|
| **Identify product from photo** | Pretrained Vision-Language Model (Gemini 1.5 Pro) | Optional |
| **Detect specific fault** (cracked screen, leaking gasket, stripped coupler) | Gemini Vision + Fine-tuned classifier/detector (EfficientNet / YOLO) | Yes (for specialized edge cases) |
| **Turn manuals into simple steps** | RAG (Retrieval over official manufacturer manuals) + LLM | **No** (Core RAG Pipeline) |
| **Interactive troubleshooting** | Technician System Prompt + RAG | **No** |
| **Safety & Risk Guardrails** | Confidence thresholds & High-risk professional escalation | **No** (Rules & Guardrails) |

---

## 🚀 Key Features

1. **Scoped Product Focus (Step 1)**:
   - 💻 **Laptops & Computers**: Displays, motherboards, batteries, cooling fans.
   - 🌀 **Ceiling Fans**: Run capacitors, motor windings, bearing noise, speed regulators.
   - ⚙️ **Mixer Grinders & Blenders**: Coupler teeth wear, overload switches, carbon brushes.
   - 🧺 **Washing Machines**: Drain pump blockages, drive belts, unbalance sensors, door locks.
   - 📡 **Wi-Fi Routers**: Optical LOS faults, boot loops, overheating, surge damage.
   - 🔍 **Auto-Detect**: Open vision-language classification for arbitrary electronics.

2. **OpenCV 1 FPS Video Frame Extraction**:
   - Automatically samples uploaded diagnostic video clips at **1 frame per second** (capped at 10 frames per video).
   - Captures chronological faults such as status LED blink codes, boot loops, sparking, fan spin, or screen flicker without bloating payload size.

3. **Step 6 & 7 Safety & Confidence Guardrails**:
   - **Confidence Threshold**: Explicitly rates confidence as **High**, **Med**, or **Low**. When confidence is Med/Low, the UI prompts the user to provide a closer, clearer macro photo rather than attempting unconfirmed repairs.
   - **High-Risk Guardrail**: Automatically flags high-risk repairs (mains electricity, 230V/110V, high-voltage capacitors, swollen lithium batteries) and urges users to consult a certified technician via the in-app **"Find a Professional"** escalation tool.

4. **Interactive 2-Phase Fix Checklist**:
   - **Phase 1: Non-invasive (Software & Basic Troubleshooting)** (Safe reset, external monitor, cleaning).
   - **Phase 2: Hardware Repair (Disassembly & Tools Required)** (JIS screwdrivers, multimeter, replacement specs).

5. **Step 9 Continuous Improvement Feedback Loop**:
   - "Was this diagnosis correct?" feedback widget (👍 / 👎).
   - Submits user feedback and actual fault corrections to `POST /feedback`, appending samples to `data/feedback_log.jsonl` for future fine-tuning datasets.

---

## 📁 Project Structure

```
Viziguide/
├── backend/
│   ├── __init__.py
│   └── main.py              # FastAPI app, OpenCV 1 FPS extractor, Gemini 1.5 Pro, static mount
├── frontend/
│   ├── index.html           # Modern responsive diagnostic web application
│   ├── style.css            # Accessible, high-contrast technician styling & print layout
│   └── app.js               # Frontend controller, API client, drag-and-drop & checklist
├── data/
│   └── feedback_log.jsonl   # Step 9 collected feedback dataset for model fine-tuning
├── .env.example             # Template for GEMINI_API_KEY and model configs
├── .gitignore               # Standard Python & environment gitignore
├── requirements.txt         # Dependencies
└── README.md                # Comprehensive documentation
```

---

## 🛠️ Quick Start

### 1. Set Up Virtual Environment

```powershell
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

Copy `.env.example` to `.env`:

```bash
# Windows
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Add your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey):

```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-pro
HOST=0.0.0.0
PORT=8000
```

### 4. Start the Application

```bash
# Run backend (also serves frontend at root http://localhost:8000)
python backend/main.py
```
Or with Uvicorn:
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

- **Open Web Application**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

*(Note: You can also open `frontend/index.html` directly in your browser; it automatically connects to `http://localhost:8000` via CORS).*

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the Viziguide Web Application |
| `GET` | `/health` | Service liveness probe & API key status |
| `GET` | `/products` | List of 5 scoped product categories with common fault references |
| `POST` | `/diagnose` | Multimodal diagnostic engine (photos, video, category, description) |
| `POST` | `/feedback` | Records user feedback to `data/feedback_log.jsonl` (Step 9) |

---

## 🧪 Testing the `/diagnose` Endpoint

### Photos + Description (cURL)

```bash
curl -X POST "http://localhost:8000/diagnose" \
  -F "images=@damaged_screen.jpg" \
  -F "product_category=laptop" \
  -F "description=Laptop screen displays vertical colored lines upon boot. Fan runs at maximum speed."
```

### Video + Description (cURL)

```bash
curl -X POST "http://localhost:8000/diagnose" \
  -F "video=@power_led_blink.mp4" \
  -F "product_category=laptop" \
  -F "description=Power LED blinks 3 amber then 5 white flashes. Laptop won't turn on."
```

---

## 🔮 Roadmap: Fine-Tuning Your Custom Model (Steps 3 to 5)

Once you collect enough real-world failure photos from user uploads (Step 9 feedback log):

1. **Collect Images**: 100–300 images per fault class (e.g. `capacitor_leak`, `burnt_mosfet`, `coupler_stripped`), including normal "no defect" photos.
2. **Label Data**: Use Roboflow, Label Studio, or CVAT with a 70% train / 15% validation / 15% test split.
3. **Transfer Learning**: Fine-tune a pretrained **EfficientNet-B0/B4** or **YOLOv8** on Google Colab GPU.
4. **Deploy**: Wrap the model into the `/diagnose` pipeline to complement Gemini's reasoning.

