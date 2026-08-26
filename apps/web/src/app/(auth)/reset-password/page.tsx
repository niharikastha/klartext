'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Sparkles, Eye, EyeOff, ArrowLeft, KeyRound, ArrowRight, Check, ShieldCheck, Lock } from 'lucide-react'
import { auth } from '@/lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const passwordsMatch = form.confirm === '' || form.password === form.confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (!token) {
      toast.error('Invalid or missing reset token')
      return
    }
    setLoading(true)
    try {
      await auth.resetPassword(token, form.password)
      setDone(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Reset link expired or invalid')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Check size={24} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Password updated!</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-all"
        >
          Sign in <ArrowRight size={15} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
        <p className="text-slate-500 text-sm mt-1">Choose a strong password for your account.</p>
      </div>

      {!token && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Invalid or missing reset token. Please request a new{' '}
          <Link href="/forgot-password" className="underline font-medium">reset link</Link>.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white transition-all"
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              className={clsx(
                'w-full px-4 py-3 pr-11 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all',
                !passwordsMatch
                  ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
                  : 'border-slate-200 focus:ring-brand-500/30 focus:border-brand-500',
              )}
              placeholder="Retype new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {!passwordsMatch && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !passwordsMatch || !token}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold transition-all',
            loading || !passwordsMatch || !token
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
              Updating...
            </span>
          ) : (
            <>Update password <ArrowRight size={15} /></>
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
  )
}

export default function ResetPasswordPage() {
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
              Almost back
              <br />
              in business.
              <br />
              <span className="text-brand-400">You&apos;ve got this.</span>
            </p>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Set a new password and get back to understanding your German documents without the stress.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Lock, text: 'Use at least 8 characters for a strong password' },
              { icon: ShieldCheck, text: 'Avoid reusing passwords from other sites' },
              { icon: KeyRound, text: 'This link expires in 1 hour' },
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
          <span>Token expires in 1h</span>
          <span>·</span>
          <span>One-time use</span>
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

          <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
