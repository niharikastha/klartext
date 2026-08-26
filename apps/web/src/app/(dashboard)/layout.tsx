'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Upload, CheckSquare, LayoutDashboard, LogOut, Sparkles, UserCircle, FolderOpen, MessageSquare, CalendarDays } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth.store'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/action-items', label: 'Action Items', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/ask-ai', label: 'Ask AI', icon: MessageSquare },
  { href: '/profile', label: 'Profile', icon: UserCircle },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, token } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Only redirect after client mount so Zustand has read from localStorage.
  // Redirecting during SSR (token = null before rehydration) would log out a
  // valid session every time the page loads.
  useEffect(() => {
    if (mounted && !token) router.push('/login')
  }, [mounted, token, router])

  if (!mounted || !token) return null

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-[220px] flex flex-col fixed h-full" style={{ background: '#0f0f23' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand-glow flex-shrink-0">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-[15px]">klartext</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-600 text-white shadow-brand-glow'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon size={17} className="flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
              {user?.avatarUrl
                ? <img
                    src={user.avatarUrl.startsWith('/uploads')
                      ? `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api').replace(/\/api$/, '')}${user.avatarUrl}`
                      : user.avatarUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate leading-tight mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="flex items-center gap-2.5 text-sm text-slate-500 hover:text-slate-200 w-full px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
