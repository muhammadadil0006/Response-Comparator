'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#8B949E] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-[#0B0F17] border-[#30363D] px-3 py-2.5 text-sm text-[#F0F6FC] transition-all duration-200 placeholder:text-[#8B949E] focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 disabled:bg-[#161B22] disabled:text-[#8B949E] ${
            error
              ? 'border-[#F85149] focus:border-[#F85149] focus:ring-[#F85149]/20'
              : ''
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[#F85149]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
