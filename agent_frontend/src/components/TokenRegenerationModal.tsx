import React, { useState } from 'react'
import { TokenService } from '../services/tokenService'

interface TokenRegenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onTokenRegenerated: (token: string) => void
}

export const TokenRegenerationModal: React.FC<TokenRegenerationModalProps> = ({
  isOpen,
  onClose,
  onTokenRegenerated,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setError(null)

    try {
      console.log('User confirmed token regeneration')
      const newToken = await TokenService.regenerateToken()
      console.log('Token regeneration successful, token length:', newToken.length)
      onTokenRegenerated(newToken)
      // Modal will be closed by the parent component
    } catch (err) {
      console.error('Token regeneration failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Token regeneration failed'
      setError(errorMessage)
      setIsRegenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="text-red-400 text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Failed - Token Issue</h2>
          <p className="text-gray-300 text-sm">
            The realtime connection returned a 401 Unauthorized error. Your ephemeral token may have expired.
          </p>
          <p className="text-yellow-300 text-sm mt-2 font-medium">
            Would you like to regenerate a new token and retry?
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-1">
              Make sure VITE_OPENAI_API_KEY is set in your environment variables.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isRegenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </span>
            ) : (
              '🔄 Regenerate Token'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isRegenerating}
            className="px-4 py-2 text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-xs mb-2">
            <strong>How this works:</strong>
          </p>
          <ol className="text-gray-400 text-xs space-y-1">
            <li>1. POST to <code className="bg-gray-700 px-1 rounded">/v1/realtime/sessions</code></li>
            <li>2. Extract <code className="bg-gray-700 px-1 rounded">client_secret.value</code> as new token</li>
            <li>3. Retry realtime connection with new token</li>
          </ol>
          <p className="text-yellow-400 text-xs mt-2">
            <strong>Required:</strong> <code className="bg-gray-700 px-1 rounded">VITE_OPENAI_API_KEY</code> environment variable
          </p>
        </div>
      </div>
    </div>
  )
}