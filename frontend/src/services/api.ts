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

// Chat API
export const chatApi = {
  sendMessage: (data: ChatMessageRequest) =>
    api.post<ChatMessageResponse>('/chat/message', data),

  getConversations: () =>
    api.get<Conversation[]>('/chat/conversations'),

  getMessages: (conversationId: string) =>
    api.get(`/chat/conversations/${conversationId}/messages`),

  submitFeedback: (data: { message_id?: string; conversation_id: string; rating: number; comment?: string }) =>
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
}

export default api
