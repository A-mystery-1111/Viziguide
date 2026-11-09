import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export interface RepairStep {
  title: string
  instruction: string
}

export interface BackendDiagnosisResult {
  product_identified: string
  issue: string
  confidence: number
  severity: 'low' | 'medium' | 'high'
  steps: RepairStep[]
  safety_warnings: string[]
  needs_professional: boolean
  disclaimer: string
}

// Frontend expected interface format in App.tsx
export interface DiagnosisResult {
  productName: string
  issue: string
  steps: string[]
  warnings: string[]
  disclaimer: string
  clearerPhoto?: boolean
  severity?: 'low' | 'medium' | 'high'
  needsProfessional?: boolean
}

export interface ChatResponse {
  reply: string
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || 'local-demo-token'
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

  const raw: BackendDiagnosisResult = await response.json()

  // Adapt backend schema to match App.tsx component expectations
  return {
    productName: raw.product_identified || 'Identified Product',
    issue: raw.issue || 'Diagnosis complete',
    steps: Array.isArray(raw.steps)
      ? raw.steps.map((s) => (typeof s === 'string' ? s : `${s.title}: ${s.instruction}`))
      : [],
    warnings: Array.isArray(raw.safety_warnings) ? raw.safety_warnings : [],
    disclaimer: raw.disclaimer || 'Safety first: follow manufacturer guidance.',
    clearerPhoto: raw.confidence < 0.6,
    severity: raw.severity,
    needsProfessional: raw.needs_professional,
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

  return response.json()
}
