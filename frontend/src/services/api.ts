import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface ChatMessageRequest {
  message: string
  conversation_id?: string
  session_id?: string
}

export interface ChatMessageResponse {
  conversation_id: string
  message_id: string
  sender_type: string
  content: string
  intent?: string
  entities?: any[]
  confidence?: number
  timestamp: string
}

export interface Conversation {
  id: string
  session_id: string
  channel: string
  status: string
  created_at: string
  message_count?: number
}

export interface AnalyticsOverview {
  total_conversations: number
  active_conversations: number
  bot_resolution_rate: number
  avg_confidence: number
  fallback_rate: number
  avg_satisfaction: number | null
  total_messages: number
}

export interface IntentMetric {
  intent: string
  count: number
  avg_confidence: number
}

export interface UncertainPrediction {
  id: string
  text: string
  predicted_intent: string
  confidence: number
}

export interface HandoffItem {
  id: number
  conversation_id: string
  sender_id: string | null
  queued_at: string
  reason: string | null
}

export interface IntentWithPhrases {
  intent: string
  phrases: string[]
}

export interface EvaluationResult {
  f1_scores: {
    weighted: number | null
    macro: number | null
    micro: number | null
    accuracy?: number | null
  }
  confusion_matrix_url: string | null
  intent_report: Record<string, { precision: number; recall: number; f1_score: number; support: number }>
  note: string | null
}

// Chat API
export const chatApi = {
  sendMessage: (data: ChatMessageRequest) =>
    api.post<ChatMessageResponse>('/chat/message', data),

  logMessage: (data: { message: string; bot_response: string; session_id?: string; intent?: string; confidence?: number }) =>
    api.post('/chat/log', data),

  getConversations: () =>
    api.get<Conversation[]>('/chat/conversations'),

  getMessages: (conversationId: string) =>
    api.get(`/chat/conversations/${conversationId}/messages`),

  submitFeedback: (data: { message_id?: string; conversation_id: string; rating: number; comment?: string; user_message?: string; predicted_intent?: string; confidence?: number }) =>
    api.post('/chat/feedback', data),
}

// Analytics API
export const analyticsApi = {
  getOverview: () =>
    api.get<AnalyticsOverview>('/analytics/overview'),

  getIntents: () =>
    api.get<IntentMetric[]>('/analytics/intents'),

  getConversationTrend: (days: number = 30) =>
    api.get('/analytics/conversations/trend', { params: { days } }),

  getSatisfaction: () =>
    api.get('/analytics/satisfaction'),

  getFallbackMessages: (limit: number = 50) =>
    api.get('/analytics/fallback-messages', { params: { limit } }),

  getEvaluation: () =>
    api.get<EvaluationResult>('/analytics/evaluation'),
}

// Admin API
export const adminApi = {
  getIntents: () =>
    api.get('/admin/intents'),

  getUncertainPredictions: (limit: number = 50) =>
    api.get<UncertainPrediction[]>('/admin/uncertain-predictions', { params: { limit } }),

  annotatePrediction: (data: { text: string; correct_intent: string }) =>
    api.post('/admin/annotate', data),

  trainModel: () =>
    api.post('/admin/train'),

  getModelVersions: () =>
    api.get('/admin/model/versions'),

  evaluateModel: () =>
    api.get('/admin/model/evaluate'),

  getIntentsWithPhrases: () =>
    api.get<IntentWithPhrases[]>('/admin/intents/phrases'),

  addTrainingPhrase: (intent: string, phrase: string) =>
    api.post(`/admin/intents/${encodeURIComponent(intent)}/phrases`, { phrase }),
}

export const handoffApi = {
  getPending: () =>
    api.get<HandoffItem[]>('/handoffs'),

  create: (data: { conversation_id: string; reason?: string }) =>
    api.post('/handoffs', data),

  accept: (id: number, agentId: string) =>
    api.post(`/handoffs/${id}/accept`, { agent_id: agentId }),

  sendMessage: (id: number, agentId: string, message: string) =>
    api.post(`/handoffs/${id}/message`, { agent_id: agentId, message }),

  close: (id: number, agentId: string) =>
    api.post(`/handoffs/${id}/close`, { agent_id: agentId }),
}

export default api
