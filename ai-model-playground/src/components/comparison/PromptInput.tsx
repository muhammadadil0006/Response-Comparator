'use client';

import { useRef, useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  isAuthenticated?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export function PromptInput({
  onSubmit,
  isLoading,
  disabled = false,
  isAuthenticated = false,
  value,
  onChange,
}: PromptInputProps) {
  const [internalPrompt, setInternalPrompt] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const prompt = value ?? internalPrompt;

  const setPromptValue = (nextValue: string) => {
    if (onChange) {
      onChange(nextValue);
      return;
    }
    setInternalPrompt(nextValue);
  };

  const requireAuthForUpload = () => {
    if (isAuthenticated) {
      setUploadError('');
      return true;
    }
    setUploadError('Please sign in to upload files and images.');
    return false;
  };

  const openFilePicker = () => {
    if (!requireAuthForUpload()) return;
    fileInputRef.current?.click();
  };

  const openImagePicker = () => {
    if (!requireAuthForUpload()) return;
    imageInputRef.current?.click();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPromptValue(e.target.value)}
          placeholder="Enter your prompt here to compare AI model responses..."
          disabled={disabled || isLoading}
          rows={3}
          maxLength={10000}
          className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-24 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setSelectedFileName(file?.name || '');
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setSelectedImageName(file?.name || '');
          }}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Upload file"
          >
            📎
          </button>
          <button
            type="button"
            onClick={openImagePicker}
            className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Upload image"
          >
            🖼️
          </button>
          <span className="text-xs text-gray-400">
            {prompt.length}/10000
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!prompt.trim() || isLoading || disabled}
            isLoading={isLoading}
          >
            Compare
          </Button>
        </div>
      </div>
      {(selectedFileName || selectedImageName || uploadError) && (
        <div className="mt-2 space-y-1 text-xs">
          {selectedFileName && (
            <p className="text-gray-500 dark:text-gray-400">File: {selectedFileName}</p>
          )}
          {selectedImageName && (
            <p className="text-gray-500 dark:text-gray-400">Image: {selectedImageName}</p>
          )}
          {uploadError && (
            <p className="text-red-600 dark:text-red-400">{uploadError}</p>
          )}
        </div>
      )}
    </form>
  );
}
