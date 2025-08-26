import React, { useState, useEffect } from 'react'
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime'
import { z } from 'zod'
import type { RealtimeOutputGuardrail } from '@openai/agents/realtime'
import './App.css'

// Guardrails for content filtering and safety
const guardrails: RealtimeOutputGuardrail[] = [
  {
    name: 'Inappropriate Content Filter',
    async execute({ agentOutput }) {
      const inappropriateWords = ['hate', 'violence', 'harmful', 'dangerous']
      const containsInappropriate = inappropriateWords.some(word => 
        agentOutput.toLowerCase().includes(word.toLowerCase())
      )
      return {
        tripwireTriggered: containsInappropriate,
        outputInfo: { containsInappropriate, detectedWords: inappropriateWords.filter(word => 
          agentOutput.toLowerCase().includes(word.toLowerCase())
        ) },
      }
    },
  },
  {
    name: 'Privacy Protection',
    async execute({ agentOutput }) {
      // Check for potential personal information patterns
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const phonePattern = /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g
      const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g
      
      const hasEmail = emailPattern.test(agentOutput)
      const hasPhone = phonePattern.test(agentOutput)
      const hasSSN = ssnPattern.test(agentOutput)
      
      const containsPersonalInfo = hasEmail || hasPhone || hasSSN
      
      return {
        tripwireTriggered: containsPersonalInfo,
        outputInfo: { containsPersonalInfo, hasEmail, hasPhone, hasSSN },
      }
    },
  },
  {
    name: 'Financial Information Filter',
    async execute({ agentOutput }) {
      const financialKeywords = ['credit card', 'social security', 'bank account', 'password', 'pin number']
      const containsFinancialInfo = financialKeywords.some(keyword => 
        agentOutput.toLowerCase().includes(keyword.toLowerCase())
      )
      return {
        tripwireTriggered: containsFinancialInfo,
        outputInfo: { containsFinancialInfo, detectedKeywords: financialKeywords.filter(keyword => 
          agentOutput.toLowerCase().includes(keyword.toLowerCase())
        ) },
      }
    },
  },
]

// Tools for our voice agent
const getWeather = tool({
  name: 'get_weather',
  description: 'Return the weather for a city.',
  parameters: z.object({ 
    city: z.string().describe('The city to get weather for') 
  }),
  async execute({ city }) {
    console.log(`Getting weather for ${city}...`)
    // Simulate weather API call
    const weatherData = {
      'london': 'cloudy with occasional rain, 12°C',
      'new york': 'sunny and warm, 25°C',
      'tokyo': 'partly cloudy, 18°C',
      'default': 'sunny and pleasant, 22°C'
    }
    const key = city.toLowerCase() as keyof typeof weatherData
    const weather = weatherData[key] ?? weatherData.default
    return `The weather in ${city} is currently ${weather}.`
  },
})

const searchKnowledge = tool({
  name: 'search_knowledge',
  description: 'Search through available documents and knowledge base to answer questions.',
  parameters: z.object({
    query: z.string().describe('Search query based on user question'),
    category: z.string().nullable().optional().describe('Optional category to search in: general, technical, business')
  }),
  async execute({ query, category }) {
    const searchCategory = category || 'general'
    console.log(`Searching knowledge base for: ${query} in category: ${searchCategory}`)
    
    // Simulate knowledge search (you'll replace this with actual RAG/LangChain call)
    const mockResponses = {
      'voice agent': 'Voice agents are AI systems that can have natural conversations using speech. They use real-time APIs to process audio input and generate spoken responses.',
      'openai': 'OpenAI is an AI research company that develops advanced language models like GPT-4 and provides APIs for developers.',
      'realtime': 'The OpenAI Realtime API enables real-time speech-to-speech conversations with AI models, supporting features like voice activity detection and interruptions.',
      'default': `I found some information related to "${query}". This appears to be about ${searchCategory} topics. Let me provide you with the most relevant details from our knowledge base.`
    }
    
    // Simple keyword matching (replace with actual vector search)
    const foundKey = (Object.keys(mockResponses) as Array<keyof typeof mockResponses>)
      .find(key => query.toLowerCase().includes(key))
    const response = foundKey ? mockResponses[foundKey] : mockResponses.default

    return response
  },
})

const calculateMath = tool({
  name: 'calculate',
  description: 'Perform mathematical calculations and solve math problems.',
  parameters: z.object({
    expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "10 * 5")')
  }),
  async execute({ expression }) {
    try {
      console.log(`Calculating: ${expression}`)
      // Simple math evaluation (be careful with eval in production!)
      const sanitizedExpression = expression.replace(/[^0-9+\-*/.() ]/g, '')
      const result = eval(sanitizedExpression)
      return `The result of ${expression} is ${result}.`
    } catch (error) {
      return `I couldn't calculate "${expression}". Please provide a valid mathematical expression.`
    }
  },
})

