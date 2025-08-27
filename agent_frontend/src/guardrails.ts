import type { RealtimeOutputGuardrail } from '@openai/agents/realtime'

export const guardrails: RealtimeOutputGuardrail[] = [
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