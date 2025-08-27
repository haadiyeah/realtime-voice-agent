import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { VoiceAgentPage } from './VoiceAgentPage'
import { RealtimeConversationDemo } from './pages/RealtimeConversationDemo'
import './App.css'

function Navigation() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: '🎤 Voice Agent (SDK)', description: 'High-level Agents SDK implementation' },
    { path: '/realtime-demo', label: '⚡ Direct Realtime API', description: 'Raw API connection and manual event handling' }
  ]

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className=" mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <p className="text-md font-bold text-white">Realtime Voice Demos</p>
            </div>
            
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 m-5 py-2 rounded-lg transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-sky-950/30 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                  }`}
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs opacity-75">{item.description}</div>
                </Link>
              ))}
            </div>
          </div>
          
          <div className="text-sm text-gray-400">
            Learning Realtime API
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="min-w-screen min-h-screen bg-gray-900 text-gray-200">
        <Navigation />
        
        <Routes>
          <Route path="/" element={<VoiceAgentPage />} />
          <Route path="/realtime-demo" element={<RealtimeConversationDemo />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App