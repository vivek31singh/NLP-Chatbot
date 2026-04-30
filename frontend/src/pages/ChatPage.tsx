import { useState, useRef, useEffect } from 'react'
import { Send, ThumbsUp, ThumbsDown, RotateCcw, Bot, User } from 'lucide-react'
import RasaService, { RasaBotMessage } from '../services/rasaSocket'

interface Message {
  id: string
  sender_type: 'user' | 'bot' | 'system'
  content: string
  timestamp: string
  buttons?: Array<{ title: string; payload: string }>
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const serviceRef = useRef<RasaService | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    serviceRef.current = new RasaService()
    return () => {
      serviceRef.current = null
    }
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender_type: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const botMessages = await serviceRef.current?.sendMessage(text)

      if (botMessages && botMessages.length > 0) {
        botMessages.forEach((msg: RasaBotMessage) => {
          const botMessage: Message = {
            id: crypto.randomUUID(),
            sender_type: 'bot',
            content: msg.text,
            timestamp: new Date().toISOString(),
            buttons: msg.buttons,
          }
          setMessages((prev) => [...prev, botMessage])
        })
      } else {
        const noReply: Message = {
          id: crypto.randomUUID(),
          sender_type: 'system',
          content: 'No response received from the bot.',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, noReply])
      }
    } catch (error) {
      console.error('Error sending message to Rasa:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sender_type: 'system',
        content: 'Unable to reach the chatbot. Make sure Rasa is running on port 5005.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSendQuickReply = async (payload: string) => {
    if (isLoading) return
    setIsLoading(true)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender_type: 'user',
      content: payload,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const botMessages = await serviceRef.current?.sendMessage(payload)

      if (botMessages && botMessages.length > 0) {
        botMessages.forEach((msg: RasaBotMessage) => {
          const botMessage: Message = {
            id: crypto.randomUUID(),
            sender_type: 'bot',
            content: msg.text,
            timestamp: new Date().toISOString(),
            buttons: msg.buttons,
          }
          setMessages((prev) => [...prev, botMessage])
        })
      }
    } catch (error) {
      console.error('Error sending quick reply to Rasa:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    setMessages([])
    setFeedbackGiven({})
    serviceRef.current = new RasaService()
  }

  const handleFeedback = (_messageId: string, rating: 'up' | 'down') => {
    setFeedbackGiven((prev) => ({ ...prev, [_messageId]: rating }))
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {messages.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Current Chat</p>
                <p className="text-xs text-blue-600 mt-1">
                  {messages.length} messages
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            New Conversation
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Customer Support Bot</h1>
              <p className="text-sm text-green-600">Online</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 chat-scroll">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Customer Support Chatbot
                </h3>
                <p className="text-gray-500 max-w-md">
                  Ask me about order status, returns, billing, product information, or anything else!
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['Track my order', 'Return an item', 'Billing question', 'Talk to agent'].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 message-appear ${
                  msg.sender_type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender_type !== 'user' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                    {msg.sender_type === 'bot' ? (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <span className="text-xs text-yellow-700">!</span>
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[70%] ${msg.sender_type === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                      msg.sender_type === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : msg.sender_type === 'system'
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.sender_type === 'bot' && msg.buttons && msg.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.payload}
                          onClick={() => handleSendQuickReply(btn.payload)}
                          className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors"
                        >
                          {btn.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {msg.sender_type === 'bot' && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={`p-1 rounded transition-colors ${
                            feedbackGiven[msg.id] === 'up'
                              ? 'text-green-600'
                              : 'text-gray-300 hover:text-green-500'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={`p-1 rounded transition-colors ${
                            feedbackGiven[msg.id] === 'down'
                              ? 'text-red-600'
                              : 'text-gray-300 hover:text-red-500'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {msg.sender_type === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 message-appear">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
