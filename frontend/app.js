/**
 * Viziguide — Multimodal AI Diagnostics Application Engine
 * Integrates frontend with FastAPI /diagnose, /health, /products, and /feedback endpoints.
 */

// Determine API Base URL (relative if served by FastAPI, absolute fallback if file:// or alternate port)
const API_BASE = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? ""
  : "http://localhost:8000";

// Fallback product presets matching Step 1 of Viziguide philosophy
const DEFAULT_PRODUCTS = {
  laptop: {
    name: "Laptop & Computing",
    issues: [
      "Vertical/Horizontal Screen Artifacts & Lines",
      "Swollen Battery / Chassis Bulging",
      "Power LED Blinking Diagnostic Code / No POST",
      "Thermal Throttling / Grinding Fan Noise",
      "Burnt Component / Liquid Spill on Motherboard"
    ]
  },
  ceiling_fan: {
    name: "Ceiling Fan",
    issues: [
      "Fan Spins Very Slow (Failed Capacitor)",
      "Loud Humming / Grinding Bearing Noise",
      "Wobbling Blades / Loose Downrod Mount",
      "Completely Dead (Tripped Cutoff / Fuse)",
      "Speed Regulator Has No Effect"
    ]
  },
  mixer_grinder: {
    name: "Mixer Grinder / Blender",
    issues: [
      "Overload Switch Trips Repeatedly",
      "Motor Coupler Teeth Stripped or Broken",
      "Carbon Brushes Worn / Heavy Sparking",
      "Blade Jar Jammed or Leaking Liquid",
      "Burning Plastic / Motor Varnish Odor"
    ]
  },
  washing_machine: {
    name: "Washing Machine",
    issues: [
      "OE / E20 Error: Water Not Draining (Pump Clog)",
      "Drum Does Not Spin (Broken Drive Belt / Worn Brushes)",
      "Violent Shaking / UE Unbalance Code (Damaged Damper)",
      "Water Leaking from Dispenser or Door Gasket",
      "Door Lock Error (Failed Interlock Switch)"
    ]
  },
  wifi_router: {
    name: "Wi-Fi Router & Gateway",
    issues: [
      "Red/Amber LOS Indicator (Optical Link Lost)",
      "Boot Loop / Power LED Flashing Constantly",
      "Overheating / Random Wireless Drops under Load",
      "Corrupted Firmware after Failed Update",
      "Burned Barrel Jack / Voltage Surge from Lightning"
    ]
  },
  auto: {
    name: "Auto-Detect Product",
    issues: [
      "Equipment completely unresponsive to power",
      "Burn mark or physical fracture visible",
      "Intermittent operation under load",
      "Abnormal vibration or loud buzzing"
    ]
  }
};

// Application State
let selectedPhotos = [];
let selectedVideo = null;
let currentDiagnosisData = null;
let selectedFeedbackIsCorrect = null;

// DOM Elements
const systemStatusEl = document.getElementById("systemStatus");
const statusTextEl = document.getElementById("statusText");
const diagnoseForm = document.getElementById("diagnoseForm");
const productPillsContainer = document.getElementById("productPills");
const selectedProductCategoryInput = document.getElementById("selectedProductCategory");
const quickChipsContainer = document.getElementById("quickChips");
const photoDropzone = document.getElementById("photoDropzone");
const photoInput = document.getElementById("photoInput");
const photoPreviewGrid = document.getElementById("photoPreviewGrid");
const videoDropzone = document.getElementById("videoDropzone");
const videoInput = document.getElementById("videoInput");
const videoPreviewWrapper = document.getElementById("videoPreviewWrapper");
const videoPreview = document.getElementById("videoPreview");
const removeVideoBtn = document.getElementById("removeVideoBtn");
const descriptionInput = document.getElementById("descriptionInput");
const diagnoseBtn = document.getElementById("diagnoseBtn");
const btnText = document.getElementById("btnText");

// Results Elements
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultsContainer = document.getElementById("resultsContainer");
const reportHeaderBadges = document.getElementById("reportHeaderBadges");
const confidenceBadge = document.getElementById("confidenceBadge");
const riskBadge = document.getElementById("riskBadge");
const highRiskAlert = document.getElementById("highRiskAlert");
const lowConfAlert = document.getElementById("lowConfAlert");
const metaMediaCount = document.getElementById("metaMediaCount");
const metaModel = document.getElementById("metaModel");
const metaProduct = document.getElementById("metaProduct");
const fixStepsChecklist = document.getElementById("fixStepsChecklist");
const checklistProgress = document.getElementById("checklistProgress");
const symptomsContent = document.getElementById("symptomsContent");
const rootCauseContent = document.getElementById("rootCauseContent");
const safetyContent = document.getElementById("safetyContent");
const rawReportContent = document.getElementById("rawReportContent");

