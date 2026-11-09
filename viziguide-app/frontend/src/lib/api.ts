import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export interface DiagnosisResult {
  productName: string
  issue: string
  steps: string[]
  warnings: string[]
  disclaimer: string
  clearerPhoto?: boolean
}

export interface ChatResponse {
  reply: string
}

function cleanMarkdown(text: string): string {
  if (!text) return ''
  return text
    // Replace markdown headers and bullets
    .replace(/^[\s#*-]+/gm, '')
    // Remove all literal asterisks anywhere (single, double, triple)
    .replace(/\*+/g, '')
    // Remove markdown backticks, underlines, tildes
    .replace(/[`_~]+/g, '')
    // Clean up excessive whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || 'demo-token'
  return { Authorization: `Bearer ${token}` }
}

export async function analyzeImage(file: File, description?: string): Promise<DiagnosisResult> {
  const formData = new FormData()
  formData.append('image', file)
  if (description?.trim()) {
    formData.append('description', description.trim())
  }

  const headers = await getAuthHeader()

  const response = await fetch(`${API_BASE}/api/diagnose`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Diagnosis request failed with status ${response.status}`)
  }

  const raw = await response.json()

  // Handle backend/main.py (multimodal full response)
  if (raw.sections) {
    const s = raw.sections
    const rawFix = s.step_by_step_fix || ''
    
    // Clean steps and strip markdown/asterisks
    const stepLines = rawFix
      .split('\n')
      .map((l: string) => cleanMarkdown(l))
      .filter((l: string) => l.length > 5 && !l.toLowerCase().startsWith('phase '))

    // Clean warnings
    const warningLines = (s.safety_warnings || '')
      .split('\n')
      .map((l: string) => cleanMarkdown(l))
      .filter((l: string) => l.length > 5)

    const rawProduct = (s.identified_product || raw.inputs?.product_hint || 'Identified Product').split('\n')[0]
    const rawIssue = s.likely_root_cause || s.root_cause || s.observed_symptoms || raw.diagnosis || 'Diagnosis completed'

    return {
      productName: cleanMarkdown(rawProduct),
      issue: cleanMarkdown(rawIssue).slice(0, 450),
      steps: stepLines.length > 0 ? stepLines : ['Refer to product manual or qualified technician for internal disassembly.'],
      warnings: warningLines.length > 0 ? warningLines : ['Always disconnect from mains AC power before inspecting internal parts.'],
      disclaimer: 'This diagnosis is generated with multimodal AI and verified repair manual heuristics. Follow safety protocols.',
      clearerPhoto: s.confidence_level === 'Low',
    }
  }

  // Handle direct DiagnosisResult format
  const rawIssue = cleanMarkdown(raw.issue || 'Diagnosis complete')
  const stepsList = Array.isArray(raw.steps)
    ? raw.steps.map((item: any) => cleanMarkdown(typeof item === 'string' ? item : `${item.title}: ${item.instruction}`))
    : []
  const warningsList = Array.isArray(raw.safety_warnings)
    ? raw.safety_warnings.map((w: string) => cleanMarkdown(w))
    : Array.isArray(raw.warnings) ? raw.warnings.map((w: string) => cleanMarkdown(w)) : []

  return {
    productName: cleanMarkdown(raw.product_identified || raw.productName || 'Equipment'),
    issue: rawIssue,
    steps: stepsList,
    warnings: warningsList,
    disclaimer: cleanMarkdown(raw.disclaimer || 'Safety first: follow manufacturer guidance.'),
    clearerPhoto: raw.confidence < 0.6 || raw.clearerPhoto,
  }
}

export async function sendChatMessage(message: string, diagnosisId?: string): Promise<ChatResponse> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await getAuthHeader()),
  }

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, diagnosis_id: diagnosisId }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Chat request failed with status ${response.status}`)
  }

  const data = await response.json()
  return {
    reply: cleanMarkdown(data.reply || ''),
  }
}
