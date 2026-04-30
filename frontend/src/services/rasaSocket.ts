import axios from 'axios'

const RASA_URL = import.meta.env.VITE_RASA_URL || '/rasa'

interface TrackerEvent {
  event: string
  text?: string
  data?: {
    buttons?: Array<{ title: string; payload: string }>
    image?: string
    attachment?: string
    quick_replies?: Array<{ title: string; payload: string }>
  }
  metadata?: Record<string, unknown>
  timestamp?: number
}

interface TrackerResponse {
  sender_id: string
  latest_message: {
    text: string
    intent: { name: string; confidence: number }
    entities: Array<{ entity: string; value: string }>
  }
  events: TrackerEvent[]
}

class RasaService {
  private sessionId: string
  private client: ReturnType<typeof axios.create>

  constructor(sessionId?: string) {
    this.sessionId = sessionId || crypto.randomUUID()
    this.client = axios.create({
      baseURL: RASA_URL,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async sendMessage(message: string): Promise<RasaBotMessage[]> {
    const response = await this.client.post<Array<{ text?: string; buttons?: Array<{ title: string; payload: string }>; image?: string; quick_replies?: Array<{ title: string; payload: string }> }>>(
      `/webhooks/rest/webhook`,
      { sender: this.sessionId, message }
    )

    return response.data
      .filter((msg) => msg.text)
      .map((msg) => ({
        text: msg.text!,
        buttons: msg.buttons,
        image: msg.image,
        quick_replies: msg.quick_replies,
      }))
  }

  private extractBotMessages(tracker: TrackerResponse): RasaBotMessage[] {
    const messages: RasaBotMessage[] = []
    const events = tracker.events

    let lastBotIndex = -1
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].event === 'bot') {
        lastBotIndex = i
        break
      }
    }

    if (lastBotIndex === -1) return messages

    for (let i = lastBotIndex; i < events.length; i++) {
      const evt = events[i]
      if (evt.event === 'bot' && evt.text) {
        messages.push({
          text: evt.text,
          buttons: evt.data?.buttons,
          image: evt.data?.image,
          quick_replies: evt.data?.quick_replies,
        })
      }
    }

    return messages
  }

  getSessionId(): string {
    return this.sessionId
  }
}

export interface RasaBotMessage {
  text: string
  buttons?: Array<{ title: string; payload: string }>
  image?: string
  quick_replies?: Array<{ title: string; payload: string }>
}

export default RasaService