// Feedback Elements
const feedbackCard = document.getElementById("feedbackCard");
const feedbackCorrectBtn = document.getElementById("feedbackCorrectBtn");
const feedbackIncorrectBtn = document.getElementById("feedbackIncorrectBtn");
const feedbackForm = document.getElementById("feedbackForm");
const feedbackNotesInput = document.getElementById("feedbackNotesInput");
const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
const cancelFeedbackBtn = document.getElementById("cancelFeedbackBtn");
const feedbackSuccess = document.getElementById("feedbackSuccess");

// Action Buttons
const copyReportBtn = document.getElementById("copyReportBtn");
const printReportBtn = document.getElementById("printReportBtn");
const resetDiagnosisBtn = document.getElementById("resetDiagnosisBtn");
const findProBtn = document.getElementById("findProBtn");
const retakeAngleBtn = document.getElementById("retakeAngleBtn");

// Modals & Share Elements
const archModal = document.getElementById("archModal");
const openArchModalBtn = document.getElementById("openArchModalBtn");
const closeArchModalBtn = document.getElementById("closeArchModalBtn");
const proModal = document.getElementById("proModal");
const closeProModalBtn = document.getElementById("closeProModalBtn");

const shareReportBtn = document.getElementById("shareReportBtn");
const headerShareBtn = document.getElementById("headerShareBtn");
const shareModal = document.getElementById("shareModal");
const closeShareModalBtn = document.getElementById("closeShareModalBtn");
const shareWhatsappBtn = document.getElementById("shareWhatsappBtn");
const shareBluetoothBtn = document.getElementById("shareBluetoothBtn");
const shareNativeSheetBtn = document.getElementById("shareNativeSheetBtn");
const shareEmailBtn = document.getElementById("shareEmailBtn");
const shareSummaryInput = document.getElementById("shareSummaryInput");
const copyShareSummaryBtn = document.getElementById("copyShareSummaryBtn");
const sharePreviewDevice = document.getElementById("sharePreviewDevice");
const sharePreviewConf = document.getElementById("sharePreviewConf");
const sharePreviewSnippet = document.getElementById("sharePreviewSnippet");

// Share Website Elements
const shareWebsiteNavBtn = document.getElementById("shareWebsiteNavBtn");
const shareWebsiteHeroBtn = document.getElementById("shareWebsiteHeroBtn");
const shareWebsiteModal = document.getElementById("shareWebsiteModal");
const closeShareWebsiteModalBtn = document.getElementById("closeShareWebsiteModalBtn");
const shareWebsiteWhatsappBtn = document.getElementById("shareWebsiteWhatsappBtn");
const shareWebsiteBluetoothBtn = document.getElementById("shareWebsiteBluetoothBtn");
const shareWebsiteNativeBtn = document.getElementById("shareWebsiteNativeBtn");
const shareWebsiteEmailBtn = document.getElementById("shareWebsiteEmailBtn");
const shareWebsiteUrlInput = document.getElementById("shareWebsiteUrlInput");
const copyWebsiteUrlBtn = document.getElementById("copyWebsiteUrlBtn");

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  setupProductPills();
  setupQuickChips("laptop");
  setupFileHandlers();
  setupTabs();
  setupFeedbackHandlers();
  setupModals();
  setupShareHandlers();
  setupWebsiteShareHandlers();
});

/* --------------------------------------------------------------------------
   1. Backend Connectivity & Health Check
   -------------------------------------------------------------------------- */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Health check failed");
    const data = await res.json();
    
    if (data.gemini_api_key_configured) {
      systemStatusEl.querySelector(".status-dot").className = "status-dot online";
      statusTextEl.textContent = `Online (${data.default_model || "Gemini 1.5 Pro"})`;
    } else {
      systemStatusEl.querySelector(".status-dot").className = "status-dot error";
      statusTextEl.textContent = "API Key Missing in .env";
    }
  } catch (err) {
    console.warn("Backend not detected on default port:", err);
    systemStatusEl.querySelector(".status-dot").className = "status-dot error";
    statusTextEl.textContent = "Backend Offline (Port 8000)";
  }
}

