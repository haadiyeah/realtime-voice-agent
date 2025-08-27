import { useState, useEffect, useRef, useCallback } from 'react'
import { WebSocketClient } from '../realtime-api-demos/utils/WebSocketClient'
import type { RealtimeEvent } from '../realtime-api-demos/utils/WebSocketClient'
import { AudioUtils } from '../realtime-api-demos/utils/AudioUtils'
import { EventLogger, useEventLogger } from '../realtime-api-demos/components/EventLogger'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface SessionConfig {
  instructions: string
  voice: string
  input_audio_format: string
  output_audio_format: string
  turn_detection: any
  modalities: string[]
  temperature: number
}

export function RealtimeConversationDemo() {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  
  // WebSocket client
  const wsClientRef = useRef<WebSocketClient | null>(null)
  
  // Audio state
  const [isRecording, setIsRecording] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)
  
  // Session configuration
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    instructions: 'You are a helpful AI assistant. Be conversational and respond naturally.',
    voice: 'alloy',
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16', 
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
      interrupt_response: true
    },
    modalities: ['text', 'audio'],
    temperature: 0.8
  })
  
  // Text input
  const [textInput, setTextInput] = useState('')
  
  // Event logging
  const { events, addEvent, clearEvents } = useEventLogger(200)
  
  // Function calling state
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<Array<{
    call_id: string
    name: string
    arguments: string
  }>>([])
  
  // Initialize API key from environment or localStorage
  useEffect(() => {
    const envKey = import.meta.env.VITE_OPENAI_API_KEY
    const storedKey = localStorage.getItem('openai_api_key')
    if (envKey) {
      setApiKey(envKey)
    } else if (storedKey) {
      setApiKey(storedKey)
    }
  }, [])
  
  // Save API key to localStorage when changed
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey)
    }
  }, [apiKey])

  const connectToRealtime = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }

    try {
      setConnectionStatus('connecting')
      setError(null)
      
      const client = new WebSocketClient({
        apiKey: apiKey.trim(),
        model: 'gpt-4o-realtime-preview-2025-06-03'
      })
      
      // Set up event listeners
      client.addEventListener('connected', () => {
        console.log('Connected to Realtime API')
        setConnectionStatus('connected')
      })
      
      client.addEventListener('disconnected', (event: any) => {
        console.log('Disconnected from Realtime API:', event.detail)
        setConnectionStatus('disconnected')
        setIsRecording(false)
      })
      
      client.addEventListener('error', (event: any) => {
        console.error('WebSocket error:', event.detail)
        setError('WebSocket connection error')
        setConnectionStatus('error')
      })
      
      client.addEventListener('message', (event: any) => {
        const realtimeEvent = event.detail as RealtimeEvent
        addEvent(realtimeEvent, 'received')
        handleIncomingEvent(realtimeEvent)
      })
      
      client.addEventListener('sent', (event: any) => {
        const realtimeEvent = event.detail as RealtimeEvent
        addEvent(realtimeEvent, 'sent')
      })
      
      await client.connect()
      wsClientRef.current = client
      
      // Send initial session configuration
      setTimeout(() => {
        if (client.isConnected()) {
          client.updateSession(sessionConfig)
        }
      }, 100)
      
    } catch (err) {
      console.error('Failed to connect:', err)
      setError(err instanceof Error ? err.message : 'Connection failed')
      setConnectionStatus('error')
    }
  }, [apiKey, sessionConfig, addEvent])

  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect()
      wsClientRef.current = null
    }
    
    // Stop recording
    stopRecording()
    setConnectionStatus('disconnected')
    setError(null)
  }, [])

  const handleIncomingEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'session.created':
        console.log('Session created:', event)
        break
        
      case 'session.updated':
        console.log('Session updated:', event)
        break
        
      case 'response.done':
        // Check for function calls
        if (event.response?.output?.[0]?.type === 'function_call') {
          const functionCall = event.response.output[0]
          setPendingFunctionCalls(prev => [...prev, {
            call_id: functionCall.call_id,
            name: functionCall.name,
            arguments: functionCall.arguments
          }])
        }
        break
        
      case 'response.audio.delta':
        // Handle audio playback
        if (event.delta && audioContext) {
          try {
            const audioData = AudioUtils.base64DecodeAudio(event.delta)
            const audioBuffer = AudioUtils.createAudioBuffer(audioContext, audioData)
            audioBuffer.then(buffer => {
              AudioUtils.playAudioBuffer(audioContext, buffer)
            })
          } catch (err) {
            console.error('Error playing audio:', err)
          }
        }
        break
        
      case 'input_audio_buffer.speech_started':
        console.log('Speech started')
        break
        
      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped')
        break
        
      case 'error':
        console.error('Realtime API error:', event)
        setError(`API Error: ${event.message}`)
        break
    }
  }, [audioContext])

  const startRecording = useCallback(async () => {
    if (!wsClientRef.current?.isConnected()) {
      setError('Not connected to Realtime API')
      return
    }

    try {
      // Initialize audio context if needed
      let audioCtx = audioContext
      if (!audioCtx) {
        audioCtx = AudioUtils.createAudioContext()
        setAudioContext(audioCtx)
      }

      // Get microphone access
      const stream = await AudioUtils.getUserMedia({ audio: true })
      setMediaStream(stream)
      
      // Create audio processor
      const { processor, source } = AudioUtils.createAudioProcessor(
        audioCtx,
        stream,
        (audioData) => {
          if (wsClientRef.current?.isConnected()) {
            const base64Audio = AudioUtils.base64EncodeAudio(audioData)
            wsClientRef.current.appendInputAudioBuffer(base64Audio)
          }
        }
      )
      
      audioProcessorRef.current = processor
      setIsRecording(true)
      setError(null)
      
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }, [audioContext])

  const stopRecording = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect()
      audioProcessorRef.current = null
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
    }
    
    setIsRecording(false)
  }, [mediaStream])

  const sendTextMessage = useCallback(() => {
    if (!wsClientRef.current?.isConnected() || !textInput.trim()) {
      return
    }

    wsClientRef.current.createConversationItem({
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: textInput.trim()
      }]
    })
    
    wsClientRef.current.createResponse()
    setTextInput('')
  }, [textInput])

  const updateSessionConfig = useCallback(() => {
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.updateSession(sessionConfig)
    }
  }, [sessionConfig])

  const executeFunctionCall = useCallback((callId: string, name: string, args: string) => {
    // Mock function execution
    let result = ''
    
    try {
      const parsedArgs = JSON.parse(args)
      
      switch (name) {
        case 'get_weather':
          result = JSON.stringify({
            weather: `The weather in ${parsedArgs.city} is sunny and 72°F`,
            temperature: 72,
            condition: 'sunny'
          })
          break
          
        case 'calculate':
          const expression = parsedArgs.expression || ''
          try {
            const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '')
            const value = eval(sanitized)
            result = JSON.stringify({ result: value, expression })
          } catch {
            result = JSON.stringify({ error: 'Invalid expression' })
          }
          break
          
        default:
          result = JSON.stringify({ 
            message: `Function ${name} executed successfully`,
            args: parsedArgs
          })
      }
    } catch (err) {
      result = JSON.stringify({ error: 'Failed to parse arguments' })
    }

    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.createConversationItem({
        type: 'function_call_output',
        call_id: callId,
        output: result
      })
      
      wsClientRef.current.createResponse()
    }
    
    // Remove from pending list
    setPendingFunctionCalls(prev => prev.filter(call => call.call_id !== callId))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <p className="text-4xl font-bold mb-2  ">
            Direct Realtime API Demo
          </p>
          <p className="text-gray-400 text-lg">
            Raw WebSocket connection showing manual session management, event handling, and function calling
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Connection */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Connection</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    connectionStatus === 'connected' ? 'bg-green-900/20 text-green-400 border border-green-500/20' :
                    connectionStatus === 'connecting' ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-500/20' :
                    connectionStatus === 'error' ? 'bg-red-900/20 text-red-400 border border-red-500/20' :
                    'bg-gray-900/20 text-gray-400 border border-gray-500/20'
                  }`}>
                    {connectionStatus === 'connected' && '🟢 Connected'}
                    {connectionStatus === 'connecting' && '🟡 Connecting...'}
                    {connectionStatus === 'error' && '🔴 Error'}
                    {connectionStatus === 'disconnected' && '⚪ Disconnected'}
                  </div>
                  
                  {connectionStatus === 'connected' ? (
                    <button
                      onClick={disconnect}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={connectToRealtime}
                      disabled={connectionStatus === 'connecting' || !apiKey.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 text-red-400">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Session Configuration */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Session Configuration</h2>
                <button
                  onClick={updateSessionConfig}
                  disabled={connectionStatus !== 'connected'}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Update Session
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Instructions
                  </label>
                  <textarea
                    value={sessionConfig.instructions}
                    onChange={(e) => setSessionConfig(prev => ({ ...prev, instructions: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Voice
                    </label>
                    <select
                      value={sessionConfig.voice}
                      onChange={(e) => setSessionConfig(prev => ({ ...prev, voice: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="alloy">alloy</option>
                      <option value="echo">echo</option>
                      <option value="fable">fable</option>
                      <option value="onyx">onyx</option>
                      <option value="nova">nova</option>
                      <option value="shimmer">shimmer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      VAD Type
                    </label>
                    <select
                      value={sessionConfig.turn_detection.type}
                      onChange={(e) => setSessionConfig(prev => ({ 
                        ...prev, 
                        turn_detection: { ...prev.turn_detection, type: e.target.value }
                      }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="server_vad">server_vad</option>
                      <option value="semantic_vad">semantic_vad</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Audio Controls</h2>
              
              <div className="flex items-center space-x-4">
                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                    <span>Stop Recording</span>
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={connectionStatus !== 'connected'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>🎤</span>
                    <span>Start Recording</span>
                  </button>
                )}
              </div>
            </div>

            {/* Text Input */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Text Input</h2>
              
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendTextMessage()
                    }
                  }}
                />
                
                <button
                  onClick={sendTextMessage}
                  disabled={connectionStatus !== 'connected' || !textInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Send Message
                </button>
              </div>
            </div>

            {/* Function Calls */}
            {pendingFunctionCalls.length > 0 && (
              <div className="bg-orange-900/20 border border-orange-500/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 text-orange-400">Pending Function Calls</h2>
                
                <div className="space-y-3">
                  {pendingFunctionCalls.map((call) => (
                    <div key={call.call_id} className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-orange-300">{call.name}</div>
                          <div className="text-xs text-gray-400">ID: {call.call_id}</div>
                        </div>
                        <button
                          onClick={() => executeFunctionCall(call.call_id, call.name, call.arguments)}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Execute
                        </button>
                      </div>
                      <div className="text-sm text-gray-300 bg-gray-800 rounded p-2 font-mono">
                        {call.arguments}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Event Logger */}
          <div>
            <EventLogger events={events} className="h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}