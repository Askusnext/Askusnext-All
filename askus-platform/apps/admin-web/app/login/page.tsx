'use client';

import { useAuth } from '@askus/authentication';
import { Button, Card, Input } from '@askus/ui-components';
import { requestOtpSchema, verifyOtpSchema } from '@askus/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';

interface FormValues {
  identifier: string;
  code?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: (values, ctx, opts) =>
      zodResolver(step === 'identifier' ? requestOtpSchema : verifyOtpSchema)(values, ctx, opts),
  });

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      if (step === 'identifier') {
        await api.auth.requestOtp(v.identifier);
        setStep('code');
      } else {
        signIn(await api.auth.verifyOtp(v.identifier, v.code ?? ''));
        router.replace('/dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  return (
    <main className="mx-auto mt-24 max-w-sm">
      <Card>
        <h1 className="mb-4 text-xl font-semibold">AskUs Admin</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input placeholder="Mobile or email" readOnly={step === 'code'} {...register('identifier')} />
          {formState.errors.identifier && <p className="text-sm text-red-600">{formState.errors.identifier.message}</p>}
          {step === 'code' && (
            <>
              <Input placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
              {formState.errors.code && <p className="text-sm text-red-600">{formState.errors.code.message}</p>}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={formState.isSubmitting} className="w-full">
            {step === 'identifier' ? 'Send code' : 'Verify and sign in'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