/* --------------------------------------------------------------------------
   2. Scoped Product Selection & Common Fault Chips (Steps 1 & 2)
   -------------------------------------------------------------------------- */
function setupProductPills() {
  const pills = productPillsContainer.querySelectorAll(".product-pill");
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      const category = pill.getAttribute("data-category");
      selectedProductCategoryInput.value = category;
      setupQuickChips(category);
    });
  });
}

function setupQuickChips(category) {
  quickChipsContainer.innerHTML = "";
  const info = DEFAULT_PRODUCTS[category] || DEFAULT_PRODUCTS.auto;
  
  info.issues.forEach((issue) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = issue;
    chip.addEventListener("click", () => {
      if (descriptionInput.value.trim().length > 0) {
        descriptionInput.value += `\n- Observed: ${issue}`;
      } else {
        descriptionInput.value = `Observed: ${issue}.`;
      }
      descriptionInput.focus();
    });
    quickChipsContainer.appendChild(chip);
  });
}

/* --------------------------------------------------------------------------
   3. File Uploads (Drag & Drop, Previews, OpenCV Framing)
   -------------------------------------------------------------------------- */
function setupFileHandlers() {
  // Photo input change
  photoInput.addEventListener("change", (e) => {
    handlePhotoFiles(Array.from(e.target.files));
  });

  // Photo drag & drop
  ["dragenter", "dragover"].forEach((eventName) => {
    photoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      photoDropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    photoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      photoDropzone.classList.remove("dragover");
    });
  });

  photoDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const imgFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      handlePhotoFiles(imgFiles);
    }
  });

  // Video input change
  videoInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleVideoFile(e.target.files[0]);
    }
  });

  // Video drag & drop
  ["dragenter", "dragover"].forEach((eventName) => {
    videoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      videoDropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    videoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      videoDropzone.classList.remove("dragover");
    });
  });

  videoDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const vidFile = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("video/"));
      if (vidFile) handleVideoFile(vidFile);
    }
  });

  removeVideoBtn.addEventListener("click", () => {
    selectedVideo = null;
    videoInput.value = "";
    videoPreview.pause();
    videoPreview.src = "";
    videoPreviewWrapper.style.display = "none";
    videoDropzone.style.display = "block";
  });
}

function handlePhotoFiles(files) {
  files.forEach((file) => {
    if (!selectedPhotos.some((p) => p.name === file.name && p.size === file.size)) {
      selectedPhotos.push(file);
    }
  });
  renderPhotoPreviews();
}

function renderPhotoPreviews() {
  photoPreviewGrid.innerHTML = "";
  selectedPhotos.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "preview-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    const btnRemove = document.createElement("button");
    btnRemove.className = "btn-remove-thumb";
    btnRemove.innerHTML = "&times;";
    btnRemove.title = "Remove image";
    btnRemove.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedPhotos.splice(index, 1);
      renderPhotoPreviews();
    });

    item.appendChild(img);
    item.appendChild(btnRemove);
    photoPreviewGrid.appendChild(item);
  });
}

function handleVideoFile(file) {
  selectedVideo = file;
  videoPreview.src = URL.createObjectURL(file);
  videoDropzone.style.display = "none";
  videoPreviewWrapper.style.display = "block";
}

/* --------------------------------------------------------------------------
   4. Diagnosis Submission & Multistage Progress
   -------------------------------------------------------------------------- */
diagnoseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  const category = selectedProductCategoryInput.value;

  if (selectedPhotos.length === 0 && !selectedVideo && description.length === 0) {
    alert("Please provide at least one photo, video, or symptom description.");
    return;
  }

  // Switch UI to loading state
  emptyState.style.display = "none";
  resultsContainer.style.display = "none";
  loadingState.style.display = "block";
  diagnoseBtn.disabled = true;
  btnText.textContent = "Analyzing Diagnostics...";

  // Animate progress steps
  runProgressSimulation();

  try {
    const formData = new FormData();
    selectedPhotos.forEach((photo) => {
      formData.append("images", photo);
    });

    if (selectedVideo) {
      formData.append("video", selectedVideo);
    }

    if (category) {
      formData.append("product_category", category);
    }

    if (description) {
      formData.append("description", description);
    }

    const response = await fetch(`${API_BASE}/diagnose`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.detail || `Server responded with status ${response.status}`);
    }

    const result = await response.json();
    currentDiagnosisData = result;

    renderDiagnosisResults(result);
  } catch (error) {
    console.error("Diagnosis request failed:", error);
    alert(`Diagnosis Error: ${error.message}`);
    loadingState.style.display = "none";
    emptyState.style.display = "block";
  } finally {
    diagnoseBtn.disabled = false;
    btnText.textContent = "Analyze Visuals & Diagnose";
  }
});

