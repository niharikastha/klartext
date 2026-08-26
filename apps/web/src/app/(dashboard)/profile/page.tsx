'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Globe, Check, ChevronDown, Lock, Eye, EyeOff,
  Camera, Pencil, ShieldCheck, X, Loader2,
} from 'lucide-react'
import { users } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import Image from 'next/image'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api').replace(/\/api$/, '')

const LANGUAGES = [
  'English', 'Hindi', 'Arabic', 'Turkish', 'Urdu', 'Bengali',
  'Polish', 'Romanian', 'Bulgarian', 'Ukrainian', 'Vietnamese',
  'Persian (Farsi)', 'Spanish', 'French', 'Italian', 'Portuguese',
]

const AVATAR_COLORS = [
  { id: 'indigo', bg: 'bg-indigo-600', text: 'text-white' },
  { id: 'violet', bg: 'bg-violet-600', text: 'text-white' },
  { id: 'rose',   bg: 'bg-rose-500',   text: 'text-white' },
  { id: 'amber',  bg: 'bg-amber-500',  text: 'text-white' },
  { id: 'emerald',bg: 'bg-emerald-600',text: 'text-white' },
  { id: 'sky',    bg: 'bg-sky-500',    text: 'text-white' },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()

  // Profile fields
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || 'English')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null)
  const [avatarColor, setAvatarColor] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('avatarColor') || 'indigo'
    return 'indigo'
  })
  const [langOpen, setLangOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileDirty, setProfileDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password fields
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    users.getMe().then(res => {
      setName(res.data.name)
      setEmail(res.data.email)
      setPreferredLanguage(res.data.preferredLanguage || 'English')
      setAvatarUrl(res.data.avatarUrl || null)
      updateUser({
        preferredLanguage: res.data.preferredLanguage || 'English',
        avatarUrl: res.data.avatarUrl || null,
      })
    })
  }, [])

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Preview immediately
    const preview = URL.createObjectURL(file)
    setAvatarUrl(preview)
    setUploadingAvatar(true)
    try {
      const res = await users.uploadAvatar(file)
      const saved = res.data.avatarUrl as string
      setAvatarUrl(saved)
      updateUser({ avatarUrl: saved })
      toast.success('Profile photo updated')
    } catch {
      setAvatarUrl(avatarUrl) // revert preview on error
      toast.error('Upload failed. Max 5 MB, images only.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarColor = (id: string) => {
    setAvatarColor(id)
    localStorage.setItem('avatarColor', id)
    setProfileDirty(true)
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await users.updateMe({ name, preferredLanguage })
      updateUser({ name: res.data.name, preferredLanguage: res.data.preferredLanguage })
      setProfileDirty(false)
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match')
      return
    }
    if (pwForm.next.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setSavingPw(true)
    try {
      await users.changePassword(pwForm.current, pwForm.next)
      setPwForm({ current: '', next: '', confirm: '' })
      toast.success('Password updated successfully')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Incorrect current password')
    } finally {
      setSavingPw(false)
    }
  }

  const colorObj = AVATAR_COLORS.find(c => c.id === avatarColor) || AVATAR_COLORS[0]
  const pwsMatch = pwForm.confirm === '' || pwForm.next === pwForm.confirm

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Hero banner */}
      <div className="relative h-36 overflow-hidden" style={{ background: '#0f0f23' }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 60%, rgba(79,70,229,0.4) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.25) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 px-8 pt-8">
          <h1 className="text-white font-bold text-xl">Profile &amp; Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your account, language, and security</p>
        </div>
      </div>

      {/* Avatar + identity bar */}
      <div className="px-8 -mt-12 relative z-10">
        <div className="flex items-end gap-5 mb-6">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            {/* Avatar circle */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500"
              disabled={uploadingAvatar}
            >
              {avatarUrl && !avatarUrl.startsWith('blob:') ? (
                <Image
                  src={avatarUrl.startsWith('/uploads') ? `${API_BASE}${avatarUrl}` : avatarUrl}
                  alt="Avatar"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : avatarUrl && avatarUrl.startsWith('blob:') ? (
                // blob preview
                <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className={clsx('w-full h-full flex items-center justify-center text-3xl font-bold select-none', colorObj.bg, colorObj.text)}>
                  {getInitials(name || user?.name || 'U')}
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                {uploadingAvatar
                  ? <Loader2 size={18} className="text-white animate-spin" />
                  : <Camera size={18} className="text-white" />}
                {!uploadingAvatar && <span className="text-white text-[10px] font-medium">Change</span>}
              </div>
            </button>

            {/* Uploading ring */}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-2xl border-4 border-brand-500 animate-pulse pointer-events-none" />
            )}
          </div>

          {/* Name + email block — on dark banner bg, use light text */}
          <div className="pb-2">
            <h2 className="text-xl font-bold text-white leading-tight drop-shadow">{name || user?.name}</h2>
            <p className="text-sm text-slate-300">{email || user?.email}</p>
          </div>
        </div>

        {/* Avatar color row */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-xs text-slate-400 font-medium mr-1">Avatar color:</span>
          {AVATAR_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => handleAvatarColor(c.id)}
              className={clsx(
                'w-6 h-6 rounded-full transition-all',
                c.bg,
                avatarColor === c.id ? 'ring-2 ring-offset-2 ring-brand-600 scale-110' : 'hover:scale-105',
              )}
            />
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-8 pb-12 grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Personal info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Pencil size={14} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Personal info</p>
              <p className="text-xs text-slate-400">Update your display name</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setProfileDirty(true) }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white transition-all"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed.</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !profileDirty}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  savingProfile || !profileDirty
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
                )}
              >
                {savingProfile ? <><Spinner /> Saving...</> : 'Save changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Language preference */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Globe size={14} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Language preference</p>
              <p className="text-xs text-slate-400">Translations target this language</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Preferred language</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all hover:bg-white"
                >
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-slate-400" />
                    <span>{preferredLanguage}</span>
                  </div>
                  <ChevronDown size={15} className={clsx('text-slate-400 transition-transform', langOpen && 'rotate-180')} />
                </button>

                {langOpen && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 max-h-52 overflow-y-auto">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setPreferredLanguage(lang)
                          setLangOpen(false)
                          setProfileDirty(true)
                        }}
                        className={clsx(
                          'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                          lang === preferredLanguage
                            ? 'text-brand-700 bg-brand-50'
                            : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {lang}
                        {lang === preferredLanguage && <Check size={13} className="text-brand-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Used for new document analyses and the retranslate button on document pages.
              </p>
            </div>

            <div className="bg-brand-50 rounded-xl p-3.5 border border-brand-100">
              <div className="flex items-start gap-2.5">
                <Globe size={14} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-brand-700 leading-relaxed">
                  When you upload a document, it will be analysed and translated into <strong>{preferredLanguage}</strong>. You can always retranslate on the document page.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !profileDirty}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  savingProfile || !profileDirty
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
                )}
              >
                {savingProfile ? <><Spinner /> Saving...</> : 'Save changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Change password — full width */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden xl:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Lock size={14} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Change password</p>
              <p className="text-xs text-slate-400">Use a strong password you don&apos;t use elsewhere</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <ShieldCheck size={11} />
              Secured
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white transition-all"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white transition-all"
                    placeholder="Min 8 characters"
                  />
                  <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    autoComplete="new-password"
                    className={clsx(
                      'w-full px-4 py-3 pr-11 bg-slate-50 border rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all',
                      !pwsMatch
                        ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
                        : 'border-slate-200 focus:ring-brand-500/30 focus:border-brand-500',
                    )}
                    placeholder="Retype new password"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {!pwsMatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
              </div>
            </div>

            <div className="flex justify-end mt-5">
              {(pwForm.current || pwForm.next || pwForm.confirm) && (
                <button
                  type="button"
                  onClick={() => setPwForm({ current: '', next: '', confirm: '' })}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mr-3"
                >
                  <X size={14} /> Clear
                </button>
              )}
              <button
                type="submit"
                disabled={savingPw || !pwsMatch}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  savingPw || !pwsMatch
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
                )}
              >
                {savingPw ? <><Spinner /> Updating...</> : <><Lock size={14} /> Update password</>}
              </button>
            </div>
          </form>
        </div>


      </div>
    </div>
  )
}
