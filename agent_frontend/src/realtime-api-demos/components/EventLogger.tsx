import { useState, useEffect, useRef } from 'react'
import type { RealtimeEvent } from '../utils/WebSocketClient'

interface EventLogEntry {
  id: string
  timestamp: Date
  direction: 'sent' | 'received'
  event: RealtimeEvent
  expanded?: boolean
}

interface EventLoggerProps {
  events: EventLogEntry[]
  maxEvents?: number
  className?: string
}

export function EventLogger({ events, maxEvents = 100, className = '' }: EventLoggerProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [events, autoScroll])

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const clearEvents = () => {
    // This would need to be handled by parent component
    console.log('Clear events requested')
  }

  const getEventTypeColor = (eventType: string) => {
    const typeCategories = {
      // Session events
      'session.': 'text-blue-400',
      // Conversation events  
      'conversation.': 'text-green-400',
      // Response events
      'response.': 'text-purple-400',
      // Audio buffer events
      'input_audio_buffer.': 'text-orange-400',
      // Error events
      'error': 'text-red-400',
      // Rate limit events
      'rate_limits.': 'text-yellow-400'
    }

    for (const [prefix, color] of Object.entries(typeCategories)) {
      if (eventType.startsWith(prefix) || eventType.includes(prefix.slice(0, -1))) {
        return color
      }
    }
    
    return 'text-gray-400'
  }

  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2)
  }

  const truncateString = (str: string, maxLength: number = 100): string => {
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
  }

  const displayedEvents = events.slice(-maxEvents)

  return (
    <div className={`bg-gray-900 flex flex-col border border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">Real-time Events</h3>
          <span className="text-sm text-gray-400">
            {displayedEvents.length} / {maxEvents}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-2"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearEvents}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded border border-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Event Log */}
      <div 
        ref={logContainerRef}
        className="h-96 max-h-[56rem] flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm"
      >
        {displayedEvents.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No events yet. Connect to start seeing events...
          </div>
        ) : (
          displayedEvents.map((entry) => {
            const isExpanded = expandedEvents.has(entry.id)
            const eventTypeColor = getEventTypeColor(entry.event.type)
            
            return (
              <div
                key={entry.id}
                className={`border rounded p-3 cursor-pointer transition-colors ${
                  entry.direction === 'sent'
                    ? 'border-blue-600 bg-blue-950/20 hover:bg-blue-950/30'
                    : 'border-green-600 bg-green-950/20 hover:bg-green-950/30'
                }`}
                onClick={() => toggleExpanded(entry.id)}
              >
                {/* Event Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      entry.direction === 'sent' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-green-600 text-white'
                    }`}>
                      {entry.direction === 'sent' ? '↗ SENT' : '↙ RECEIVED'}
                    </span>
                    
                    <span className={`font-semibold ${eventTypeColor}`}>
                      {entry.event.type}
                    </span>
                    
                    {entry.event.event_id && (
                      <span className="text-xs text-gray-500">
                        {entry.event.event_id.slice(-8)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`text-xs transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}>
                      ▶
                    </span>
                  </div>
                </div>

                {/* Event Preview (when collapsed) */}
                {!isExpanded && (
                  <div className="mt-2 text-gray-400 text-xs">
                    {truncateString(formatJson(entry.event), 150)}
                  </div>
                )}

                {/* Full Event Details (when expanded) */}
                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    <div className="text-gray-300">
                      <pre className="whitespace-pre-wrap text-xs bg-gray-800 p-3 rounded border overflow-x-auto">
                        {formatJson(entry.event)}
                      </pre>
                    </div>
                    
                    {/* Special handling for audio events */}
                    {entry.event.type === 'input_audio_buffer.append' && entry.event.audio && (
                      <div className="text-yellow-400 text-xs">
                        📎 Audio data: {entry.event.audio.length} characters (base64)
                      </div>
                    )}
                    
                    {entry.event.type === 'response.audio.delta' && entry.event.delta && (
                      <div className="text-green-400 text-xs">
                        🔊 Audio delta: {entry.event.delta.length} characters (base64)
                      </div>
                    )}
                    
                    {/* Function call details */}
                    {entry.event.type === 'response.done' && entry.event.response?.output?.[0]?.type === 'function_call' && (
                      <div className="bg-purple-950/30 border border-purple-600/30 rounded p-2">
                        <div className="text-purple-400 text-xs font-semibold mb-1">
                          🔧 Function Call Detected
                        </div>
                        <div className="text-purple-300 text-xs">
                          Function: {entry.event.response.output[0].name}<br/>
                          Call ID: {entry.event.response.output[0].call_id}<br/>
                          Arguments: {entry.event.response.output[0].arguments}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-gray-700 p-3 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>
            📤 Sent: {displayedEvents.filter(e => e.direction === 'sent').length} | 
            📥 Received: {displayedEvents.filter(e => e.direction === 'received').length}
          </span>
          <span>
            {displayedEvents.length > 0 && 
              `Latest: ${displayedEvents[displayedEvents.length - 1].timestamp.toLocaleTimeString()}`
            }
          </span>
        </div>
      </div>
    </div>
  )
}

// Hook to manage event logging
export function useEventLogger(maxEvents: number = 100) {
  const [events, setEvents] = useState<EventLogEntry[]>([])

  const addEvent = (event: RealtimeEvent, direction: 'sent' | 'received') => {
    const entry: EventLogEntry = {
      id: `${direction}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      direction,
      event
    }

    setEvents(prev => {
      const newEvents = [...prev, entry]
      return newEvents.slice(-maxEvents) // Keep only the last maxEvents
    })
  }

  const clearEvents = () => {
    setEvents([])
  }

  return { events, addEvent, clearEvents }
}