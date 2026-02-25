'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLoginMutation } from '@/store/api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { extractErrorMessage } from '@/lib/utils/errors';
import { HttpStatus } from '@/types/enums';

export function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const attemptLogin = async () => {
    setError('');
    try {
      const result = await login(formData).unwrap();
      dispatch(setCredentials(result));
      router.push('/compare');
    } catch (err: unknown) {
      const apiError = err as { status?: number; data?: { error?: string } };

      if (apiError?.status === HttpStatus.UNAUTHORIZED) {
        setError('Invalid email or password');
      } else if (apiError?.data?.error) {
        setError(apiError.data.error);
      } else {
        setError(extractErrorMessage(err, 'An error occurred. Please try again.'));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await attemptLogin();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />

      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />

      {error && (
        <div className="rounded-lg border border-[#F85149]/30 bg-[#F85149]/10 p-3">
          <p className="text-sm text-[#F85149]">{error}</p>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      <p className="text-center text-sm text-[#8B949E]">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
