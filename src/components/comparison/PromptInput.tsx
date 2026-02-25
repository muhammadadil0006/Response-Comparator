'use client';

import { useRef, useState, FormEvent } from 'react';

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
      // reset height after send
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-end rounded-2xl border border-[#30363D] bg-[#161B22] shadow-card transition-all duration-200 focus-within:border-primary-500/60 focus-within:ring-2 focus-within:ring-primary-500/15 focus-within:shadow-glow-sm">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPromptValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message AI Playground…"
          disabled={disabled || isLoading}
          rows={1}
          maxLength={10000}
          className="max-h-50 min-h-11 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-[#F0F6FC] placeholder:text-[#8B949E]/60 focus:outline-none disabled:text-[#8B949E]"
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
        <div className="flex shrink-0 items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-lg p-2 text-[#8B949E] transition-colors hover:bg-[#1C2128] hover:text-[#F0F6FC]"
            title="Upload file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openImagePicker}
            className="rounded-lg p-2 text-[#8B949E] transition-colors hover:bg-[#1C2128] hover:text-[#F0F6FC]"
            title="Upload image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.06l-2.22-2.22a.75.75 0 0 0-1.06 0L9.06 13.06a.75.75 0 0 1-1.06 0l-1.94-1.94a.75.75 0 0 0-1.06 0L2.5 13.56ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading || disabled}
            className="ml-1 rounded-lg bg-primary-500 p-2 text-white transition-all duration-200 hover:bg-primary-600 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-40"
            title="Send"
          >
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {(selectedFileName || selectedImageName || uploadError) && (
        <div className="mt-2 space-y-1 text-xs">
          {selectedFileName && (
            <p className="text-[#8B949E]">File: {selectedFileName}</p>
          )}
          {selectedImageName && (
            <p className="text-[#8B949E]">Image: {selectedImageName}</p>
          )}
          {uploadError && (
            <p className="text-[#F85149]">{uploadError}</p>
          )}
        </div>
      )}
    </form>
  );
}