function runProgressSimulation() {
  const stepUpload = document.getElementById("stepUpload");
  const stepFrames = document.getElementById("stepFrames");
  const stepGemini = document.getElementById("stepGemini");
  const stepGuardrails = document.getElementById("stepGuardrails");
  const title = document.getElementById("loadingStageTitle");
  const desc = document.getElementById("loadingStageDesc");

  [stepUpload, stepFrames, stepGemini, stepGuardrails].forEach((s) => s.classList.remove("active"));
  stepUpload.classList.add("active");
  title.textContent = "Uploading Equipment Evidence...";
  desc.textContent = "Streaming visual payload to secure diagnostic server...";

  setTimeout(() => {
    if (loadingState.style.display !== "none") {
      stepFrames.classList.add("active");
      title.textContent = "OpenCV 1 FPS Frame Extraction...";
      desc.textContent = "Sampling dynamic video frames chronologically (capped at 10 frames)...";
    }
  }, 900);

  setTimeout(() => {
    if (loadingState.style.display !== "none") {
      stepGemini.classList.add("active");
      title.textContent = "Gemini 1.5 Pro Multimodal Inspection...";
      desc.textContent = "Cross-referencing verified repair manuals and analyzing physical anomalies...";
    }
  }, 2200);

  setTimeout(() => {
    if (loadingState.style.display !== "none") {
      stepGuardrails.classList.add("active");
      title.textContent = "Evaluating Safety Guardrails...";
      desc.textContent = "Assessing confidence threshold and detecting high-risk voltages...";
    }
  }, 3800);
}

/* --------------------------------------------------------------------------
   5. Results Rendering & Interactive Checklist
   -------------------------------------------------------------------------- */
function renderDiagnosisResults(data) {
  loadingState.style.display = "none";
  resultsContainer.style.display = "block";
  reportHeaderBadges.style.display = "flex";

  const { inputs, sections, diagnosis, model } = data;

  // Confidence Badge & Low-Confidence Guardrail (Step 6)
  const confLevel = sections.confidence_level || "Med";
  confidenceBadge.textContent = `Confidence: ${confLevel}`;
  confidenceBadge.className = `confidence-badge ${confLevel.toLowerCase()}`;

  if (confLevel === "Low" || confLevel === "Med") {
    lowConfAlert.style.display = "flex";
  } else {
    lowConfAlert.style.display = "none";
  }

  // Risk Badge & High-Risk Guardrail (Step 7)
  const isHighRisk = sections.is_high_risk;
  riskBadge.textContent = sections.risk_level || "MEDIUM RISK";
  riskBadge.className = `risk-badge ${isHighRisk ? "high-risk" : "low-risk"}`;

  if (isHighRisk) {
    highRiskAlert.style.display = "flex";
  } else {
    highRiskAlert.style.display = "none";
  }

  // Meta strip
  metaMediaCount.textContent = `${inputs.images_count} photos, ${inputs.frames_extracted} video frames`;
  metaModel.textContent = model || "gemini-1.5-pro";
  metaProduct.textContent = sections.identified_product
    ? cleanMarkdownText(sections.identified_product).slice(0, 50)
    : "Identified in Report";

  // Render tabs content
  renderFixChecklist(sections.step_by_step_fix || diagnosis);
  symptomsContent.innerHTML = formatMarkdown(sections.observed_symptoms || "Refer to Full Report");
  rootCauseContent.innerHTML = formatMarkdown(sections.root_cause || "Refer to Full Report");
  safetyContent.innerHTML = formatMarkdown(sections.safety_warnings || "Refer to Full Report");
  rawReportContent.textContent = diagnosis;

  // Reset feedback widget state
  selectedFeedbackIsCorrect = null;
  feedbackCorrectBtn.classList.remove("active");
  feedbackIncorrectBtn.classList.remove("active");
  feedbackForm.style.display = "none";
  feedbackSuccess.style.display = "none";
}

/* --------------------------------------------------------------------------
   6. Interactive Step-by-Step Fix Checklist
   -------------------------------------------------------------------------- */
