'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface FormData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export default function Confirmation() {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const retrieveFormData = () => {
      try {
        console.log('Starting data retrieval from localStorage');
        
        // Get the form data from localStorage
        const savedData = localStorage.getItem('formData');
        console.log('Raw data from localStorage:', savedData);
        
        if (!savedData) {
          console.log('No data found in localStorage');
          setError('No submission data found');
          setLoading(false);
          return;
        }
        
        try {
          const parsedData = JSON.parse(savedData);
          console.log('Successfully parsed data:', parsedData);
          
          // Validate the parsed data
          if (parsedData && typeof parsedData === 'object') {
            // Check if we have any non-empty values
            const hasData = Object.values(parsedData).some(value => 
              typeof value === 'string' && value.trim() !== ''
            );
            
            if (hasData) {
              console.log('Valid data found, setting form data');
              setFormData(parsedData);
            } else {
              console.log('Parsed data contains no non-empty values');
              setError('No information was provided in the submission');
            }
          } else {
            console.error('Invalid data structure:', parsedData);
            setError('Invalid submission data format');
          }
        } catch (parseErr) {
          console.error('Failed to parse localStorage data:', parseErr);
          setError('Failed to read submission data');
        }
      } catch (err) {
        console.error('Error accessing localStorage:', err);
        setError('Failed to access submission data');
      } finally {
        setLoading(false);
      }
    };

    // Initial retrieval
    retrieveFormData();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Form Submission</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
            Return to Form
          </Link>
        </div>
      </div>
    );
  }

  if (!formData || Object.values(formData).every(value => !value)) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Form Submission</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700">No information was provided in the submission.</p>
          <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
            Return to Form
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Form Submission Received</h1>
      <div className="bg-white shadow rounded-lg p-6">
        {formData.name && (
          <div className="mb-4">
            <h2 className="font-semibold text-gray-700">Name</h2>
            <p className="text-gray-900">{formData.name}</p>
          </div>
        )}
        {formData.email && (
          <div className="mb-4">
            <h2 className="font-semibold text-gray-700">Email</h2>
            <p className="text-gray-900">{formData.email}</p>
          </div>
        )}
        {formData.phone && (
          <div className="mb-4">
            <h2 className="font-semibold text-gray-700">Phone</h2>
            <p className="text-gray-900">{formData.phone}</p>
          </div>
        )}
        {formData.address && (
          <div className="mb-4">
            <h2 className="font-semibold text-gray-700">Address</h2>
            <p className="text-gray-900">{formData.address}</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Submit Another Form
        </Link>
      </div>
    </div>
  );
} 