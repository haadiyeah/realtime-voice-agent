export interface RealtimeEvent {
  event_id?: string
  type: string
  [key: string]: any
}

export interface WebSocketClientConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

export class WebSocketClient extends EventTarget {
  private ws: WebSocket | null = null
  private config: WebSocketClientConfig
  private connected = false
  
  constructor(config: WebSocketClientConfig) {
    super()
    this.config = {
      baseUrl: 'wss://api.openai.com/v1/realtime',
      model: 'gpt-4o-realtime-preview-2025-06-03',
      ...config
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('WebSocket is already connected')
    }

    const url = `${this.config.baseUrl}?model=${this.config.model}`
    
    try {
      this.ws = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${this.config.apiKey}`,
        'openai-beta.realtime-v1'
      ])

      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('Failed to create WebSocket'))

        this.ws.onopen = () => {
          this.connected = true
          this.dispatchEvent(new CustomEvent('connected'))
          resolve()
        }

        this.ws.onclose = (event) => {
          this.connected = false
          this.dispatchEvent(new CustomEvent('disconnected', { 
            detail: { code: event.code, reason: event.reason } 
          }))
        }

        this.ws.onerror = (error) => {
          this.connected = false
          this.dispatchEvent(new CustomEvent('error', { detail: error }))
          reject(error)
        }

        this.ws.onmessage = (event) => {
          try {
            const data: RealtimeEvent = JSON.parse(event.data)
            this.dispatchEvent(new CustomEvent('message', { detail: data }))
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
            this.dispatchEvent(new CustomEvent('error', { detail: error }))
          }
        }
      })
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      throw error
    }
  }

  sendEvent(event: RealtimeEvent): void {
    if (!this.connected || !this.ws) {
      throw new Error('WebSocket is not connected')
    }

    try {
      const eventWithId = {
        event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...event
      }
      
      this.ws.send(JSON.stringify(eventWithId))
      
      // Emit sent event for logging
      this.dispatchEvent(new CustomEvent('sent', { detail: eventWithId }))
    } catch (error) {
      console.error('Failed to send WebSocket event:', error)
      this.dispatchEvent(new CustomEvent('error', { detail: error }))
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  // Convenience methods for common events
  updateSession(sessionUpdate: any): void {
    this.sendEvent({
      type: 'session.update',
      session: sessionUpdate
    })
  }

  createConversationItem(item: any): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item
    })
  }

  createResponse(response?: any): void {
    this.sendEvent({
      type: 'response.create',
      response: response || {}
    })
  }

  appendInputAudioBuffer(audioData: string): void {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioData
    })
  }

  commitInputAudioBuffer(): void {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    })
  }

  clearInputAudioBuffer(): void {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    })
  }
}