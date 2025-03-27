'use client';

import React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';

// Define proper types for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// Define field type - same as the form data keys
type FieldType = 'name' | 'email' | 'phone' | 'address';

// Define detected information structure for semantic understanding
interface DetectedField {
  field: FieldType;
  value: string;
  confidence: number;
}

// Define the possible intents from speech input
type IntentType = 'provide_info' | 'submit' | 'clear' | 'unknown';

// Define the structure for a voice understanding result
interface VoiceUnderstanding {
  intent: IntentType;
  detectedFields: DetectedField[];
  originalText: string;
}

interface VoiceInputProps {
  onVoiceInput: (understanding: VoiceUnderstanding) => void;
  listening: boolean;
  setListening: (listening: boolean) => void;
  useAI?: boolean; // Optional prop to enable AI processing
  activeField?: string; // Current active field
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onVoiceInput, 
  listening, 
  setListening,
  useAI = false,
  activeField = ''
}) => {
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [browserSupport, setBrowserSupport] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [interimResult, setInterimResult] = useState<string>('');
  const [rateLimitHit, setRateLimitHit] = useState(false);
  
  // Simplify analyzeVoiceInput to only handle submit and clear intents
  // Everything else will be handled by AI
  const analyzeVoiceInput = (text: string): VoiceUnderstanding => {
    // Normalize the text for easier matching
    const normalizedText = text.toLowerCase().trim();
    
    // We'll keep only basic intent detection for submit and clear
    // These are critical functions that should work even without AI
    
    // Check for submit intent with minimal patterns
    if (/\b(submit|send|done)\b/i.test(normalizedText)) {
      console.log('Submit intent detected in text:', normalizedText);
      return {
        intent: 'submit',
        detectedFields: [],
        originalText: text
      };
    }
    
    // Check for clear intent
    if (/\b(clear|reset)\b/i.test(normalizedText)) {
      return {
        intent: 'clear',
        detectedFields: [],
        originalText: text
      };
    }
    
    // For everything else, return unknown intent
    // The AI will handle actual field detection
    return {
      intent: 'unknown',
      detectedFields: [],
      originalText: text
    };
  };

  // Modify processVoiceInput to prioritize AI and only use minimal regex as fallback
  const processVoiceInput = useCallback(async (text: string) => {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.log('Empty or invalid voice input received');
      return;
    }
    
    console.log('Processing voice input:', text);
    setProcessing(true);
    setRateLimitHit(false);

    try {
      // Get basic intent understanding locally
      // This is just for submit/clear - not for field detection
      const basicIntent = analyzeVoiceInput(text);
      
      // Always try AI processing first if enabled
      if (useAI) {
        try {
          console.log('Attempting AI processing');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch('/api/sanitize', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
            signal: controller.signal
          }).catch(err => {
            console.log('AI API request failed:', err);
            return null;
          });
          
          clearTimeout(timeoutId);

          // If we got a good response, parse it
          if (response && response.ok) {
            const data = await response.json();
            console.log('AI analysis received:', data);
            
            // Check if we used AI or fell back to regex (rate limit)
            if (data.fromAI === false) {
              console.log('Response generated without AI (rate limiting active)');
              setRateLimitHit(true);
            }
            
            // Check if the AI detected a submit intent
            if (data.submit && data.submit.value === true) {
              console.log('Submit intent detected');
              onVoiceInput({
                intent: 'submit',
                detectedFields: [],
                originalText: text
              });
              setProcessing(false);
              return;
            }
            
            // Process detected fields from AI
            if (data && (data.name || data.email || data.phone || data.address)) {
              // Create understanding from AI response
              const aiUnderstanding: VoiceUnderstanding = {
                intent: 'provide_info',
                detectedFields: [],
                originalText: text
              };
              
              // Add detected fields
              for (const fieldName of ['name', 'email', 'phone', 'address'] as const) {
                if (data[fieldName]) {
                  aiUnderstanding.detectedFields.push({
                    field: fieldName,
                    value: data[fieldName].value,
                    confidence: data[fieldName].confidence || 0.8
                  });
                }
              }
              
              // If we got any fields, use the AI understanding
              if (aiUnderstanding.detectedFields.length > 0) {
                console.log('Using field detection from response');
                onVoiceInput(aiUnderstanding);
                setProcessing(false);
                return;
              }
            }
            
            // If AI returned data but no fields or submit were detected
            if (data) {
              // Check if we have a basic intent from our minimal regex
              if (basicIntent.intent !== 'unknown') {
                console.log('Using basic intent detection:', basicIntent.intent);
                onVoiceInput(basicIntent);
              } else {
                // No fields detected by AI and no basic intent
                console.log('No fields or intent detected in:', text);
                onVoiceInput({
                  intent: 'unknown',
                  detectedFields: [],
                  originalText: text
                });
              }
              setProcessing(false);
              return;
            }
          }
        } catch (err) {
          console.error('Error in AI processing:', err);
        }
      }
      
      // If AI is disabled or failed, use only basic intent detection
      console.log('Using only basic intent detection (submit/clear)');
      onVoiceInput(basicIntent);
      
    } catch (err) {
      console.error('Error in voice processing:', err);
      // Send a simplified understanding with the original text as fallback
      onVoiceInput({
        intent: 'unknown',
        detectedFields: [],
        originalText: text
      });
    } finally {
      setProcessing(false);
    }
  }, [onVoiceInput, useAI]);

  // Initialize speech recognition once on component mount
  useEffect(() => {
    // Check if we're on the client-side before accessing window
    if (typeof window === 'undefined') return;

    // Check if browser supports speech recognition
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.error('Speech Recognition API not supported in this browser');
      setError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      setBrowserSupport(false);
      return;
    }
    
    try {
      // Create a new instance of SpeechRecognition
      const recognitionInstance = new SpeechRecognitionAPI();
      
      // Configure recognition settings
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true; 
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;
      
      // Set up event handlers
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results;
        if (!results || results.length === 0) {
          console.warn('No results in speech recognition event');
          return;
        }

        // Get the most recent result (current utterance)
        const currentResult = results[results.length - 1];
        if (!currentResult || currentResult.length === 0) {
          console.warn('Empty result in speech recognition');
          return;
        }

        // Get the most confident transcript from the current result
        const transcript = currentResult[0]?.transcript;
        if (!transcript) {
          console.warn('No transcript found in recognition result');
          return;
        }

        const isFinal = currentResult.isFinal;
        
        if (isFinal) {
          // Clean transcript of any unwanted characters or unnecessary spaces
          const cleanedTranscript = transcript.trim()
            .replace(/\s+/g, ' ')  // Normalize spaces
            .replace(/^\s*hey\s+(siri|alexa|computer)\s*/i, '') // Remove wake words if present
            .trim();
          
          if (cleanedTranscript) {
            console.log(`Final transcript: "${cleanedTranscript}"`);
            processVoiceInput(cleanedTranscript);
            
            // Reset interim results
            setInterimResult('');
          }
        } else {
          // Update interim results for UI feedback
          setInterimResult(transcript);
        }
      };
      
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error, event);
        
        // Handle specific error types
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access and try again.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please try speaking again.');
        } else if (event.error === 'network') {
          setError('Network error. Check your internet connection and try again.');
        } else if (event.error === 'aborted') {
          // This is a normal situation when stopping, so don't show an error
          console.log('Speech recognition aborted');
        } else {
          setError(`Error: ${event.error}. Please try again.`);
        }
        
        if (event.error !== 'aborted') {
          setListening(false);
        }
      };
      
      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        
        // Restart if we're still supposed to be listening
        if (listening) {
          console.log('Restarting recognition because listening is still active');
          try {
            // Small delay to avoid rapid restart issues
            setTimeout(() => {
              if (listening) {
                recognitionInstance.start();
              }
            }, 100);
          } catch (err) {
            console.error('Error restarting recognition:', err);
            setListening(false);
          }
        }
      };
      
      // Store the recognition instance
      setRecognition(recognitionInstance);
      recognitionRef.current = recognitionInstance;
      
      return () => {
        // Clean up on unmount
        if (recognitionInstance) {
          try {
            recognitionInstance.stop();
          } catch (err) {
            console.error('Error stopping recognition on cleanup:', err);
          }
        }
      };
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError('Could not initialize speech recognition. Please try a different browser.');
      setBrowserSupport(false);
    }
  }, [listening, processVoiceInput, setListening]);

  // Handle listening state changes
  useEffect(() => {
    const instance = recognitionRef.current;
    if (!instance) return;
    
    try {
      if (listening) {
        console.log('Starting speech recognition');
        instance.start();
      } else {
        console.log('Stopping speech recognition');
        instance.stop();
      }
    } catch (err) {
      console.error('Error controlling speech recognition:', err);
      // Some browsers throw an error if recognition is already started/stopped
      if (err instanceof DOMException && err.name === 'InvalidStateError') {
        console.warn('Recognition was already in the requested state');
      } else {
        setError('Error controlling the microphone. Please refresh the page and try again.');
        setListening(false);
      }
    }
  }, [listening, setListening]);

  const toggleListening = () => {
    if (!browserSupport) {
      alert('Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.');
      return;
    }
    
    if (processing) return;
    
    // Simply toggle the listening state, the effect will handle the actual start/stop
    setError('');
    setListening(!listening);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
      <button
        onClick={toggleListening}
        disabled={processing || !browserSupport}
        className={`flex items-center justify-center w-16 h-16 rounded-full ${
          !browserSupport ? 'bg-gray-400 text-white' :
          processing ? 'bg-yellow-500 text-white' :
          listening ? 'bg-red-600 text-white mic-active' : 'bg-blue-600 text-white'
        } hover:opacity-90 transition mb-2`}
        aria-label={listening ? 'Stop listening' : 'Start listening'}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={1.5} 
          stroke="currentColor" 
          className="w-8 h-8"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" 
          />
        </svg>
      </button>
      <p className="text-center text-sm">
        {!browserSupport ? 'Speech recognition not available in this browser' :
         processing ? 'Processing input...' : 
         listening ? 'Listening... Speak naturally' : 'Click to start voice input'}
      </p>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {rateLimitHit && useAI && (
        <p className="text-amber-600 text-xs mt-1">
          AI processing temporarily limited. Using fallback processing.
        </p>
      )}
      
      {listening && (
        <div className="mt-3 text-sm text-gray-700 bg-blue-50 p-3 rounded">
          <p className="font-medium mb-1">
            {activeField 
              ? `Currently focused on: ${activeField.charAt(0).toUpperCase() + activeField.slice(1)}` 
              : 'Just speak naturally about your information:'}
          </p>
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>"My name is John Smith"</li>
            <li>"My email is john@example.com"</li>
            <li>"Phone number 555-123-4567"</li>
            <li>"I live at 123 Main Street"</li>
            <li>"Submit" when done</li>
          </ul>
          {interimResult && (
            <div className="mt-2 p-2 bg-white rounded text-xs opacity-75">
              Hearing: {interimResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceInput; 