function renderFixChecklist(text) {
  fixStepsChecklist.innerHTML = "";

  const lines = text.split("\n");
  const items = [];
  let currentPhase = "";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase().includes("phase 1")) {
      items.push({ type: "header", text: "Phase 1: Non-invasive (Software & Basic Troubleshooting)", phase: 1 });
    } else if (trimmed.toLowerCase().includes("phase 2")) {
      items.push({ type: "header", text: "Phase 2: Hardware Repair (Disassembly & Replacement)", phase: 2 });
    } else if (trimmed.match(/^(\d+\.|\-|\*)\s+/)) {
      const stepText = trimmed.replace(/^(\d+\.|\-|\*)\s+/, "");
      items.push({ type: "step", text: stepText });
    }
  });

  // If no numbered lines found, parse by sentence
  if (items.filter((i) => i.type === "step").length === 0) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
    sentences.forEach((s) => items.push({ type: "step", text: s }));
  }

  let totalSteps = 0;
  let completedSteps = 0;

  items.forEach((item) => {
    if (item.type === "header") {
      const badge = document.createElement("div");
      badge.className = `phase-header-badge phase-${item.phase}-badge`;
      badge.textContent = item.text;
      fixStepsChecklist.appendChild(badge);
    } else {
      totalSteps++;
      const checkItem = document.createElement("div");
      checkItem.className = "check-item";

      const box = document.createElement("div");
      box.className = "check-box-custom";
      box.innerHTML = "✓";

      const label = document.createElement("div");
      label.className = "check-label";
      label.textContent = item.text;

      checkItem.appendChild(box);
      checkItem.appendChild(label);

      checkItem.addEventListener("click", () => {
        checkItem.classList.toggle("completed");
        const done = fixStepsChecklist.querySelectorAll(".check-item.completed").length;
        checklistProgress.textContent = `${done} of ${totalSteps} completed`;
      });

      fixStepsChecklist.appendChild(checkItem);
    }
  });

  checklistProgress.textContent = `0 of ${totalSteps} completed`;
}

/* --------------------------------------------------------------------------
   7. Tabs & Navigation
   -------------------------------------------------------------------------- */
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add("active");
    });
  });
}

/* --------------------------------------------------------------------------
   8. Step 9: Feedback & Continuous Improvement
   -------------------------------------------------------------------------- */
function setupFeedbackHandlers() {
  feedbackCorrectBtn.addEventListener("click", () => {
    selectedFeedbackIsCorrect = true;
    feedbackCorrectBtn.classList.add("active");
    feedbackIncorrectBtn.classList.remove("active");
    feedbackForm.style.display = "block";
    feedbackNotesInput.placeholder = "Great! Any specific tips that helped you succeed?";
  });

  feedbackIncorrectBtn.addEventListener("click", () => {
    selectedFeedbackIsCorrect = false;
    feedbackIncorrectBtn.classList.add("active");
    feedbackCorrectBtn.classList.remove("active");
    feedbackForm.style.display = "block";
    feedbackNotesInput.placeholder = "What was the actual fault? (e.g. Broken solder joint on capacitor pin)";
  });

  cancelFeedbackBtn.addEventListener("click", () => {
    feedbackForm.style.display = "none";
    feedbackCorrectBtn.classList.remove("active");
    feedbackIncorrectBtn.classList.remove("active");
  });

  submitFeedbackBtn.addEventListener("click", async () => {
    const notes = feedbackNotesInput.value.trim();
    try {
      submitFeedbackBtn.disabled = true;
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProductCategoryInput.value,
          is_correct: selectedFeedbackIsCorrect,
          confidence_was: currentDiagnosisData?.sections?.confidence_level || "Med",
          user_notes: notes,
          actual_issue: notes,
        }),
      });

      if (res.ok) {
        feedbackForm.style.display = "none";
        feedbackSuccess.style.display = "block";
      }
    } catch (err) {
      console.warn("Feedback failed:", err);
      feedbackForm.style.display = "none";
      feedbackSuccess.style.display = "block";
    } finally {
      submitFeedbackBtn.disabled = false;
    }
  });
}

/* --------------------------------------------------------------------------
   9. Actions & Modals
   -------------------------------------------------------------------------- */
