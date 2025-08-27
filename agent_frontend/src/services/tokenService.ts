interface TokenResponse {
  client_secret: {
    value: string
    expires_at: number
  }
}

export class TokenService {
  private static async generateToken(): Promise<string> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('VITE_OPENAI_API_KEY environment variable is required for token regeneration')
    }

    console.log('Generating new ephemeral token...')
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03'
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token generation failed:', response.status, errorText)
      throw new Error(`Token generation failed: ${response.status} - ${errorText}`)
    }

    const data: TokenResponse = await response.json()
    console.log('New ephemeral token generated successfully')
    return data.client_secret.value
  }

  static async getValidToken(): Promise<string> {
    try {
      // Try to get existing token first
      const existingToken = import.meta.env.VITE_CLIENT_EPHEMERAL_TOKEN
      if (existingToken && existingToken !== 'ek_68ad8770933081918ecc02da376e9bf0') {
        console.log('Using existing ephemeral token')
        return existingToken
      }

      // If no valid existing token, generate new one
      console.log('No valid existing token, generating new one...')
      return await this.generateToken()
    } catch (error) {
      console.error('Token service error:', error)
      throw error
    }
  }

  static async regenerateToken(): Promise<string> {
    return await this.generateToken()
  }
}