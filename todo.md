
Realtime API Learning Demo Plan                                 
                                                                
Goal: Demonstrate direct Realtime API usage vs current Agents SDK
approach                                                        
                                                                
Create: New frontend page /realtime-demos with 2 focused demos  
                                                                
Demo 1: Direct Realtime Conversation API                        
                                                                
Location: agent_frontend/src/pages/RealtimeConversationDemo.tsx 
                                                                
Features to demonstrate:                                        
- Connection method toggle (WebSocket ↔ WebRTC)                 
- Manual session configuration & updates                        
- Raw JSON event logging (show all events flowing)              
- Manual audio input/output handling (base64 encoding)          
- Voice Activity Detection controls (server_vad vs semantic_vad)
- Manual function calling (detect, execute, respond)            
- Session lifecycle management                                  
- Error handling without SDK abstraction                        
- Custom context responses (out-of-band)                        
- Text-only mode toggle                                         
                                                                
Demo 2: Transcription-Only Mode                                 
                                                                
Location: agent_frontend/src/pages/RealtimeTranscriptionDemo.tsx
                                                                
Features to demonstrate:                                        
- Transcription-only connection (?intent=transcription)         
- Different session object structure                            
- Real-time transcription streaming (delta events)              
- Voice Activity Detection for transcription                    
- Noise reduction configuration (near_field/far_field)          
- Multiple transcription models (gpt-4o-transcribe, whisper-1)  
- Language/prompt configuration                                 
- Logprobs & confidence scoring                                 
                                                                
Supporting Files:                                               
                                                                
- realtime-api-demos/utils/WebSocketClient.ts - Raw WebSocket   
wrapper                                                         
- realtime-api-demos/utils/WebRTCClient.ts - Direct WebRTC      
handling                                                        
- realtime-api-demos/utils/AudioUtils.ts - PCM16 encoding/decoding
- realtime-api-demos/utils/EventLogger.tsx - Real-time event    
display                                                         
- realtime-api-demos/todo.md - Comprehensive learning checklist 
                                                                
Learning Outcomes:                                              
                                                                
- Understand raw Realtime API vs Agents SDK abstraction         
- Experience manual session/event management                    
- Compare WebSocket vs WebRTC trade-offs                        
- Master transcription-only use cases                           
- Demonstrate complete API mastery to tech lead                 