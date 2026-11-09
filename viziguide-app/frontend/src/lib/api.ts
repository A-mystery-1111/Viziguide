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

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
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

  return response.json()
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