function setupModals() {
  // Architecture modal
  openArchModalBtn.addEventListener("click", () => {
    archModal.style.display = "flex";
  });

  closeArchModalBtn.addEventListener("click", () => {
    archModal.style.display = "none";
  });

  archModal.addEventListener("click", (e) => {
    if (e.target === archModal) archModal.style.display = "none";
  });

  // Pro modal
  findProBtn.addEventListener("click", () => {
    proModal.style.display = "flex";
  });

  closeProModalBtn.addEventListener("click", () => {
    proModal.style.display = "none";
  });

  proModal.addEventListener("click", (e) => {
    if (e.target === proModal) proModal.style.display = "none";
  });

  // Retake angle helper
  retakeAngleBtn.addEventListener("click", () => {
    photoDropzone.scrollIntoView({ behavior: "smooth" });
    photoDropzone.classList.add("dragover");
    setTimeout(() => photoDropzone.classList.remove("dragover"), 1200);
  });

  // Copy report
  copyReportBtn.addEventListener("click", () => {
    if (!currentDiagnosisData) return;
    navigator.clipboard.writeText(currentDiagnosisData.diagnosis).then(() => {
      const orig = copyReportBtn.innerHTML;
      copyReportBtn.innerHTML = "✓ Copied!";
      setTimeout(() => (copyReportBtn.innerHTML = orig), 2000);
    });
  });

  // Print report
  printReportBtn.addEventListener("click", () => {
    window.print();
  });

  // Reset diagnosis
  resetDiagnosisBtn.addEventListener("click", () => {
    selectedPhotos = [];
    selectedVideo = null;
    photoPreviewGrid.innerHTML = "";
    videoPreview.pause();
    videoPreview.src = "";
    videoPreviewWrapper.style.display = "none";
    videoDropzone.style.display = "block";
    descriptionInput.value = "";
    resultsContainer.style.display = "none";
    reportHeaderBadges.style.display = "none";
    emptyState.style.display = "block";
  });
}

// Active live public deployment link
const LIVE_WEB_URL = "https://chicken-citations-defines-investment.trycloudflare.com";

/* --------------------------------------------------------------------------
   10. Share Handlers (WhatsApp, Bluetooth / Nearby Share, Native Sheet, Email)
   -------------------------------------------------------------------------- */
function generateShareText() {
  if (!currentDiagnosisData) return "Viziguide AI Diagnostic Report";
  const { sections } = currentDiagnosisData;
  const device = sections.identified_product
    ? cleanMarkdownText(sections.identified_product).split("\n")[0]
    : "Hardware / Appliance";
  const conf = sections.confidence_level || "Med";
  const risk = sections.risk_level || "MEDIUM RISK";

  let rootCause = "Check full report";
  if (sections.root_cause) {
    const lines = cleanMarkdownText(sections.root_cause).split("\n").filter((l) => l.trim().length > 5);
    rootCause = lines[0] || rootCause;
  }

  const shareUrl = getWebsiteShareUrl();

  return (
    `🔧 *Viziguide AI Diagnostic Report*\n` +
    `📱 *Device:* ${device}\n` +
    `🎯 *Confidence:* ${conf} | *Risk:* ${risk}\n` +
    `💡 *Likely Root Cause:* ${rootCause}\n\n` +
    `🌐 *View Full Report Online:* ${shareUrl}`
  );
}

function openShareModal() {
  if (!currentDiagnosisData) {
    alert("Please run a diagnosis first to generate a report to share.");
    return;
  }
  const { sections, diagnosis } = currentDiagnosisData;
  const deviceName = sections.identified_product
    ? cleanMarkdownText(sections.identified_product).split("\n")[0].slice(0, 40)
    : "Equipment Diagnostic";

  sharePreviewDevice.textContent = deviceName;
  sharePreviewConf.textContent = `Confidence: ${sections.confidence_level || "Med"}`;

  const snippet = sections.root_cause
    ? cleanMarkdownText(sections.root_cause).slice(0, 140) + "..."
    : cleanMarkdownText(diagnosis).slice(0, 140) + "...";
  sharePreviewSnippet.textContent = snippet;

  const shareText = generateShareText();
  shareSummaryInput.value = shareText;

  shareModal.style.display = "flex";
}

