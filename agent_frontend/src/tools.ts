import { tool } from '@openai/agents/realtime'
import { z } from 'zod'

interface WeatherData {
  main: {
    temp: number
    feels_like: number
    humidity: number
  }
  weather: {
    main: string
    description: string
  }[]
  wind: {
    speed: number
  }
  name: string
  sys: {
    country: string
  }
}

export const getWeather = tool({
  name: 'get_weather',
  description: 'Get real-time weather information for any city using OpenWeatherMap API.',
  parameters: z.object({ 
    city: z.string().describe('The city to get weather for') 
  }),
  async execute({ city }) {
    console.log(`Getting weather for ${city}...`)
    
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY
    if (!apiKey) {
      return `Weather service unavailable - API key not configured. Please add VITE_OPENWEATHER_API_KEY to your environment variables.`
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
      )
      
      if (!response.ok) {
        if (response.status === 404) {
          return `I couldn't find weather information for "${city}". Please check the city name and try again.`
        }
        throw new Error(`Weather API error: ${response.status}`)
      }

      const data: WeatherData = await response.json()
      
      const temperature = Math.round(data.main.temp)
      const feelsLike = Math.round(data.main.feels_like)
      const humidity = data.main.humidity
      const windSpeed = Math.round(data.wind.speed * 3.6) // Convert m/s to km/h
      const description = data.weather[0].description
      const country = data.sys.country

      return `The weather in ${data.name}, ${country} is currently ${description} with a temperature of ${temperature}°C (feels like ${feelsLike}°C). Humidity is ${humidity}% and wind speed is ${windSpeed} km/h.`
    } catch (error) {
      console.error('Weather API error:', error)
      return `I'm sorry, I couldn't retrieve the weather information for ${city} right now. Please try again later.`
    }
  },
})

export const searchKnowledge = tool({
  name: 'search_knowledge',
  description: 'Search through available documents and knowledge base to answer questions.',
  parameters: z.object({
    query: z.string().describe('Search query based on user question'),
    category: z.string().nullable().optional().describe('Optional category to search in: general, technical, business')
  }),
  async execute({ query, category }) {
    const searchCategory = category || 'general'
    console.log(`Searching knowledge base for: ${query} in category: ${searchCategory}`)
    
    const mockResponses = {
      'voice agent': 'Voice agents are AI systems that can have natural conversations using speech. They use real-time APIs to process audio input and generate spoken responses.',
      'openai': 'OpenAI is an AI research company that develops advanced language models like GPT-4 and provides APIs for developers.',
      'realtime': 'The OpenAI Realtime API enables real-time speech-to-speech conversations with AI models, supporting features like voice activity detection and interruptions.',
      'default': `I found some information related to "${query}". This appears to be about ${searchCategory} topics. Let me provide you with the most relevant details from our knowledge base.`
    }
    
    const foundKey = (Object.keys(mockResponses) as Array<keyof typeof mockResponses>)
      .find(key => query.toLowerCase().includes(key))
    const response = foundKey ? mockResponses[foundKey] : mockResponses.default

    return response
  },
})

export const calculateMath = tool({
  name: 'calculate',
  description: 'Perform mathematical calculations and solve math problems.',
  parameters: z.object({
    expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "10 * 5")')
  }),
  async execute({ expression }) {
    try {
      console.log(`Calculating: ${expression}`)
      const sanitizedExpression = expression.replace(/[^0-9+\-*/.() ]/g, '')
      const result = eval(sanitizedExpression)
      return `The result of ${expression} is ${result}.`
    } catch (error) {
      return `I couldn't calculate "${expression}". Please provide a valid mathematical expression.`
    }
  },
})