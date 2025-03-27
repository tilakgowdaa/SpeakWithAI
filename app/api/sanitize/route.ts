import { NextResponse } from 'next/server';

// Fetch the API key from environment variables
const apiKey = process.env.GOOGLE_AI_API_KEY;

// Rate limiting state (stored in memory)
type RateLimitState = {
  lastRequestTime: number;
  consecutiveErrors: number;
  backoffMs: number;
  inCooldown: boolean;
};

// Rate limit state shared across requests
let rateLimitState: RateLimitState = {
  lastRequestTime: 0,
  consecutiveErrors: 0,
  backoffMs: 1000, // Start with 1 second backoff
  inCooldown: false
};

// Function to check if we're currently rate limited
function isRateLimited(): boolean {
  const now = Date.now();
  
  // If we're in cooldown, check if cooldown has expired
  if (rateLimitState.inCooldown) {
    if (now - rateLimitState.lastRequestTime > rateLimitState.backoffMs) {
      // Cooldown expired, we can make requests again
      console.log(`Cooldown period (${rateLimitState.backoffMs}ms) expired, allowing requests again`);
      rateLimitState.inCooldown = false;
    } else {
      // Still in cooldown
      return true;
    }
  }
  
  // Not rate limited
  return false;
}

// Function to handle rate limit hit
function handleRateLimit() {
  // Increase consecutive errors
  rateLimitState.consecutiveErrors++;
  
  // Calculate exponential backoff with jitter (0.5-1.5x multiplier)
  const jitter = 0.5 + Math.random();
  // Exponential backoff: start with 1s, then 2s, 4s, 8s, etc. up to 30s max
  rateLimitState.backoffMs = Math.min(
    30000, // 30 seconds max backoff
    rateLimitState.backoffMs * 2 * jitter
  );
  
  rateLimitState.lastRequestTime = Date.now();
  rateLimitState.inCooldown = true;
  
  console.log(`Rate limit hit, backing off for ${rateLimitState.backoffMs}ms`);
}

// Function to handle successful request
function handleSuccessfulRequest() {
  // Reset consecutive errors and reduce backoff
  if (rateLimitState.consecutiveErrors > 0) {
    rateLimitState.consecutiveErrors = 0;
    rateLimitState.backoffMs = 1000; // Reset to base backoff
    console.log('API request successful, reset rate limit backoff');
  }
  
  rateLimitState.lastRequestTime = Date.now();
}