function setupShareHandlers() {
  if (shareReportBtn) {
    shareReportBtn.addEventListener("click", openShareModal);
  }
  if (headerShareBtn) {
    headerShareBtn.addEventListener("click", openShareModal);
  }
  if (closeShareModalBtn) {
    closeShareModalBtn.addEventListener("click", () => {
      shareModal.style.display = "none";
    });
  }
  if (shareModal) {
    shareModal.addEventListener("click", (e) => {
      if (e.target === shareModal) shareModal.style.display = "none";
    });
  }

  // 1. WhatsApp Share
  if (shareWhatsappBtn) {
    shareWhatsappBtn.addEventListener("click", () => {
      let text = generateShareText();
      if (currentDiagnosisData?.sections?.step_by_step_fix) {
        text +=
          "\n\n🛠️ *Fix Steps:*\n" +
          cleanMarkdownText(currentDiagnosisData.sections.step_by_step_fix).slice(0, 500) +
          "...";
      }
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, "_blank");
    });
  }

  // 2. Bluetooth & Nearby Share (Invokes native file share sheet or downloads .txt report)
  if (shareBluetoothBtn) {
    shareBluetoothBtn.addEventListener("click", async () => {
      if (!currentDiagnosisData) return;
      const fullReportText =
        `VIZIGUIDE MULTIMODAL AI DIAGNOSTIC REPORT\n` +
        `Generated: ${new Date().toLocaleString()}\n` +
        `Model: ${currentDiagnosisData.model || "Gemini"}\n` +
        `----------------------------------------\n\n` +
        currentDiagnosisData.diagnosis;

      const blob = new Blob([fullReportText], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], "Viziguide-Diagnostic-Report.txt", { type: "text/plain" });

      // Try native share sheet with file (triggers Bluetooth / Nearby Share on Windows, Android & iOS)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Viziguide Diagnostic Report",
            text: generateShareText(),
            files: [file],
          });
          return;
        } catch (err) {
          if (err.name !== "AbortError") {
            console.warn("Native file share aborted:", err);
          }
        }
      }

      // Download file directly so user can send via Windows Bluetooth / Nearby Sharing
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Viziguide-Diagnostic-Report.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(
        "Diagnostic Report downloaded (Viziguide-Diagnostic-Report.txt)!\n\n" +
          "You can now send it to any Bluetooth device or Nearby Share recipient."
      );
    });
  }

  // 3. System Share Menu (Native OS sheet)
  if (shareNativeSheetBtn) {
    shareNativeSheetBtn.addEventListener("click", async () => {
      const text = generateShareText();
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Viziguide AI Diagnostic Report",
            text: text,
            url: window.location.href,
          });
          shareModal.style.display = "none";
        } catch (err) {
          if (err.name !== "AbortError") {
            console.warn("Share sheet error:", err);
          }
        }
      } else {
        navigator.clipboard.writeText(text);
        alert("Native share menu is not available on this browser. Summary copied to clipboard instead!");
      }
    });
  }

  // 4. Email Report
  if (shareEmailBtn) {
    shareEmailBtn.addEventListener("click", () => {
      if (!currentDiagnosisData) return;
      const deviceTitle = cleanMarkdownText(currentDiagnosisData.sections?.identified_product || "Equipment").slice(0, 40);
      const subject = `Viziguide Diagnostic Report: ${deviceTitle}`;
      const body =
        generateShareText() +
        "\n\n================ FULL REPORT ================\n\n" +
        currentDiagnosisData.diagnosis;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  // 5. Copy Text button
  if (copyShareSummaryBtn) {
    copyShareSummaryBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(shareSummaryInput.value).then(() => {
        const orig = copyShareSummaryBtn.textContent;
        copyShareSummaryBtn.textContent = "✓ Copied!";
        setTimeout(() => (copyShareSummaryBtn.textContent = orig), 2000);
      });
    });
  }
}

/* --------------------------------------------------------------------------
   11. Website Sharing Handlers (WhatsApp, Bluetooth / Nearby Share, Native Sheet, Email)
   -------------------------------------------------------------------------- */
function getWebsiteShareUrl() {
  const hostname = window.location.hostname;
  // If running directly on a public domain/tunnel, use that origin
  if (
    hostname &&
    hostname !== "127.0.0.1" &&
    hostname !== "localhost" &&
    !hostname.startsWith("192.168.") &&
    !hostname.startsWith("10.")
  ) {
    return window.location.origin;
  }
  // If viewing via local browser (127.0.0.1), always share the live public web link
  return LIVE_WEB_URL;
}

function getWebsiteShareText() {
  const shareUrl = getWebsiteShareUrl();
  return (
    `⚡ *Check out Viziguide — Multimodal AI Hardware & Appliance Diagnostics!*\n\n` +
    `Diagnose laptop, ceiling fan, washing machine, mixer, and router problems instantly from uploaded photos & videos with verified step-by-step fix guides.\n\n` +
    `🔗 *Open Link:* ${shareUrl}`
  );
}

function openShareWebsiteModal() {
  const url = getWebsiteShareUrl();
  if (shareWebsiteUrlInput) {
    shareWebsiteUrlInput.value = url;
  }
  if (shareWebsiteModal) {
    shareWebsiteModal.style.display = "flex";
  }
}

