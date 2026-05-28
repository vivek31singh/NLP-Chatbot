import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Headphones,
  Send,
  CheckCircle,
  Clock,
  MessageSquare,
  User,
  Bot,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Loader2,
} from 'lucide-react'
import { handoffApi, chatApi, HandoffItem } from '../services/api'

interface ConversationMessage {
  id: number
  sender_type: string
  content: string
  intent: string | null
  confidence: number | null
  created_at: string
}

interface ActiveHandoff {
  handoff: HandoffItem
  messages: ConversationMessage[]
}

export default function AgentConsolePage() {
  const [pendingHandoffs, setPendingHandoffs] = useState<HandoffItem[]>([])
  const [activeHandoff, setActiveHandoff] = useState<ActiveHandoff | null>(null)
  const [agentMessage, setAgentMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedHandoffs, setClosedHandoffs] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const agentId = 'agent-1'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeHandoff?.messages])

  const loadPendingHandoffs = useCallback(async () => {
    try {
      const res = await handoffApi.getPending()
      setPendingHandoffs(res.data.filter((h) => !closedHandoffs.has(h.id)))
    } catch {
      setError('Failed to load pending handoffs')
    } finally {
      setLoading(false)
    }
  }, [closedHandoffs])

  useEffect(() => {
    loadPendingHandoffs()
    const interval = setInterval(loadPendingHandoffs, 5000)
    return () => clearInterval(interval)
  }, [loadPendingHandoffs])

  const handleAccept = async (handoff: HandoffItem) => {
    setError(null)
    try {
      await handoffApi.accept(handoff.id, agentId)
      const msgRes = await chatApi.getMessages(handoff.conversation_id)
      setActiveHandoff({
        handoff,
        messages: msgRes.data,
      })
      setPendingHandoffs((prev) => prev.filter((h) => h.id !== handoff.id))
      inputRef.current?.focus()
    } catch {
      setError('Failed to accept handoff')
    }
  }

  const handleSendMessage = async () => {
    const text = agentMessage.trim()
    if (!text || !activeHandoff || sending) return

    setSending(true)
    setError(null)
    try {
      await handoffApi.sendMessage(activeHandoff.handoff.id, agentId, text)
      setActiveHandoff((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: Date.now(),
                  sender_type: 'agent',
                  content: text,
                  intent: null,
                  confidence: null,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : null
      )
      setAgentMessage('')
    } catch {
      setError('Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleCloseHandoff = async () => {
    if (!activeHandoff) return
    setError(null)
    try {
      await handoffApi.close(activeHandoff.handoff.id, agentId)
      setClosedHandoffs((prev) => new Set(prev).add(activeHandoff.handoff.id))
      setActiveHandoff(null)
      loadPendingHandoffs()
    } catch {
      setError('Failed to close handoff')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return <User className="w-4 h-4 text-gray-600" />
      case 'bot':
        return <Bot className="w-4 h-4 text-blue-600" />
      case 'agent':
        return <Headphones className="w-4 h-4 text-green-600" />
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const getSenderLabel = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return 'Customer'
      case 'bot':
        return 'Bot'
      case 'agent':
        return 'You'
      default:
        return senderType
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading agent console...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left panel - Handoff Queue */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Handoff Queue</h2>
            </div>
            <button
              onClick={loadPendingHandoffs}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {pendingHandoffs.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-600 font-medium">
                {pendingHandoffs.length} pending
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pendingHandoffs.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No pending handoffs</p>
              <p className="text-xs text-gray-400 mt-1">All caught up!</p>
            </div>
          )}

          {pendingHandoffs.map((handoff) => (
            <div
              key={handoff.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {handoff.sender_id || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(handoff.queued_at)}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  Pending
                </span>
              </div>

              {handoff.reason && (
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                  <span className="font-medium">Reason:</span> {handoff.reason}
                </p>
              )}

              <button
                onClick={() => handleAccept(handoff)}
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Accept Conversation
              </button>
            </div>
          ))}
        </div>

        {/* Stats footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{closedHandoffs.size} resolved today</span>
            <span>{pendingHandoffs.length} in queue</span>
          </div>
        </div>
      </div>

      {/* Right panel - Active Conversation */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {!activeHandoff ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Headphones className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Agent Console
              </h3>
              <p className="text-gray-500 max-w-sm">
                Accept a handoff from the queue to start chatting with a customer.
                Pending conversations will appear on the left.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h1 className="font-semibold text-gray-900">
                      {activeHandoff.handoff.sender_id || 'Customer'}
                    </h1>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Conversation: {activeHandoff.handoff.conversation_id.slice(0, 8)}...
                      </span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Connected
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCloseHandoff}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Resolve & Close
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 chat-scroll">
              <div className="space-y-4 max-w-3xl mx-auto">
                {/* Context banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Conversation transferred from bot
                    </p>
                    {activeHandoff.handoff.reason && (
                      <p className="text-xs text-blue-700 mt-1">
                        Reason: {activeHandoff.handoff.reason}
                      </p>
                    )}
                    <p className="text-xs text-blue-600 mt-1">
                      Queued at {formatTime(activeHandoff.handoff.queued_at)}
                    </p>
                  </div>
                </div>

                {/* Conversation history */}
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <p className="text-xs text-gray-400 text-center font-medium uppercase tracking-wider">
                    Conversation History
                  </p>
                </div>

                {activeHandoff.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender_type !== 'agent' && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-gray-100">
                        {getSenderIcon(msg.sender_type)}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${msg.sender_type === 'agent' ? 'order-first' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {getSenderLabel(msg.sender_type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.intent && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                            {msg.intent}
                          </span>
                        )}
                        {msg.confidence !== null && msg.confidence !== undefined && (
                          <span className="text-xs text-gray-400">
                            ({(msg.confidence * 100).toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                          msg.sender_type === 'user'
                            ? 'bg-gray-100 text-gray-900 rounded-bl-md'
                            : msg.sender_type === 'agent'
                            ? 'bg-green-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                    {msg.sender_type === 'agent' && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                        <Headphones className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message input */}
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="max-w-3xl mx-auto flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={agentMessage}
                  onChange={(e) => setAgentMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response to the customer..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  disabled={sending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !agentMessage.trim()}
                  className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