// Simple text cleaning without OpenAI
function basicTextCleaning(text: string, field: string): string {
  text = text.trim();
  
  // Handle different fields with better pattern recognition
  switch (field) {
    case 'name':
      // Remove common conversational prefixes
      return text
        .replace(/^(?:my name is|i am|i'm|call me|name is|my name|i'm called)\s*/i, '')
        .replace(/^(?:this is|it's|it is|just call me)\s*/i, '')
        .trim();
    
    case 'email':
      // Try to extract an email pattern
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) return emailMatch[0];
      
      // Remove verbal noise
      return text
        .replace(/^(?:my email is|email is|my email|email address is|you can reach me at|contact me at)\s*/i, '')
        .replace(/^(?:send mail to|send it to|it's)\s*/i, '')
        .trim();
    
    case 'phone':
      // Extract digits and common phone number separators
      // First, try to find a direct phone pattern
      const phonePattern = /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{10})/;
      const directMatch = text.match(phonePattern);
      if (directMatch) return directMatch[0];
      
      // Remove verbal noise
      let phone = text
        .replace(/^(?:my phone is|phone is|my phone number is|phone number is|call me at|reach me at)\s*/i, '')
        .replace(/^(?:you can reach me at|contact me on|my number is|number is)\s*/i, '')
        .trim();
      
      // Keep only digits and some separators
      phone = phone.replace(/[^\d\s\-+().]/g, '');
      return phone;
    
    case 'address':
      // Remove verbal noise
      return text
        .replace(/^(?:my address is|i live at|address is|location is|residence is|my home is)\s*/i, '')
        .replace(/^(?:i'm at|you can find me at|find me at|i stay at|i'm living at)\s*/i, '')
        .trim();
    
    default:
      return text;
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { text, field } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text input' }, { status: 400 });
    }

    if (!field || !['name', 'email', 'phone', 'address'].includes(field)) {
      return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
    }

    console.log(`Processing ${field} with Google AI: "${text}"`);
    
    // If Google AI Studio API key is configured, use it to sanitize the text
    if (apiKey) {
      // Check if we're currently rate limited
      if (isRateLimited()) {
        console.log('Currently in rate limit cooldown, falling back to basic text cleaning');
        const basicResult = basicTextCleaning(text, field);
        return NextResponse.json({ sanitizedText: basicResult, fromAI: false });
      }
      
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
        
        // Prepare the prompt for Google's Gemini API
        const prompt = `You are a helpful assistant that extracts and formats ${field} information from user speech.
              
        For names: Extract the full name and format it properly with correct capitalization.
        For emails: Extract valid email addresses, or convert text descriptions into proper email format.
        For phone numbers: Extract and format phone numbers consistently as XXX-XXX-XXXX.
        For addresses: Extract address information and format it cleanly.

        Only return the extracted information, nothing else. Do not include explanations or additional text.

        Extract the ${field} from this text: "${text}"`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 100,
            }
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.log('Received 429 rate limit response from Google AI');
            handleRateLimit();
            // Fall back to basic cleaning
            const basicResult = basicTextCleaning(text, field);
            return NextResponse.json({ sanitizedText: basicResult, fromAI: false });
          }
          throw new Error(`Google AI API error: ${response.status}`);
        }

        // Mark successful request
        handleSuccessfulRequest();

        const data = await response.json();
        
        // Extract text from Google AI response
        let sanitizedText = '';
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          sanitizedText = data.candidates[0].content.parts[0].text.trim();
        }
        
        if (sanitizedText) {
          console.log(`Google AI sanitized ${field}: "${sanitizedText}"`);
          return NextResponse.json({ sanitizedText, fromAI: true });
        } else {
          // Fall back to basic cleaning if AI returns empty result
          console.log('Google AI returned empty result, falling back to basic cleaning');
          const basicResult = basicTextCleaning(text, field);
          return NextResponse.json({ sanitizedText: basicResult, fromAI: false });
        }
      } catch (error) {
        console.error('Error using Google AI:', error);
        // Fall back to basic cleaning if Google AI API fails
        const basicResult = basicTextCleaning(text, field);
        return NextResponse.json({ sanitizedText: basicResult, fromAI: false });
      }
    } else {
      // If Google AI is not configured, use basic text cleaning
      console.log('Google AI API key not configured, using basic cleaning');
      const basicResult = basicTextCleaning(text, field);
      return NextResponse.json({ sanitizedText: basicResult, fromAI: false });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Failed to process text' }, { status: 500 });
  }
}

