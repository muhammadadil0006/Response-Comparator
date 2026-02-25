'use client';

import React from 'react';
import { extractErrorMessage } from '@/lib/utils/errors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="rounded-xl border border-[#F85149]/20 bg-[#F85149]/10 p-6">
              <h2 className="text-lg font-semibold text-[#F85149]">
                Something went wrong
              </h2>
              <p className="mt-2 text-sm text-[#8B949E]">
                {extractErrorMessage(
                  this.state.error,
                  'An unexpected error occurred'
                )}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="mt-4 rounded-lg bg-[#1C2128] border border-[#30363D] px-4 py-2 text-sm text-[#F0F6FC] hover:bg-[#30363D] transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
