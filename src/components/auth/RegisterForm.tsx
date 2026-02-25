'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRegisterMutation } from '@/store/api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { extractErrorMessage } from '@/lib/utils/errors';

export function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [register, { isLoading }] = useRegisterMutation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  const [error, setError] = useState('');

  const attemptRegister = async () => {
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const { confirmPassword: _, ...registerData } = formData;
      const result = await register(registerData).unwrap();
      dispatch(setCredentials(result));
      router.push('/compare');
    } catch (err: unknown) {
      const apiError = err as { status?: number; data?: { error?: string } };

      if (apiError?.data?.error) {
        setError(apiError.data.error);
      } else {
        setError(extractErrorMessage(err, 'Registration failed. Please try again.'));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await attemptRegister();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          type="text"
          placeholder="John"
          value={formData.first_name}
          onChange={(e) =>
            setFormData({ ...formData, first_name: e.target.value })
          }
          required
        />
        <Input
          label="Last Name"
          type="text"
          placeholder="Doe"
          value={formData.last_name}
          onChange={(e) =>
            setFormData({ ...formData, last_name: e.target.value })
          }
          required
        />
      </div>

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
        placeholder="Min 8 characters, mixed case + number"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />

      <Input
        label="Confirm Password"
        type="password"
        placeholder="Re-enter your password"
        value={formData.confirmPassword}
        onChange={(e) =>
          setFormData({ ...formData, confirmPassword: e.target.value })
        }
        required
      />

      {error && (
        <div className="rounded-lg border border-[#F85149]/30 bg-[#F85149]/10 p-3">
          <p className="text-sm text-[#F85149]">{error}</p>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>

      <p className="text-center text-sm text-[#8B949E]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
