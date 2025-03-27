import React from 'react';

interface FormFieldProps {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  isActive: boolean;
  required?: boolean;
  error?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  isActive,
  required = false,
  error
}) => {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        className={`
          block w-full rounded-md shadow-sm
          focus:border-blue-500 focus:ring-blue-500 
          py-3 px-4 border ${isActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} 
          ${error ? 'border-red-500 bg-red-50' : ''}
        `}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {isActive && (
        <span 
          className="absolute right-3 top-9 h-2 w-2 rounded-full bg-blue-500"
          aria-hidden="true"
        ></span>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField; 