function App() {
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

  const connectToAgent = async () => {
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

      const clientApiKey = import.meta.env.VITE_CLIENT_EPHEMERAL_TOKEN || 'ek_68ad8770933081918ecc02da376e9bf0'
      
      await newSession.connect({ apiKey: clientApiKey })
      
      setSession(newSession)
      setIsConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      console.error('Failed to connect to voice agent:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (session) {
      // await session.disconnect()
      setSession(null)
      setIsConnected(false)
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎤 Voice Agent</h1>
        <p>Your AI voice assistant powered by OpenAI Realtime API</p>
      </header>

      <main>
        <div className="status-card">
          <h2>Connection Status</h2>
          <p className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </p>
        </div>

        <div className="controls">
          {!isConnected ? (
            <button 
              onClick={connectToAgent}
              disabled={isConnecting}
              className="connect-btn"
            >
              {isConnecting ? 'Connecting...' : '🎤 Connect to Voice Agent'}
            </button>
          ) : (
            <button onClick={disconnect} className="disconnect-btn">
              🔌 Disconnect
            </button>
          )}
        </div>

        {error && (
          <div className="error">
            <p>❌ Error: {error}</p>
          </div>
        )}

        {isConnected && (
          <div className="instructions">
            <h3>🎉 Voice Agent Ready!</h3>
            <p>Your microphone is now active. Start speaking to interact with your AI assistant!</p>
            <div className="features">
              <h4>Available Tools:</h4>
              <ul>
                <li>🔍 Knowledge Search - Ask about topics, documentation</li>
                <li>🌤️ Weather - Get weather for any city</li>
                <li>🧮 Calculator - Solve math problems</li>
              </ul>
            </div>
            
            <div className="agent-controls">
              <button onClick={() => setShowHistory(!showHistory)} className="history-btn">
                {showHistory ? '📜 Hide' : '📜 Show'} Conversation
              </button>
              <button onClick={() => setShowGuardrails(!showGuardrails)} className="guardrails-btn">
                {showGuardrails ? '🛡️ Hide' : '🛡️ Show'} Guardrails
                {guardrailViolations.length > 0 && <span className="violation-count"> ({guardrailViolations.length})</span>}
              </button>
              <button onClick={() => setIsTextMode(!isTextMode)} className="text-mode-btn">
                {isTextMode ? '🎤 Voice' : '⌨️ Text'} Mode
              </button>
            </div>

            {isTextMode && (
              <div className="text-input-section">
                <h4>💬 Text Chat</h4>
                <form onSubmit={handleTextSubmit} className="text-form">
                  <div className="text-input-group">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your message here..."
                      className="text-input"
                      disabled={!isConnected}
                    />
                    <button 
                      type="submit" 
                      className="send-btn"
                      disabled={!isConnected || !textInput.trim()}
                    >
                      📤 Send
                    </button>
                  </div>
                </form>
                <div className="text-mode-info">
                  <p>💡 You can use both voice and text simultaneously. Text messages will appear in the conversation history.</p>
                </div>
              </div>
            )}

            {showHistory && conversationHistory.length > 0 && (
              <div className="conversation-history">
                <h4>Conversation History:</h4>
                <div className="history-list">
                  {conversationHistory.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                      <strong>{message.role === 'user' ? '👤' : '🤖'}:</strong>
                      <span>{message.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showGuardrails && (
              <div className="guardrails-section">
                <h4>🛡️ Guardrails & Safety</h4>
                <div className="guardrails-info">
                  <p>Active guardrails protecting this conversation:</p>
                  <ul>
                    <li>✅ Inappropriate Content Filter</li>
                    <li>✅ Privacy Protection (emails, phone, SSN)</li>
                    <li>✅ Financial Information Filter</li>
                  </ul>
                </div>
                
                {guardrailViolations.length > 0 ? (
                  <div className="violations-list">
                    <h5>⚠️ Recent Violations:</h5>
                    {guardrailViolations.slice(-3).map((violation, index) => (
                      <div key={index} className="violation">
                        <div className="violation-header">
                          <span className="violation-name">{violation.name}</span>
                          <span className="violation-time">
                            {violation.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="violation-details">
                          {(() => {
                            // Convert technical details to user-friendly messages
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
                            
                            // Fallback for any other violation
                            return `🛡️ Content filtered by safety guardrails. Response was blocked.`
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-violations">
                    <p>✅ No guardrail violations detected</p>
                  </div>
                )}
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="tool-calls">
                <h4>🔧 Recent Tool Calls:</h4>
                {toolCalls.slice(-3).map((call, index) => (
                  <div key={index} className="tool-call">
                    <div className="tool-name">🛠️ {call.name}</div>
                    <div className="tool-args">Args: {JSON.stringify(call.args)}</div>
                    {call.result && <div className="tool-result">Result: {call.result}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="status-info">
              <p>✅ Microphone active • ✅ Semantic VAD enabled • ✅ Tools ready • ✅ Guardrails active • ✅ Text input ready</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