// Enhance the PATCH endpoint to better detect submit commands with AI
export async function PATCH(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text input' }, { status: 400 });
    }

    console.log(`Analyzing speech with Google AI: "${text}"`);
    
    // Check for basic submit intent locally first
    // This allows submit to work even when rate limited
    const submitPattern = /\b(submit|send|done|finish|complete)\b/i;
    if (submitPattern.test(text)) {
      console.log('Submit keyword detected locally, skipping AI call');
      return NextResponse.json({
        submit: {
          value: true,
          confidence: 0.95
        },
        fromAI: false
      });
    }
    
    // If Google AI Studio API key is configured, use it to analyze the speech
    if (apiKey) {
      // Check if we're currently rate limited
      if (isRateLimited()) {
        console.log('Currently in rate limit cooldown, falling back to basic text analysis');
        return processWithRegex(text);
      }
      
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
        
        // Update the prompt to specifically look for submit intent as well
        const prompt = `You are an AI assistant that analyzes user speech to extract form field information or detect submit intent.

        Extract information for these specific fields:
        - name: Person's full name
        - email: Email address
        - phone: Phone number
        - address: Physical address
        
        IMPORTANT: Also determine if the user wants to submit the form. Look for words like "submit", 
        "send", "finish", "complete", "done", etc. If you detect a submit intent, include a "submit" 
        field in your response with value set to true.

        Return a JSON object with the fields you've detected. For each field, include:
        - value: The extracted information
        - confidence: A number between 0-1 indicating your confidence in the extraction

        For the submit intent, if detected, return:
        - submit: { "value": true, "confidence": [your confidence level] }

        Only include fields that you detected in the input. Return valid JSON only, no additional text.

        Extract information from this speech: "${text}"`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 500,
            }
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.log('Received 429 rate limit response from Google AI');
            handleRateLimit();
            // Fall back to regex processing
            return processWithRegex(text);
          }
          throw new Error(`Google AI API error: ${response.status}`);
        }

        // Mark successful request
        handleSuccessfulRequest();

        const data = await response.json();
        
        // Extract JSON from Google AI response
        let analysisResult = '';
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          analysisResult = data.candidates[0].content.parts[0].text.trim();
          
          // Clean the response to ensure it's valid JSON
          analysisResult = analysisResult.replace(/```json\s*|\s*```/g, '');
          
          console.log(`Google AI analysis result: ${analysisResult}`);
          
          try {
            // Parse and return the JSON result
            const parsedResult = JSON.parse(analysisResult);
            return NextResponse.json({ ...parsedResult, fromAI: true });
          } catch (jsonError) {
            console.error('Error parsing Google AI JSON response:', jsonError);
            // Fall back to regex processing
            return processWithRegex(text);
          }
        } else {
          // Return empty result if AI returns nothing
          return processWithRegex(text);
        }
      } catch (error) {
        console.error('Error using Google AI for analysis:', error);
        // Fall back to regex processing
        return processWithRegex(text);
      }
    } else {
      // If Google AI is not configured, return an error
      return processWithRegex(text);
    }
  } catch (error) {
    console.error('Error processing analysis request:', error);
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }
}

// Function to process text using regex patterns when AI is unavailable
function processWithRegex(text: string) {
  console.log('Processing with regex as fallback');
  
  // Extract potential fields using regex patterns
  const extractedFields: Record<string, any> = {};
  
  // Check for submit intent
  const submitPattern = /\b(submit|send|done|finish|complete)\b/i;
  if (submitPattern.test(text)) {
    extractedFields.submit = {
      value: true,
      confidence: 0.9
    };
  }
  
  // Try to extract name
  const namePattern = /\b(?:my name is|i am|i'm|call me|name is|the name is|name|this is)\s+([^,.?!]+)/i;
  const nameMatch = text.match(namePattern);
  if (nameMatch && nameMatch[1]) {
    extractedFields.name = {
      value: nameMatch[1].trim(),
      confidence: 0.8
    };
  }
  
  // Try to extract email
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/i;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    extractedFields.email = {
      value: emailMatch[0],
      confidence: 0.9
    };
  }
  
  // Try to extract phone
  const phonePattern = /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{10})\b/;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    extractedFields.phone = {
      value: phoneMatch[0],
      confidence: 0.9
    };
  }
  
  // Try to extract address
  const addressPattern = /\b(?:my address is|address is|the address is|my address|address|i live at|i'm at|i am at|location is|my location is)\s+([^.?!]+)/i;
  const addressMatch = text.match(addressPattern);
  if (addressMatch && addressMatch[1]) {
    extractedFields.address = {
      value: addressMatch[1].trim(),
      confidence: 0.7
    };
  }
  
  console.log('Regex analysis result:', extractedFields);
  return NextResponse.json({ ...extractedFields, fromAI: false });
} 