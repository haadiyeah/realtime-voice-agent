import React, { useState, useEffect } from 'react'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import { guardrails } from './guardrails'
import { getWeather, searchKnowledge, calculateMath } from './tools'
import { TokenService } from './services/tokenService'
import { TokenRegenerationModal } from './components/TokenRegenerationModal'
import './App.css'

export function VoiceAgentPage() {
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<Array<{ name: string, args: any, result?: string }>>([])
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string, content: string }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [guardrailViolations, setGuardrailViolations] = useState<Array<{ name: string, details: any, timestamp: Date }>>([])
  const [showGuardrails, setShowGuardrails] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [isTextMode, setIsTextMode] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [currentToken, setCurrentToken] = useState<string | null>(null)

  const sendTextMessage = async (message: string) => {
    if (!session || !message.trim()) return
    
    try {
      console.log('Sending text message:', message)
      await session.sendMessage(message.trim())
      setTextInput('')
    } catch (error) {
      console.error('Failed to send text message:', error)
      setError('Failed to send text message')
    }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendTextMessage(textInput)
  }

  const connectToAgent = async (token?: string) => {
    try {
      setIsConnecting(true)
      setError(null)
      setToolCalls([])
      setConversationHistory([])
      setGuardrailViolations([])

      const agent = new RealtimeAgent({
        name: 'AI Assistant',
        instructions: `You are a helpful AI assistant with access to several tools. You can:
        - Search knowledge base for information
        - Get weather information for cities
        - Perform mathematical calculations
        
        When using tools, briefly explain what you're doing. For example: "Let me search for that information" or "I'll calculate that for you".
        Be conversational and helpful in your responses.`,
        tools: [searchKnowledge, getWeather, calculateMath],
      })

      const newSession: any = new RealtimeSession(agent, {
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          turnDetection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            createResponse: true,
            interruptResponse: true,
          },
        },
        outputGuardrails: guardrails,
        outputGuardrailSettings: {
          debounceTextLength: 25, // Check every 25 characters for very fast detection
        },
      })

      // Listen for tool calls
      newSession.on('tool_call_started', (event: any) => {
        console.log('Tool call started:', event)
        setToolCalls(prev => [...prev, { 
          name: event.tool_name || 'Unknown Tool', 
          args: event.arguments || {} 
        }])
      })

      newSession.on('tool_call_completed', (event: any) => {
        console.log('Tool call completed:', event)
        setToolCalls(prev => prev.map(call => 
          call.name === (event.tool_name || 'Unknown Tool') ? 
          { ...call, result: event.result || 'No result' } : 
          call
        ))
      })

      // Listen for conversation history updates
      newSession.on('history_updated', (history: any) => {
        console.log('=== History updated ===', history)
        const formattedHistory = history
          .filter((item: any) => item.type === 'message')
          .map((item: any, index: number) => {
            console.log(`Message ${index}:`, {
              role: item.role,
              type: item.type,
              content: item.content
            })
            
            return {
              role: item.role || 'unknown',
              content: (() => {
                // Handle different content structures
                if (!item.content) {
                  return 'No content property'
                }
                
                // Content might be a string directly
                if (typeof item.content === 'string') {
                  return item.content
                }
                
                // Content might be an array
                if (Array.isArray(item.content)) {
                  if (item.content.length === 0) {
                    return 'Empty content array'
                  }
                  
                  const contentItem = item.content[0]
                  console.log(`Content item for message ${index}:`, contentItem)
                  
                  // Direct text property
                  if (contentItem.text) {
                    return contentItem.text
                  }
                  
                  // Transcript property (for audio)
                  if (contentItem.transcript) {
                    return contentItem.transcript
                  }
                  
                  // Content item is a string
                  if (typeof contentItem === 'string') {
                    return contentItem
                  }
                  
                  // Different content types
                  if (contentItem.type) {
                    switch (contentItem.type) {
                      case 'text':
                        return contentItem.text || contentItem.content || 'Empty text content'
                      case 'input_text':
                        return contentItem.text || contentItem.input_text || 'Empty input text'
                      case 'input_audio':
                        return contentItem.transcript || 'Audio message (no transcript)'
                      case 'audio':
                        return contentItem.transcript || 'Audio content (no transcript)'
                      default:
                        console.log(`Unknown content type: ${contentItem.type}`, contentItem)
                        break
                    }
                  }
                  
                  // Try to find any text-like property
                  const textProps = ['text', 'transcript', 'content', 'message', 'input_text', 'output_text']
                  for (const prop of textProps) {
                    if (contentItem[prop] && typeof contentItem[prop] === 'string') {
                      return contentItem[prop]
                    }
                  }
                  
                  // Show the actual structure for debugging
                  return `Unhandled content structure: ${JSON.stringify(contentItem, null, 2).slice(0, 200)}...`
                }
                
                // Content is an object but not array
                return `Non-array content: ${JSON.stringify(item.content, null, 2).slice(0, 200)}...`
              })()
            }
          })
        
        console.log('Formatted history:', formattedHistory)
        setConversationHistory(formattedHistory)
      })

      // Listen for audio interruptions
      newSession.on('audio_interrupted', () => {
        console.log('Audio interrupted - stopping playback')
        // Handle local playback interruption (if using WebSocket)
        // The session will automatically handle truncating the conversation
      })

      // Listen for guardrail violations
      newSession.on('guardrail_tripped', (event: any) => {
        console.log('=== Guardrail tripped ===')
        console.log('Full event object:', JSON.stringify(event, null, 2))
        console.log('Event keys:', Object.keys(event))
        console.log('Event structure:', event)
        
        // Try to extract guardrail information from different possible structures
        let guardrailName = 'Unknown Guardrail'
        let guardrailDetails = {}
        
        // Try different possible property paths
        if (event.guardrail_name) {
          guardrailName = event.guardrail_name
        } else if (event.name) {
          guardrailName = event.name
        } else if (event.guardrail && event.guardrail.name) {
          guardrailName = event.guardrail.name
        } else if (event.type) {
          guardrailName = event.type
        }
        
        // Try different possible detail paths
        if (event.details) {
          guardrailDetails = event.details
        } else if (event.outputInfo) {
          guardrailDetails = event.outputInfo
        } else if (event.info) {
          guardrailDetails = event.info
        } else if (event.data) {
          guardrailDetails = event.data
        } else if (event.guardrail && event.guardrail.details) {
          guardrailDetails = event.guardrail.details
        } else {
          // If no details found, show the entire event for debugging
          const { guardrail_name, name, guardrail, type, ...restEvent } = event
          guardrailDetails = restEvent
        }
        
        console.log('Extracted guardrail info:', {
          name: guardrailName,
          details: guardrailDetails
        })
        
        setGuardrailViolations(prev => [...prev, {
          name: guardrailName,
          details: guardrailDetails,
          timestamp: new Date()
        }])
        
        // When a guardrail is triggered, the agent should stop and the conversation
        // should be truncated at the violation point to prevent showing blocked content
        try {
          // Interrupt the current response
          if (newSession && typeof newSession.interrupt === 'function') {
            newSession.interrupt()
            console.log('Session interrupted due to guardrail violation')
          }
        } catch (error) {
          console.log('Could not interrupt session:', error)
        }
      })

      const clientApiKey = token || currentToken || await TokenService.getValidToken()
      setCurrentToken(clientApiKey)
      
      await newSession.connect({ apiKey: clientApiKey })
      
      setSession(newSession)
      setIsConnected(true)
    } catch (err) {
      console.error('Failed to connect to voice agent:', err)
      
      // Check if it's a 401 error (token expired) - handle various error formats
      // const errorMessage = err instanceof Error ? err.message : String(err)
      // const is401Error = errorMessage.includes('401') || 
      //                   errorMessage.includes('Unauthorized') || 
      //                   errorMessage.includes('OperationError') ||
      //                   errorMessage.includes('authentication') ||
      //                   errorMessage.includes('token') && errorMessage.includes('invalid') ||
      //                   errorMessage.includes('token') && errorMessage.includes('expired')
      
     
        console.log('Detected 401/authentication error, showing token regeneration modal')
        setShowTokenModal(true)
        setError('Authentication failed - token may be expired')
     
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTokenRegenerated = (newToken: string) => {
    console.log('Token regeneration successful, retrying connection...')
    setCurrentToken(newToken)
    setError(null)
    setShowTokenModal(false)
    // Automatically retry connection with new token
    connectToAgent(newToken)
  }

  const disconnect = async () => {
    if (session) {
      // await session.disconnect()
      setSession(null)
      setIsConnected(false)
    }
  }

  const interruptAgent = () => {
    if (session && typeof session.interrupt === 'function') {
      session.interrupt()
      console.log('Manual interruption triggered')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-center min-h-screen text-white">
      <header className="mb-12">
        <p className="text-5xl font-bold mb-4 ">
          🎤 Voice Agent
        </p>
        <p className="text-gray-400 text-xl">Your AI voice assistant powered by OpenAI Realtime API</p>
      </header>

      <main>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">Connection Status</h2>
          <p className={`text-xl font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </p>
        </div>

        <div className="mb-8">
          {!isConnected ? (
            <button 
              onClick={() => connectToAgent()}
              disabled={isConnecting}
              className="text-xl font-bold py-4 px-8 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/25"
            >
              {isConnecting ? 'Connecting...' : '🎤 Connect to Voice Agent'}
            </button>
          ) : (
            <button 
              onClick={disconnect} 
              className="text-xl font-bold py-4 px-8 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/25"
            >
              🔌 Disconnect
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-8">
            <p className="text-red-400">❌ Error: {error}</p>
          </div>
        )}

        {isConnected && (
          <div className="bg-green-900/10 border border-green-500/30 rounded-xl p-8 text-left">
            <h3 className="text-center text-2xl font-bold text-green-400 mb-4">🎉 Voice Agent Ready!</h3>
            <p className="text-center mb-6 text-gray-300">Your microphone is now active. Start speaking to interact with your AI assistant!</p>
            
            <div className="mb-6">
              <h4 className="text-cyan-400 font-semibold mb-3">Available Tools:</h4>
              <ul className="space-y-2">
                <li className="text-gray-300">🔍 Knowledge Search - Ask about topics, documentation</li>
                <li className="text-gray-300">🌤️ Weather - Get weather for any city</li>
                <li className="text-gray-300">🧮 Calculator - Solve math problems</li>
              </ul>
            </div>
            
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <button 
                onClick={() => setShowHistory(!showHistory)} 
                className="bg-cyan-900/20 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-900/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                {showHistory ? '📜 Hide' : '📜 Show'} Conversation
              </button>
              <button 
                onClick={() => setShowGuardrails(!showGuardrails)} 
                className="bg-purple-900/20 border border-purple-500/50 text-purple-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-900/30 hover:-translate-y-0.5 transition-all duration-200 relative"
              >
                {showGuardrails ? '🛡️ Hide' : '🛡️ Show'} Guardrails
                {guardrailViolations.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {guardrailViolations.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setIsTextMode(!isTextMode)} 
                className="bg-green-900/20 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-900/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                {isTextMode ? '🎤 Voice' : '⌨️ Text'} Mode
              </button>
              <button 
                onClick={interruptAgent} 
                disabled={!isConnected}
                className="bg-yellow-900/20 border border-yellow-500/50 text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-900/30 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✋ Stop Agent
              </button>
            </div>

            {isTextMode && (
              <div className="bg-green-900/10 border border-green-500/30 rounded-lg p-6 mb-6">
                <h4 className="text-green-400 font-semibold mb-4">💬 Text Chat</h4>
                <form onSubmit={handleTextSubmit} className="mb-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your message here..."
                      className="flex-1 bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!isConnected}
                    />
                    <button 
                      type="submit" 
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/25 whitespace-nowrap"
                      disabled={!isConnected || !textInput.trim()}
                    >
                      📤 Send
                    </button>
                  </div>
                </form>
                <div className="bg-gray-800/20 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">💡 You can use both voice and text simultaneously. Text messages will appear in the conversation history.</p>
                </div>
              </div>
            )}

            {showHistory && conversationHistory.length > 0 && (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 mb-6 max-h-80 overflow-y-auto">
                <h4 className="text-cyan-400 font-semibold mb-4">Conversation History:</h4>
                <div className="space-y-3">
                  {conversationHistory.map((message, index) => (
                    <div key={index} className={`flex gap-3 p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-900/20 border-l-4 border-blue-500' 
                        : 'bg-green-900/20 border-l-4 border-green-500'
                    }`}>
                      <div className="text-lg">{message.role === 'user' ? '👤' : '🤖'}</div>
                      <div className="text-gray-300 break-words flex-1">{message.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showGuardrails && (
              <div className="bg-purple-900/10 border border-purple-500/30 rounded-lg p-6 mb-6">
                <h4 className="text-purple-400 font-semibold mb-4">🛡️ Guardrails & Safety</h4>
                <div className="mb-4">
                  <p className="text-gray-300 mb-3">Active guardrails protecting this conversation:</p>
                  <ul className="space-y-1">
                    <li className="text-green-400 text-sm">✅ Inappropriate Content Filter</li>
                    <li className="text-green-400 text-sm">✅ Privacy Protection (emails, phone, SSN)</li>
                    <li className="text-green-400 text-sm">✅ Financial Information Filter</li>
                  </ul>
                </div>
                
                {guardrailViolations.length > 0 ? (
                  <div className="space-y-3">
                    <h5 className="text-yellow-400 font-medium">⚠️ Recent Violations:</h5>
                    {guardrailViolations.slice(-3).map((violation, index) => (
                      <div key={index} className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-red-400 font-medium">{violation.name}</span>
                          <span className="text-gray-400 text-xs">
                            {violation.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="bg-gray-800/40 rounded p-3 font-mono text-sm text-yellow-300">
                          {(() => {
                            const details = violation.details
                            
                            if (details.containsInappropriate && details.detectedWords?.length > 0) {
                              return `🚫 Inappropriate content detected. Response was blocked for safety.`
                            }
                            
                            if (details.containsPersonalInfo) {
                              const types = []
                              if (details.hasEmail) types.push('email addresses')
                              if (details.hasPhone) types.push('phone numbers') 
                              if (details.hasSSN) types.push('social security numbers')
                              return `🔒 Personal information detected: ${types.join(', ')}. Response blocked for privacy protection.`
                            }
                            
                            if (details.containsFinancialInfo && details.detectedKeywords?.length > 0) {
                              return `💳 Financial information detected (${details.detectedKeywords.join(', ')}). Response blocked for security.`
                            }
                            
                            return `🛡️ Content filtered by safety guardrails. Response was blocked.`
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-green-400">✅ No guardrail violations detected</p>
                  </div>
                )}
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="bg-orange-900/10 border border-orange-500/30 rounded-lg p-6 mb-6">
                <h4 className="text-orange-400 font-semibold mb-4">🔧 Recent Tool Calls:</h4>
                <div className="space-y-3">
                  {toolCalls.slice(-3).map((call, index) => (
                    <div key={index} className="bg-gray-800/20 rounded-lg p-4 text-sm">
                      <div className="text-orange-400 font-medium mb-2">🛠️ {call.name}</div>
                      <div className="text-gray-400 mb-2">Args: {JSON.stringify(call.args)}</div>
                      {call.result && <div className="text-green-400 italic">Result: {call.result}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-green-900/5 rounded-lg p-4">
              <p className="text-green-400 text-sm">✅ Microphone active • ✅ Semantic VAD enabled • ✅ Tools ready • ✅ Guardrails active • ✅ Text input ready</p>
            </div>
          </div>
        )}
      </main>
      
      <TokenRegenerationModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onTokenRegenerated={handleTokenRegenerated}
      />
    </div>
  )
}

export default VoiceAgentPage
