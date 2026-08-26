'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileText, Clock, AlertTriangle, CheckCircle, Upload, ArrowRight,
  Calendar, Sparkles, TrendingUp, FolderOpen, ChevronRight,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { documents as docsApi } from '@/lib/api'
import { RiskBadge } from '@/components/document/RiskBadge'
import { useAuthStore } from '@/store/auth.store'
import { clsx } from 'clsx'

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  completed: { label: 'Ready',      dot: 'bg-emerald-500', text: 'text-emerald-700' },
  processing: { label: 'Analyzing', dot: 'bg-brand-500 animate-pulse', text: 'text-brand-700' },
  pending:    { label: 'Pending',   dot: 'bg-amber-400',   text: 'text-amber-700' },
  failed:     { label: 'Failed',    dot: 'bg-red-500',     text: 'text-red-700' },
}

function greet(name?: string) {
  const h = new Date().getHours()
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${salutation}, ${name.split(' ')[0]}` : salutation
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    docsApi.list().then(res => {
      setDocs(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const allActions = docs.flatMap((d: any) => d.analysisResult?.actionItems || [])
  const pending    = allActions.filter((a: any) => !a.completed)
  const urgent     = pending.filter((a: any) => a.priority === 'urgent' || a.priority === 'high')
  const completed  = allActions.filter((a: any) => a.completed)
  const recent     = [...docs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)

  const upcoming = pending
    .filter((a: any) => a.deadline)
    .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)

  const critical = pending.filter((a: any) => {
    if (!a.deadline) return false
    const days = differenceInDays(new Date(a.deadline), new Date())
    return days <= 1
  })

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* ── Hero banner ── */}
      <div
        className="px-8 pt-10 pb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f172a 100%)',
        }}
      >
        {/* subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative">
          <p className="text-slate-400 text-sm font-medium mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
            {greet(user?.name)}
          </h1>
          <p className="text-slate-400 text-sm">Here's what's happening with your documents today.</p>
        </div>

        {/* Stat pills */}
        <div className="relative grid grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Documents',       value: docs.length,      icon: FolderOpen,     accent: 'from-brand-500 to-brand-700',  glow: 'shadow-brand-glow' },
            { label: 'Pending Actions', value: pending.length,   icon: Clock,          accent: 'from-amber-500 to-amber-700',  glow: '' },
            { label: 'Urgent',          value: urgent.length,    icon: AlertTriangle,  accent: 'from-red-500 to-red-700',      glow: '' },
            { label: 'Completed',       value: completed.length, icon: CheckCircle,    accent: 'from-emerald-500 to-emerald-700', glow: '' },
          ].map(({ label, value, icon: Icon, accent, glow }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4 hover:bg-white/8 transition-colors">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br flex-shrink-0', accent, glow)}>
                <Icon size={17} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none">{loading ? '—' : value}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Critical deadline banner ── */}
      {!loading && critical.length > 0 && (
        <div className="mx-8 mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              {critical.length} action item{critical.length > 1 ? 's' : ''} due today or tomorrow
            </p>
            <p className="text-xs text-red-600 mt-0.5 truncate">
              {critical.slice(0, 2).map((a: any) => a.title).join(' · ')}
              {critical.length > 2 ? ` +${critical.length - 2} more` : ''}
            </p>
          </div>
          <Link
            href="/action-items"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="px-8 py-6 grid grid-cols-5 gap-6">

        {/* Recent Documents */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-500" />
              <h2 className="font-semibold text-slate-900 text-[15px]">Recent Documents</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/documents"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight size={12} />
              </Link>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Upload size={12} /> Upload
              </Link>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : recent.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-brand-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">No documents yet</p>
                <p className="text-xs text-slate-400 mb-5">Upload your first German document to get started</p>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition-colors"
                >
                  Upload now <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              recent.map((doc: any) => {
                const s = statusConfig[doc.analysisStatus] || statusConfig.pending
                const actionItems = doc.analysisResult?.actionItems || []
                const done = actionItems.filter((i: any) => i.completed).length
                const total = actionItems.length
                return (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-slate-100 group-hover:bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                      <FileText size={16} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-700 transition-colors">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.analysisResult?.documentType && (
                          <span className="text-xs text-slate-400 truncate">{doc.analysisResult.documentType}</span>
                        )}
                        {total > 0 && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-xs text-slate-400">{done}/{total} actions</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {doc.analysisResult?.riskLevel && (
                        <RiskBadge level={doc.analysisResult.riskLevel} />
                      )}
                      <span className={clsx('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100', s.text)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                        {s.label}
                      </span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 text-[15px] mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: '/upload',       icon: Upload,      label: 'Upload',       bg: 'bg-brand-600 hover:bg-brand-700',   text: 'text-white' },
                { href: '/documents',    icon: FolderOpen,  label: 'Documents',    bg: 'bg-slate-100 hover:bg-slate-200',   text: 'text-slate-700' },
                { href: '/action-items', icon: CheckCircle, label: 'Action Items', bg: 'bg-slate-100 hover:bg-slate-200',   text: 'text-slate-700' },
              ].map(({ href, icon: Icon, label, bg, text }) => (
                <Link
                  key={href}
                  href={href}
                  className={clsx('flex items-center gap-2.5 px-4 py-3 rounded-xl font-medium text-sm transition-colors', bg, text)}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-amber-500" />
                <h2 className="font-semibold text-slate-900 text-[15px]">Upcoming Deadlines</h2>
              </div>
              <Link href="/action-items" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors">
                All <ChevronRight size={12} />
              </Link>
            </div>

            <div className="divide-y divide-slate-50">
              {upcoming.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">All clear!</p>
                  <p className="text-xs text-slate-400 mt-1">No upcoming deadlines</p>
                </div>
              ) : (
                upcoming.map((item: any) => {
                  const days = differenceInDays(new Date(item.deadline), new Date())
                  const isOverdue = days < 0
                  const isHot     = days >= 0 && days <= 3
                  const isWarm    = days > 3 && days <= 7
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={clsx(
                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                        isOverdue || isHot ? 'bg-red-50' : isWarm ? 'bg-amber-50' : 'bg-brand-50',
                      )}>
                        <Calendar size={14} className={isOverdue || isHot ? 'text-red-500' : isWarm ? 'text-amber-500' : 'text-brand-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isOverdue
                            ? `Overdue by ${Math.abs(days)}d`
                            : days === 0 ? 'Due today'
                            : days === 1 ? 'Tomorrow'
                            : `${days} days left`}
                          {' · '}{format(new Date(item.deadline), 'MMM d')}
                        </p>
                      </div>
                      <span className={clsx(
                        'text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                        isOverdue || isHot
                          ? 'bg-red-100 text-red-700'
                          : isWarm
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600',
                      )}>
                        {isOverdue ? 'Overdue' : `${days}d`}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
