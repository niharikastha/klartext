export interface Document {
  id: string
  userId: string
  fileName: string
  fileType: string
  language: string
  uploadedAt: string
  analysisStatus: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface AnalysisResult {
  id: string
  documentId: string
  summary: string
  documentType: string
  actionItems: ActionItem[]
  extractedData: Record<string, string>
  riskLevel: 'low' | 'medium' | 'high'
  createdAt: string
}

export interface ActionItem {
  id: string
  title: string
  description: string
  deadline?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  completed: boolean
  category: 'deadline' | 'document' | 'payment' | 'appointment' | 'other'
}

export interface User {
  id: string
  email: string
  name: string
  targetCountry: string
  nativeLanguage: string
}
