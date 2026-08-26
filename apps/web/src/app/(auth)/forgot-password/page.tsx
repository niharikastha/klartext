'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Mail, ArrowRight, KeyRound, Shield, Clock } from 'lucide-react'
import { auth } from '@/lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await auth.forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel — matches login */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0"
        style={{ background: '#0f0f23' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 60%, rgba(79,70,229,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(124,58,237,0.25) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-brand-glow">
              <Sparkles size={17} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">klartext</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-3xl font-bold text-white leading-snug mb-3">
              Forgot your
              <br />
              password?
              <br />
              <span className="text-brand-400">No worries.</span>
            </p>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Enter your email and we'll send you a secure link to reset your password in seconds.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Mail, text: 'Reset link sent to your inbox instantly' },
              { icon: Clock, text: 'Link is valid for 1 hour only' },
              { icon: Shield, text: 'Secure one-time use token' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-brand-400" />
                </div>
                <p className="text-slate-300 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-5 text-xs text-slate-600">
          <span>Secure reset</span>
          <span>·</span>
          <span>One-time link</span>
          <span>·</span>
          <span>Expires in 1h</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">klartext</span>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Mail size={24} className="text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your inbox</h1>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                If <span className="font-medium text-slate-700">{email}</span> is registered, you&apos;ll receive a reset link shortly.
              </p>
              <p className="text-xs text-slate-400 mb-8">
                Didn&apos;t get it? Check your spam folder, or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold transition-all',
                    loading
                      ? 'bg-brand-400 cursor-not-allowed text-white'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-brand-glow',
                  )}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    <>Send reset link <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
