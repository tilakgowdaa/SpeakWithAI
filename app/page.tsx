'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VoiceInput from './components/VoiceInput';
import FormField from './components/FormField';

type FormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

type FormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

// Define detected information structure for semantic understanding
interface DetectedField {
  field: keyof FormData;
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

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [activeField, setActiveField] = useState<keyof FormData | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [lastSpeech, setLastSpeech] = useState('');
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable' | 'rate_limited'>('checking');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Check API status on component mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        setApiStatus('checking');
        // Use AbortController to add a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        const response = await fetch('/api/sanitize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: 'test',
            field: 'name'
          }),
          signal: controller.signal
        }).catch(err => {
          console.error('API status check failed:', err);
          return null;
        });

        clearTimeout(timeoutId);
        
        if (response && response.ok) {
          const data = await response.json();
          if (data.fromAI === false) {
            // API is rate limited
            console.log('API is rate limited');
            setApiStatus('rate_limited');
          } else {
            console.log('API is available');
            setApiStatus('available');
          }
        } else {
          console.log('API is not available or returned error');
          setApiStatus('unavailable');
        }
      } catch (err) {
        console.error('Error checking API status:', err);
        setApiStatus('unavailable');
      }
    };

    checkApiStatus();
    
    // Set up an interval to check API status periodically
    const intervalId = setInterval(checkApiStatus, 60000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, []);

  // Manage the useAI state based on API status
  useEffect(() => {
    if (apiStatus === 'unavailable') {
      setUseAI(false);
    } else if (apiStatus === 'available') {
      // Only auto-enable if it was previously disabled due to availability issues
      const wasUnavailable = localStorage.getItem('wasApiUnavailable') === 'true';
      if (wasUnavailable) {
        setUseAI(true);
        localStorage.removeItem('wasApiUnavailable');
      }
    }
    
    // Store unavailable status to remember for when it becomes available
    if (apiStatus === 'unavailable') {
      localStorage.setItem('wasApiUnavailable', 'true');
    }
  }, [apiStatus]);

  const handleVoiceInput = (understanding: VoiceUnderstanding) => {
    console.log('Received voice understanding:', understanding);
    setLastSpeech(understanding.originalText);
    
    // Clear any previous error
    setError('');
    
    try {
      // Process based on the intent
      switch (understanding.intent) {
        case 'submit':
          console.log('Submit intent detected from voice input');
          
          // Get current DOM input values directly instead of relying on state
          const nameInput = (document.getElementById('name') as HTMLInputElement)?.value || '';
          const emailInput = (document.getElementById('email') as HTMLInputElement)?.value || '';
          const phoneInput = (document.getElementById('phone') as HTMLInputElement)?.value || '';
          const addressInput = (document.getElementById('address') as HTMLInputElement)?.value || '';
          
          // Create submission data from DOM values
          const submissionData = {
            name: nameInput.trim(),
            email: emailInput.trim(),
            phone: phoneInput.trim(),
            address: addressInput.trim()
          };
          
          // Verify we have some data
          const hasAnyData = Object.values(submissionData).some(value => value !== '');
          if (!hasAnyData) {
            console.log('No form data to submit');
            setError('Please provide some information before submitting.');
            return;
          }
          
          // Log the submission data
          console.log('Voice command triggering form submission with data (from DOM):', submissionData);
          
          try {
            // Store DOM values in localStorage directly
            localStorage.setItem('formData', JSON.stringify(submissionData));
            console.log('Successfully saved form data to localStorage:', submissionData);
            
            // Verify the data was saved correctly
            const savedData = localStorage.getItem('formData');
            console.log('Raw saved data:', savedData);
            
            // Add a small delay to ensure localStorage is updated before navigation
            console.log('Waiting before navigation...');
            setTimeout(() => {
              // Navigate to the confirmation page
              console.log('Navigating to confirmation page');
              router.push('/confirmation');
            }, 500);
          } catch (err) {
            console.error('Error during form submission:', err);
            setError('Failed to submit the form. Please try again.');
          }
          break;
          
        case 'clear':
          handleClearForm();
          break;
          
        case 'provide_info':
          // Process each detected field
          if (understanding.detectedFields.length > 0) {
            console.log('Processing detected fields:', understanding.detectedFields);
            
            // Update each field
            understanding.detectedFields.forEach(field => {
              if (field.value) {
                console.log(`Updating field ${field.field} with value: ${field.value}`);
                handleFieldUpdate(field.field, field.value);
              }
            });
            
            // Set active field to the highest confidence field
            const highestConfidenceField = [...understanding.detectedFields]
              .sort((a, b) => b.confidence - a.confidence)[0];
              
            if (highestConfidenceField) {
              setActiveField(highestConfidenceField.field);
            }
            
            // Log the updated form data
            console.log('Updated form data:', formData);
          } else {
            setError('No specific fields were detected in your speech. Please try again with clearer details.');
          }
          break;
          
        case 'unknown':
        default:
          // For unknown intent, just display a message
          setError('I didn\'t understand that. Please try a phrase like "My name is..." or say "submit" when ready.');
          break;
      }
    } catch (err) {
      console.error('Error handling voice understanding:', err);
      setError('Error processing your voice input. Please try again.');
    }
  };

  const handleFieldUpdate = (field: keyof FormData, value: string) => {
    console.log(`Updating field ${field} with value: ${value}`);
    
    // Update the form data using a callback to ensure we have the latest state
    setFormData(prevData => {
      const newData = { ...prevData, [field]: value };
      console.log('Updated form data:', newData);
      return newData;
    });
    
    // Set the active field
    setActiveField(field);
    
    // Clear any previous errors for this field
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Validate the field if needed
    if (field === 'email' && value && !isValidEmail(value)) {
      setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    } else if (field === 'phone' && value && !isValidPhone(value)) {
      setFormErrors(prev => ({ ...prev, phone: 'Please enter a valid phone number' }));
    }
    
    // Focus on the input element
    setTimeout(() => {
      const inputElement = document.getElementById(field);
      if (inputElement) {
        inputElement.focus();
        // Also update the input value directly to ensure it's in sync
        (inputElement as HTMLInputElement).value = value;
      }
    }, 100);
    
    // Check if all required fields are filled and show a prompt when complete
    checkFormProgress();
  };

  const checkFormProgress = () => {
    // Show submit prompt when any field is filled
    if (formData.name || formData.email || formData.phone || formData.address) {
      setError('Say "submit" when you\'re ready to submit the form.');
    }
  };

  const handleClearForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '' });
    setFormErrors({});
    setActiveField(null);
    setError('Form has been cleared. You can start over.');
  };

  const validateForm = () => {
    // All forms are valid now, no required fields
    return true;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    console.log('Starting form submission process');
    console.log('Current form data state:', formData);
    
    // Get form data - rename variable to avoid conflict with state
    const submissionData = {
      name: formData.name?.trim() || '',
      email: formData.email?.trim() || '',
      phone: formData.phone?.trim() || '',
      address: formData.address?.trim() || ''
    };
    
    console.log('Prepared submission data:', submissionData);
    
    try {
      // Store the data in localStorage
      localStorage.setItem('formData', JSON.stringify(submissionData));
      console.log('Successfully saved to localStorage');
      
      // Verify the data was saved
      const savedData = localStorage.getItem('formData');
      console.log('Verification - Data in localStorage:', savedData);
      
      // Add a small delay to ensure localStorage is updated before navigation
      console.log('Waiting for localStorage to update before navigation...');
      setTimeout(() => {
        // Navigate to the confirmation page
        console.log('Navigating to confirmation page');
        router.push('/confirmation');
      }, 500); // 500ms delay to ensure storage completes
    } catch (err) {
      console.error('Error during form submission:', err);
      setError('Failed to submit the form. Please try again.');
    }
  };

  // Simple email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Simple phone validation
  const isValidPhone = (phone: string): boolean => {
    // Allow various formats like XXX-XXX-XXXX, (XXX) XXX-XXXX, etc.
    const phoneRegex = /^[\d\s()+-.]{10,15}$/;
    return phoneRegex.test(phone);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear field-specific error when user types
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors({ ...formErrors, [name]: undefined });
    }
  };

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2">SPEAK WITH AI</h1>
        <p className="text-gray-600">
          Fill out the form using your voice. Just speak naturally about your information.
        </p>
      </header>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Voice Control</h2>
          <div className="flex items-center">
            <label className={`inline-flex items-center cursor-pointer mr-2 ${apiStatus === 'unavailable' ? 'opacity-50' : ''}`}>
              <input 
                type="checkbox" 
                checked={useAI} 
                onChange={() => setUseAI(prev => apiStatus !== 'unavailable' ? !prev : false)} 
                className="sr-only peer"
                disabled={apiStatus === 'unavailable'}
              />
              <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-2 text-sm font-medium text-gray-700">Use AI Processing (Recommended)</span>
            </label>
            {apiStatus === 'checking' && (
              <span className="text-xs text-yellow-600 ml-2">Checking API...</span>
            )}
            {apiStatus === 'unavailable' && (
              <span className="text-xs text-red-600 ml-2">AI API Unavailable</span>
            )}
            {apiStatus === 'rate_limited' && (
              <span className="text-xs text-amber-600 ml-2">AI Temporarily Limited</span>
            )}
            {apiStatus === 'available' && (
              <span className="text-xs text-green-600 ml-2">AI API Ready</span>
            )}
          </div>
        </div>

        <VoiceInput 
          onVoiceInput={handleVoiceInput} 
          listening={listening}
          setListening={setListening}
          useAI={useAI}
          activeField={activeField || ''}
        />
        
        {lastSpeech && (
          <div className="mt-2 text-xs text-gray-500">
            Last heard: "{lastSpeech}"
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md">
          {error}
        </div>
      )}

      <form ref={formRef} className="space-y-4 bg-white p-6 rounded-lg shadow-sm" onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}>
        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
        
        <FormField
          label="Name"
          id="name"
          type="text"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Example: My name is John Smith"
          isActive={activeField === 'name'}
          required={false}
          error={formErrors.name}
        />
        
        <FormField
          label="Email"
          id="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Example: My email is john@example.com"
          isActive={activeField === 'email'}
          required={false}
          error={formErrors.email}
        />
        
        <FormField
          label="Phone"
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder="Example: My phone number is 555-123-4567"
          isActive={activeField === 'phone'}
          error={formErrors.phone}
        />
        
        <FormField
          label="Address"
          id="address"
          type="text"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="Example: I live at 123 Main St, City, State"
          isActive={activeField === 'address'}
          error={formErrors.address}
        />

        <div className="flex justify-between items-center pt-4">
          <button
            type="button"
            onClick={handleClearForm}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition"
          >
            Clear All
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
} 