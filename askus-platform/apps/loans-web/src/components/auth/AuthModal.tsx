import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ShieldCheck, CheckCircle2, MessageCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isValidIndianMobile } from '../../utils/validation'
import { isWhatsAppAuthAvailable, loadAuthOptions, type OtpOutcome } from '../../services/api/authService'

type AuthStep = 'initial' | 'email_input' | 'phone_otp' | 'whatsapp_otp' | 'google_phone_input' | 'google_phone_otp'

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    sendPhoneOtp,
    verifyPhoneOtp,
    loginWithGoogle,
    completeGooglePhoneLinking,
    pendingGoogleUser
  } = useAuth()

  const [step, setStep] = useState<AuthStep>('initial')
  const [mobileNumber, setMobileNumber] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [cooldown, setCooldown] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // First sign-in needs an email and a second code; WhatsApp is offered only when the server can deliver on it
  const [emailAddress, setEmailAddress] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [outcome, setOutcome] = useState<OtpOutcome | null>(null)
  const [viaWa, setViaWa] = useState(false)
  const [waAvailable, setWaAvailable] = useState(isWhatsAppAuthAvailable())

  useEffect(() => {
    void loadAuthOptions().then(setWaAvailable)
  }, [])

  // Switch to Google phone input if pendingGoogleUser appears
  useEffect(() => {
    if (pendingGoogleUser) {
      setStep('google_phone_input')
    }
  }, [pendingGoogleUser])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  // Reset modal state on close
  useEffect(() => {
    if (!isAuthModalOpen) {
      setStep('initial')
      setMobileNumber('')
      setOtpCode(['', '', '', '', '', ''])
      setErrorMessage(null)
      setIsSubmitting(false)
      setEmailAddress('')
      setEmailOtp('')
      setOutcome(null)
      setViaWa(false)
    }
  }, [isAuthModalOpen])

  if (!isAuthModalOpen) return null

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobileNumber(val)
    if (errorMessage) setErrorMessage(null)
  }

  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '')
    if (clean.length > 1) {
      // Pasting full OTP
      const digits = clean.slice(0, 6).split('')
      const nextOtp = [...otpCode]
      digits.forEach((d, i) => {
        nextOtp[i] = d
      })
      setOtpCode(nextOtp)
      const nextFocus = document.getElementById(`otp-input-${Math.min(digits.length, 5)}`)
      nextFocus?.focus()
      return
    }

    const next = [...otpCode]
    next[index] = clean.slice(-1)
    setOtpCode(next)

    if (clean && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`)
      prevInput?.focus()
    }
  }

  // 1. Initial Phone OTP Trigger
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidIndianMobile(mobileNumber)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.')
      return
    }
    setErrorMessage(null)
    setIsSubmitting(true)
    const result = await sendPhoneOtp(mobileNumber)
    setIsSubmitting(false)
    if (result) goToCodeStep(result, false)
  }

  // After a code request: ask for the email first (first sign-in), or show the code boxes for the channel used
  const goToCodeStep = (result: OtpOutcome, whatsapp: boolean) => {
    setOutcome(result)
    setViaWa(whatsapp)
    setOtpCode(['', '', '', '', '', ''])
    setEmailOtp('')
    if (result.needsEmail) {
      setStep('email_input')
      return
    }
    setStep(result.mobileChannel === 'whatsapp' ? 'whatsapp_otp' : 'phone_otp')
    setCooldown(30)
  }

  // 2. WhatsApp OTP Trigger
  const handleWhatsAppLogin = async () => {
    if (!isValidIndianMobile(mobileNumber)) {
      setErrorMessage('Please enter your 10-digit mobile number above first.')
      return
    }
    setErrorMessage(null)
    setIsSubmitting(true)
    const result = await sendPhoneOtp(mobileNumber, { whatsapp: true })
    setIsSubmitting(false)
    if (result) goToCodeStep(result, true)
  }

  // First sign-in: the email is the second thing we verify
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      setErrorMessage('Please enter a valid email address.')
      return
    }
    setErrorMessage(null)
    setIsSubmitting(true)
    const result = await sendPhoneOtp(mobileNumber, { email: emailAddress.trim(), whatsapp: viaWa })
    setIsSubmitting(false)
    if (result) goToCodeStep(result, viaWa)
  }

  // "Didn't get it on WhatsApp?": ask again, this time by SMS (first sign-in) or email (later sign-ins)
  const handleSendWithoutWhatsApp = async () => {
    setIsSubmitting(true)
    const result = await sendPhoneOtp(mobileNumber, { email: emailAddress.trim() || undefined })
    setIsSubmitting(false)
    if (result) goToCodeStep(result, false)
  }

  // 3. Google Sign-In
  const handleGoogleLogin = async () => {
    setErrorMessage(null)
    setIsSubmitting(true)
    await loginWithGoogle()
    setIsSubmitting(false)
  }

  // 4. Verify OTP submit
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullOtp = otpCode.join('')
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.')
      return
    }
    setErrorMessage(null)
    setIsSubmitting(true)

    if (step === 'phone_otp' || step === 'whatsapp_otp') {
      if (outcome?.dual && !/^\d{6}$/.test(emailOtp.trim())) {
        setErrorMessage('Please enter the 6-digit code we sent to your email.')
        setIsSubmitting(false)
        return
      }
      const ok = await verifyPhoneOtp(mobileNumber, fullOtp, outcome?.dual ? { email: emailAddress.trim(), emailCode: emailOtp.trim() } : undefined)
      if (!ok) setErrorMessage(step === 'whatsapp_otp' ? 'Invalid WhatsApp security code.' : 'Invalid OTP code. Please try again.')
    } else if (step === 'google_phone_otp') {
      const ok = await completeGooglePhoneLinking(mobileNumber, fullOtp)
      if (!ok) setErrorMessage('Failed to verify mobile for Google account.')
    }
    setIsSubmitting(false)
  }

  // Resend OTP
  const handleResend = async () => {
    if (cooldown > 0) return
    setIsSubmitting(true)
    if (step === 'phone_otp' || step === 'whatsapp_otp') {
      const result = await sendPhoneOtp(mobileNumber, { email: emailAddress.trim() || undefined, whatsapp: viaWa })
      if (result) {
        setOutcome(result)
        setOtpCode(['', '', '', '', '', ''])
        setEmailOtp('')
      }
    } else if (step === 'google_phone_otp') {
      await sendPhoneOtp(mobileNumber)
    }
    setIsSubmitting(false)
    setCooldown(30)
  }

  // The second code of a first sign-in (the first goes in the six boxes)
  const emailCodeField = outcome?.dual ? (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">Code sent to your email ({outcome.emailHint ?? emailAddress})</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={emailOtp}
        onChange={(e) => {
          setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
          if (errorMessage) setErrorMessage(null)
        }}
        placeholder="6-digit email code"
        className="h-12 w-full rounded-xl border-2 border-slate-300 px-3 text-center text-lg font-bold tracking-widest text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  ) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeAuthModal}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-slate-100 text-slate-800"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          {step !== 'initial' ? (
            <button
              onClick={() => {
                setStep('initial')
                setErrorMessage(null)
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck size={18} />
              <span>Secure Passwordless Login</span>
            </div>
          )}

          <button
            onClick={closeAuthModal}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: INITIAL LOGIN VIEW (Matches Login Screenshot Reference Exactly) */}
          {step === 'initial' && (
            <motion.div
              key="step-initial"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <h3 className="text-base sm:text-lg font-normal text-slate-700 leading-snug mb-6">
                For a more personalised experience, sign in with your registered mobile number
              </h3>

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handlePhoneLogin} className="space-y-5">
                {/* Outlined Mobile Number Input with Label Cutout (Exact match to screenshot) */}
                <div className="relative">
                  <div className="rounded-2xl border-2 border-slate-300 focus-within:border-blue-600 transition-all p-1.5 px-3">
                    <label className="absolute -top-2.5 left-4 bg-white px-2 text-xs font-medium text-slate-500">
                      Mobile number
                    </label>

                    <div className="flex items-center h-12">
                      {/* Flag + Selector */}
                      <div className="flex items-center gap-1.5 pr-3 border-r border-slate-300 text-slate-800 font-medium">
                        {/* Indian Flag Emoji or SVG Badge */}
                        <span className="text-xl">🇮🇳</span>
                        <svg
                          className="w-3.5 h-3.5 text-slate-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* +91 code */}
                      <span className="pl-3 pr-2 text-base font-medium text-slate-800">
                        + 91
                      </span>

                      {/* 10-digit Input */}
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={handleMobileChange}
                        placeholder="Enter 10-digit number"
                        autoFocus
                        className="w-full bg-transparent text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* LOGIN WITH OTP Button (Option 1) */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-70"
                >
                  {isSubmitting ? 'Sending OTP...' : 'LOGIN WITH OTP'}
                </button>
              </form>

              {waAvailable && (
                <button
                  type="button"
                  onClick={handleWhatsAppLogin}
                  disabled={isSubmitting}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-white text-sm font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-70"
                >
                  <MessageCircle size={18} />
                  {isSubmitting ? 'Sending…' : 'Login with WhatsApp'}
                </button>
              )}

              {/* Bottom Terms & Policy (Exact match to screenshot) */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-500">
                  By continuing, I agree to the{' '}
                  <a href="#terms" className="underline text-slate-700 hover:text-blue-600">
                    Terms of Use
                  </a>{' '}
                  and{' '}
                  <a href="#privacy" className="underline text-slate-700 hover:text-blue-600">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 1b: FIRST SIGN-IN NEEDS AN EMAIL TOO */}
          {step === 'email_input' && (
            <motion.div
              key="step-email"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-xl font-bold text-slate-900 mb-1">Add your email</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                First sign-in: we verify your mobile ({viaWa ? 'WhatsApp' : 'SMS'}) and your email once. After that, codes come to your email{waAvailable ? ' or WhatsApp' : ' only'}.
              </p>

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={emailAddress}
                  onChange={(e) => {
                    setEmailAddress(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border-2 border-slate-300 px-3 text-base text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 active:scale-[0.99] transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Sending codes…' : 'Send codes'}
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 2: PHONE OTP VERIFICATION */}
          {step === 'phone_otp' && (
            <motion.div
              key="step-phone-otp"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-xl font-bold text-slate-900 mb-1">Verify Mobile OTP</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                {outcome && !outcome.dual && outcome.mobileChannel === null ? (
                  <>
                    Enter the 6-digit code we emailed to <span className="font-semibold text-slate-800">{outcome.emailHint ?? 'your email'}</span>.
                  </>
                ) : (
                  <>
                    Enter the 6-digit verification code sent via SMS to{' '}
                    <span className="font-semibold text-slate-800">+91 {mobileNumber}</span>
                    {outcome?.dual ? ', then the code sent to your email.' : '.'}
                  </>
                )}
              </p>
              {outcome?.whatsappFailed && (
                <p className="-mt-4 mb-5 text-xs text-amber-700">WhatsApp is not available right now, so we sent your code {outcome.dual ? 'by SMS' : 'to your email'} instead.</p>
              )}

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 6-box OTP Input */}
                <div className="flex justify-between gap-2">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-input-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 rounded-xl border-2 border-slate-300 text-center text-xl font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                    />
                  ))}
                </div>

                {emailCodeField}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 active:scale-[0.99] transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isSubmitting}
                  className="font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: WHATSAPP OTP VERIFICATION */}
          {step === 'whatsapp_otp' && (
            <motion.div
              key="step-wa-otp"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">WhatsApp Verification</h3>
              </div>

              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                A 6-digit security code has been sent to your WhatsApp on{' '}
                <span className="font-semibold text-slate-800">{outcome?.mobileHint ?? `+91 ${mobileNumber}`}</span>
                {outcome?.dual ? ', then enter the code sent to your email.' : '.'}
              </p>

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-between gap-2">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-input-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 rounded-xl border-2 border-emerald-300 text-center text-xl font-bold text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition"
                    />
                  ))}
                </div>

                {emailCodeField}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/20 active:scale-[0.99] transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify WhatsApp Code'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>Didn't receive WhatsApp code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isSubmitting}
                  className="font-semibold text-emerald-600 hover:text-emerald-800 disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend WhatsApp OTP'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSendWithoutWhatsApp}
                disabled={isSubmitting}
                className="mt-4 w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:text-slate-400"
              >
                Didn't get it on WhatsApp? Send it by {outcome?.dual ? 'SMS' : 'email'} instead
              </button>
            </motion.div>
          )}

          {/* STEP 4: GOOGLE PHONE NUMBER PROMPT (MANDATORY VERIFIED PHONE POLICY) */}
          {step === 'google_phone_input' && pendingGoogleUser && (
            <motion.div
              key="step-google-phone"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 mb-5">
                <p className="text-xs text-blue-800 font-semibold mb-1">
                  Google Account Authenticated:
                </p>
                <p className="text-sm font-bold text-blue-900 truncate">
                  {pendingGoogleUser.email}
                </p>
                <p className="text-[11px] text-blue-700 mt-2">
                  To comply with financial security policies, every customer account must be linked to a verified Indian mobile number.
                </p>
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-2">
                Enter your Mobile Number for OTP Verification:
              </h4>

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!isValidIndianMobile(mobileNumber)) {
                    setErrorMessage('Please enter a valid 10-digit mobile number.')
                    return
                  }
                  setIsSubmitting(true)
                  const ok = await sendPhoneOtp(mobileNumber)
                  setIsSubmitting(false)
                  if (ok) {
                    setStep('google_phone_otp')
                    setCooldown(30)
                  }
                }}
                className="space-y-4"
              >
                <div className="rounded-2xl border-2 border-slate-300 focus-within:border-blue-600 p-1.5 px-3">
                  <div className="flex items-center h-12">
                    <span className="text-xl mr-2">🇮🇳</span>
                    <span className="pr-2 font-medium text-slate-800 border-r border-slate-300 mr-2">+91</span>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={handleMobileChange}
                      placeholder="10-digit mobile number"
                      autoFocus
                      className="w-full bg-transparent text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Sending OTP...' : 'Send OTP to Link Account'}
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 5: GOOGLE PHONE OTP VERIFY */}
          {step === 'google_phone_otp' && (
            <motion.div
              key="step-google-otp"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-xl font-bold text-slate-900 mb-1">Verify Mobile for Google Link</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Enter the 6-digit code sent to <span className="font-semibold text-slate-800">+91 {mobileNumber}</span> to finalize your account registration.
              </p>

              {errorMessage && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-between gap-2">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-input-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 rounded-xl border-2 border-slate-300 text-center text-xl font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Linking Account...' : 'Verify & Complete Registration'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isSubmitting}
                  className="font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
