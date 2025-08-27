export class AudioUtils {
  // Converts Float32Array of audio data to PCM16 ArrayBuffer
  static floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)
    let offset = 0
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      // Clamp values to [-1, 1] range
      const clampedValue = Math.max(-1, Math.min(1, float32Array[i]))
      // Convert to 16-bit PCM
      const pcmValue = clampedValue < 0 
        ? clampedValue * 0x8000 
        : clampedValue * 0x7fff
      view.setInt16(offset, pcmValue, true) // little-endian
    }
    
    return buffer
  }

  // Converts Float32Array to base64-encoded PCM16 data
  static base64EncodeAudio(float32Array: Float32Array): string {
    const arrayBuffer = this.floatTo16BitPCM(float32Array)
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    
    // Process in chunks to avoid call stack overflow
    const chunkSize = 0x8000 // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    
    return btoa(binary)
  }

  // Converts base64 audio back to Float32Array
  static base64DecodeAudio(base64String: string): Float32Array {
    const binary = atob(base64String)
    const bytes = new Uint8Array(binary.length)
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    
    const view = new DataView(bytes.buffer)
    const float32Array = new Float32Array(bytes.length / 2)
    
    for (let i = 0; i < float32Array.length; i++) {
      const pcmValue = view.getInt16(i * 2, true) // little-endian
      // Convert 16-bit PCM back to float
      float32Array[i] = pcmValue < 0 ? pcmValue / 0x8000 : pcmValue / 0x7fff
    }
    
    return float32Array
  }

  // Creates an audio context for recording/playback
  static createAudioContext(): AudioContext {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  }

  // Gets user media for microphone access
  static async getUserMedia(constraints: MediaStreamConstraints = { audio: true }): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser')
    }
    
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      console.error('Error accessing user media:', error)
      throw new Error('Failed to access microphone. Please check permissions.')
    }
  }

  // Creates a script processor for audio recording
  static createAudioProcessor(
    audioContext: AudioContext,
    mediaStream: MediaStream,
    onAudioData: (audioData: Float32Array) => void,
    bufferSize: number = 4096
  ): { processor: ScriptProcessorNode; source: MediaStreamAudioSourceNode } {
    const source = audioContext.createMediaStreamSource(mediaStream)
    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
    
    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer
      const audioData = inputBuffer.getChannelData(0)
      onAudioData(new Float32Array(audioData))
    }
    
    source.connect(processor)
    processor.connect(audioContext.destination)
    
    return { processor, source }
  }

  // Creates an audio buffer for playback
  static async createAudioBuffer(
    audioContext: AudioContext,
    audioData: Float32Array,
    sampleRate: number = 24000
  ): Promise<AudioBuffer> {
    const buffer = audioContext.createBuffer(1, audioData.length, sampleRate)
    buffer.copyToChannel(Float32Array.from(audioData), 0)
    return buffer
  }

  // Plays an audio buffer
  static playAudioBuffer(audioContext: AudioContext, audioBuffer: AudioBuffer): AudioBufferSourceNode {
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    source.start()
    return source
  }

  // Utility to resample audio data (simple linear interpolation)
  static resampleAudio(
    inputData: Float32Array, 
    inputSampleRate: number, 
    outputSampleRate: number
  ): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputData
    }
    
    const ratio = inputSampleRate / outputSampleRate
    const outputLength = Math.floor(inputData.length / ratio)
    const output = new Float32Array(outputLength)
    
    for (let i = 0; i < outputLength; i++) {
      const index = i * ratio
      const indexFloor = Math.floor(index)
      const indexCeil = Math.min(indexFloor + 1, inputData.length - 1)
      const fraction = index - indexFloor
      
      // Linear interpolation
      output[i] = inputData[indexFloor] * (1 - fraction) + inputData[indexCeil] * fraction
    }
    
    return output
  }

  // Utility to combine multiple audio chunks
  static combineAudioChunks(chunks: Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Float32Array(totalLength)
    
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    
    return combined
  }

  // Utility to normalize audio levels
  static normalizeAudio(audioData: Float32Array): Float32Array {
    const normalized = new Float32Array(audioData.length)
    let maxAbs = 0
    
    // Find maximum absolute value
    for (let i = 0; i < audioData.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(audioData[i]))
    }
    
    // Normalize if needed
    if (maxAbs > 0 && maxAbs !== 1) {
      const scale = 1 / maxAbs
      for (let i = 0; i < audioData.length; i++) {
        normalized[i] = audioData[i] * scale
      }
      return normalized
    }
    
    return audioData
  }
}