function setupWebsiteShareHandlers() {
  if (shareWebsiteNavBtn) {
    shareWebsiteNavBtn.addEventListener("click", openShareWebsiteModal);
  }
  if (shareWebsiteHeroBtn) {
    shareWebsiteHeroBtn.addEventListener("click", openShareWebsiteModal);
  }
  if (closeShareWebsiteModalBtn) {
    closeShareWebsiteModalBtn.addEventListener("click", () => {
      shareWebsiteModal.style.display = "none";
    });
  }
  if (shareWebsiteModal) {
    shareWebsiteModal.addEventListener("click", (e) => {
      if (e.target === shareWebsiteModal) shareWebsiteModal.style.display = "none";
    });
  }

  // 1. WhatsApp Website Share
  if (shareWebsiteWhatsappBtn) {
    shareWebsiteWhatsappBtn.addEventListener("click", () => {
      const text = getWebsiteShareText();
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, "_blank");
    });
  }

  // 2. Bluetooth / Nearby Share (Creates an HTML Web Shortcut & triggers native file sharing or download)
  if (shareWebsiteBluetoothBtn) {
    shareWebsiteBluetoothBtn.addEventListener("click", async () => {
      const url = getWebsiteShareUrl();
      const shortcutHtml =
        `<!DOCTYPE html>\n<html>\n<head>\n` +
        `<meta http-equiv="refresh" content="0; url=${url}" />\n` +
        `<title>Viziguide AI Hardware Diagnostics</title>\n</head>\n` +
        `<body style="font-family: sans-serif; text-align: center; padding: 40px;">\n` +
        `<h2>Viziguide — Multimodal AI Hardware Diagnostics</h2>\n` +
        `<p>Opening application: <a href="${url}">${url}</a></p>\n` +
        `</body>\n</html>`;

      const blob = new Blob([shortcutHtml], { type: "text/html;charset=utf-8" });
      const file = new File([blob], "Viziguide-AI-Diagnostics.html", { type: "text/html" });

      // Native share with file (triggers Bluetooth / Nearby Share on Windows & mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Viziguide AI Hardware Diagnostics",
            text: getWebsiteShareText(),
            files: [file],
          });
          return;
        } catch (err) {
          if (err.name !== "AbortError") {
            console.warn("Native file share aborted:", err);
          }
        }
      }

      // Downloadable shortcut
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = "Viziguide-AI-Diagnostics.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);

      alert(
        "Website shortcut downloaded (Viziguide-AI-Diagnostics.html)!\n\n" +
          "You can now send it to any Bluetooth device or Nearby Share recipient."
      );
    });
  }

  // 3. System Share Menu
  if (shareWebsiteNativeBtn) {
    shareWebsiteNativeBtn.addEventListener("click", async () => {
      const url = getWebsiteShareUrl();
      const text = getWebsiteShareText();
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Viziguide — Multimodal AI Hardware Diagnostics",
            text: text,
            url: url,
          });
          shareWebsiteModal.style.display = "none";
        } catch (err) {
          if (err.name !== "AbortError") {
            console.warn("Share sheet error:", err);
          }
        }
      } else {
        navigator.clipboard.writeText(url);
        alert(`Link copied to clipboard: ${url}`);
      }
    });
  }

  // 4. Email Website Link
  if (shareWebsiteEmailBtn) {
    shareWebsiteEmailBtn.addEventListener("click", () => {
      const subject = "Check out Viziguide — AI Hardware & Appliance Diagnostics";
      const body = getWebsiteShareText();
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  // 5. Copy Website Link
  if (copyWebsiteUrlBtn) {
    copyWebsiteUrlBtn.addEventListener("click", () => {
      const url = getWebsiteShareUrl();
      navigator.clipboard.writeText(url).then(() => {
        const orig = copyWebsiteUrlBtn.textContent;
        copyWebsiteUrlBtn.textContent = "✓ Link Copied!";
        setTimeout(() => (copyWebsiteUrlBtn.textContent = orig), 2000);
      });
    });
  }
}

/* --------------------------------------------------------------------------
   12. Formatting Helpers
   -------------------------------------------------------------------------- */
function cleanMarkdownText(md) {
  return md.replace(/[#*`_~]/g, "").trim();
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/^### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^## (.*$)/gim, "<h3>$1</h3>")
    .replace(/^# (.*$)/gim, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "<br><br>");

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/gi, "<ul>$1</ul>");

  return html;
}

