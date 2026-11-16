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
  otherIdentifier?: string;
  code?: string;
  otherCode?: string;
}

type Step = 'identifier' | 'other' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>('identifier');
  const [needs, setNeeds] = useState<'email' | 'mobile'>('email');
  const [dual, setDual] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, getValues, formState } = useForm<FormValues>({
    resolver: (values, ctx, opts) =>
      zodResolver(step === 'code' ? verifyOtpSchema : requestOtpSchema)(values, ctx, opts),
  });

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      if (step !== 'code') {
        const other = v.otherIdentifier?.trim();
        if (step === 'other' && !other) return setError(`Enter your ${needs === 'email' ? 'email address' : 'mobile number'}`);
        const r = await api.auth.requestOtp(v.identifier, step === 'other' ? other : undefined);
        if (r.needs) {
          setNeeds(r.needs);
          setStep('other');
          return;
        }
        setDual(r.channels?.length === 2);
        setEmailHint(r.emailHint ?? null);
        setStep('code');
      } else {
        if (dual && !v.otherCode) return setError('Enter both verification codes');
        const other = dual ? { identifier: v.otherIdentifier?.trim() || undefined, code: v.otherCode ?? '' } : undefined;
        signIn(await api.auth.verifyOtp(v.identifier, v.code ?? '', other));
        router.replace('/dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const idIsEmail = getValues('identifier')?.includes('@');
  const firstChannel = idIsEmail ? 'email' : 'mobile (SMS)';
  const otherChannel = idIsEmail ? 'mobile (SMS)' : 'email';

  return (
    <main className="mx-auto mt-24 max-w-sm">
      <Card>
        <h1 className="mb-4 text-xl font-semibold">AskUs Admin</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input placeholder="Mobile or email" readOnly={step !== 'identifier'} {...register('identifier')} />
          {formState.errors.identifier && <p className="text-sm text-red-600">{formState.errors.identifier.message}</p>}
          {step === 'other' && (
            <>
              <p className="text-sm text-gray-600">
                First sign-in: verify your {needs === 'email' ? 'email address' : 'mobile number'} as well.
              </p>
              <Input placeholder={needs === 'email' ? 'Email address' : 'Mobile number'} {...register('otherIdentifier')} />
              {formState.errors.otherIdentifier && (
                <p className="text-sm text-red-600">{formState.errors.otherIdentifier.message}</p>
              )}
            </>
          )}
          {step === 'code' && (
            <>
              <p className="text-sm text-gray-600">
                {dual
                  ? `First sign-in: enter the codes sent to your ${firstChannel} and your ${otherChannel}.`
                  : `Enter the code sent to ${emailHint ?? 'your email'}.`}
              </p>
              <Input
                placeholder={dual ? `6-digit code (${firstChannel})` : '6-digit code'}
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register('code')}
              />
              {formState.errors.code && <p className="text-sm text-red-600">{formState.errors.code.message}</p>}
              {dual && (
                <>
                  <Input placeholder={`6-digit code (${otherChannel})`} inputMode="numeric" {...register('otherCode')} />
                  {formState.errors.otherCode && (
                    <p className="text-sm text-red-600">{formState.errors.otherCode.message}</p>
                  )}
                </>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={formState.isSubmitting} className="w-full">
            {step === 'code' ? 'Verify and sign in' : 'Send code'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
