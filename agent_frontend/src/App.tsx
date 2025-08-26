import { useState, useEffect } from 'react'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import './App.css'

function App() {
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectToAgent = async () => {
    try {
      setIsConnecting(true)
      setError(null)

      const agent = new RealtimeAgent({
        name: 'Assistant',
        instructions: 'You are a helpful assistant.',
      })

      const newSession = new RealtimeSession(agent, {
        model: 'gpt-4o-realtime-preview-2025-06-03',
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
            <ul>
              <li>✅ Microphone access granted</li>
              <li>✅ Connected to OpenAI Realtime API</li>
              <li>✅ Ready for voice interaction</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
