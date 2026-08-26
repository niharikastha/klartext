'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, Trash2, AlertTriangle, Plus, X,
  Globe, Check, Eye, EyeOff, Download, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Layers, Sparkles, Calendar, RefreshCw, History, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'
import { documents, actionItems as actionItemsApi, analysis as analysisApi, tags as tagsApi } from '@/lib/api'
import { TagEditor } from '@/components/document/TagEditor'
import { ChatPanel } from '@/components/document/ChatPanel'
import { useAuthStore } from '@/store/auth.store'
import { RiskBadge } from '@/components/document/RiskBadge'
import { ActionItemCard } from '@/components/document/ActionItemCard'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const LANGUAGES = [
  'English', 'Hindi', 'Arabic', 'Turkish', 'Urdu', 'Bengali',
  'Polish', 'Romanian', 'Bulgarian', 'Ukrainian', 'Vietnamese',
  'Persian (Farsi)', 'Spanish', 'French', 'Italian', 'Portuguese',
]

const riskColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
  high:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    label: 'High Risk' },
  medium: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  label: 'Medium Risk' },
  low:    { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',label: 'Low Risk' },
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [doc, setDoc]                   = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [showViewer, setShowViewer]     = useState(false)
  const [textContent, setTextContent]   = useState<string | null>(null)
  const [loadingText, setLoadingText]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [newItem, setNewItem]           = useState({ title: '', description: '', deadline: '', priority: 'medium', category: 'other' })
  const [addingItem, setAddingItem]     = useState(false)
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [activeTranslationLang, setActiveTranslationLang] = useState<string | null>(null)
  const [translatingLang, setTranslatingLang]             = useState<string | null>(null)
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [showKeyData, setShowKeyData]   = useState(true)
  const [revisions, setRevisions]       = useState<any[]>([])
  const [reanalyzing, setReanalyzing]   = useState(false)
  const [showRevisions, setShowRevisions] = useState(false)
  const [viewingRevision, setViewingRevision] = useState<any | null>(null)
  const [showChat, setShowChat]         = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      documents.get(id)
        .then(res => {
          if (cancelled) return
          setDoc(res.data)
          setLoading(false)
          // Load saved translations once the doc is ready
          const ar = res.data.analysisResult
          if (ar?.id) {
            analysisApi.getTranslations(ar.id).then(tr => {
              if (!cancelled) setTranslations(tr.data)
            }).catch(() => {})
            analysisApi.getRevisions(ar.id).then(rv => {
              if (!cancelled) setRevisions(rv.data)
            }).catch(() => {})
          }
          if (res.data.analysisStatus === 'processing' || res.data.analysisStatus === 'pending') {
            setTimeout(load, 3000)
          }
        })
        .catch(() => {
          if (cancelled) return
          setLoading(false)
          setDoc((prev: any) => {
            if (prev && (prev.analysisStatus === 'processing' || prev.analysisStatus === 'pending')) {
              return { ...prev, analysisStatus: 'failed', _serverDown: true }
            }
            return prev
          })
        })
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const handleToggle = async (actionId: string, currentlyCompleted: boolean) => {
    if (currentlyCompleted) await actionItemsApi.uncomplete(actionId)
    else await actionItemsApi.complete(actionId)
    setDoc((prev: any) => ({
      ...prev,
      analysisResult: {
        ...prev.analysisResult,
        actionItems: prev.analysisResult.actionItems.map((i: any) =>
          i.id === actionId ? { ...i, completed: !currentlyCompleted } : i,
        ),
      },
    }))
    toast.success(currentlyCompleted ? 'Marked as incomplete' : 'Marked as complete!')
  }

  const handleDeadlineChange = async (actionId: string, deadline: string | null) => {
    await actionItemsApi.updateDeadline(actionId, deadline)
    setDoc((prev: any) => ({
      ...prev,
      analysisResult: {
        ...prev.analysisResult,
        actionItems: prev.analysisResult.actionItems.map((i: any) =>
          i.id === actionId ? { ...i, deadline: deadline ? new Date(deadline).toISOString() : null } : i,
        ),
      },
    }))
    toast.success('Deadline updated')
  }

  const handleDeleteActionItem = async (actionId: string) => {
    await actionItemsApi.delete(actionId)
    setDoc((prev: any) => ({
      ...prev,
      analysisResult: {
        ...prev.analysisResult,
        actionItems: prev.analysisResult.actionItems.filter((i: any) => i.id !== actionId),
      },
    }))
    toast.success('Action item deleted')
  }

  const handleEdit = async (actionId: string, data: any) => {
    await actionItemsApi.update(actionId, data)
    setDoc((prev: any) => ({
      ...prev,
      analysisResult: {
        ...prev.analysisResult,
        actionItems: prev.analysisResult.actionItems.map((i: any) =>
          i.id === actionId ? { ...i, ...data, deadline: data.deadline ? new Date(data.deadline).toISOString() : null } : i,
        ),
      },
    }))
    toast.success('Action item updated')
  }

  const handleAddItem = async () => {
    if (!newItem.title.trim()) return
    setAddingItem(true)
    try {
      const res = await actionItemsApi.create({
        analysisResultId: doc.analysisResult.id,
        title: newItem.title,
        description: newItem.description,
        deadline: newItem.deadline || null,
        priority: newItem.priority,
        category: newItem.category,
      })
      setDoc((prev: any) => ({
        ...prev,
        analysisResult: { ...prev.analysisResult, actionItems: [...prev.analysisResult.actionItems, res.data] },
      }))
      setNewItem({ title: '', description: '', deadline: '', priority: 'medium', category: 'other' })
      setShowAddForm(false)
      toast.success('Action item added')
    } finally {
      setAddingItem(false)
    }
  }

  const handleRetranslate = async (lang: string) => {
    if (translations[lang]) { setActiveTranslationLang(lang); return }
    setTranslatingLang(lang)
    setActiveTranslationLang(lang)
    try {
      const res = await analysisApi.retranslate(doc.analysisResult.id, lang)
      setTranslations(prev => ({ ...prev, [lang]: res.data }))
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')
      const isNetworkDown = !err?.response
      const retryAfter: number | undefined = err?.response?.data?.retryAfter
      const isRateLimit = err?.response?.status === 429 || err?.response?.data?.isRateLimit

      if (isRateLimit) {
        toast.error(
          retryAfter
            ? `Rate limit reached — please wait ${retryAfter}s and try again`
            : 'Rate limit reached — please wait a minute and try again',
          { duration: 6000 },
        )
      } else {
        toast.error(
          isTimeout || isNetworkDown
            ? 'Server unavailable — translation failed'
            : 'Translation failed',
        )
      }
      // Remove the pending tab so the UI doesn't show a stuck spinner
      setActiveTranslationLang(null)
      setTranslations(prev => {
        const n = { ...prev }
        delete n[lang]
        return n
      })
    } finally {
      setTranslatingLang(null)
    }
  }

  const handleReanalyze = async () => {
    if (!analysis?.id) return
    if (!confirm('Re-analyze this document? The current analysis will be saved as a revision.')) return
    setReanalyzing(true)
    setViewingRevision(null)
    try {
      const res = await analysisApi.reanalyze(analysis.id)
      setDoc((prev: any) => ({ ...prev, analysisResult: res.data }))
      const rv = await analysisApi.getRevisions(analysis.id)
      setRevisions(rv.data)
      setTranslations({})
      setActiveTranslationLang(null)
      toast.success('Document re-analyzed successfully')
    } catch (err: any) {
      const retryAfter: number | undefined = err?.response?.data?.retryAfter
      const isRateLimit = err?.response?.status === 429 || err?.response?.data?.isRateLimit
      if (isRateLimit) {
        toast.error(
          retryAfter
            ? `Rate limit reached — please wait ${retryAfter}s and try again`
            : 'Rate limit reached — please wait a minute and try again',
          { duration: 6000 },
        )
      } else {
        toast.error('Re-analysis failed — please try again')
      }
    } finally {
      setReanalyzing(false)
    }
  }

  const handleRestoreRevision = async (revisionId: string) => {
    if (!analysis?.id) return
    if (!confirm('Restore this revision? The current analysis will be saved as a new revision.')) return
    try {
      const res = await analysisApi.restoreRevision(analysis.id, revisionId)
      setDoc((prev: any) => ({ ...prev, analysisResult: res.data }))
      const rv = await analysisApi.getRevisions(analysis.id)
      setRevisions(rv.data)
      setViewingRevision(null)
      setTranslations({})
      setActiveTranslationLang(null)
      toast.success('Revision restored')
    } catch {
      toast.error('Failed to restore revision')
    }
  }

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api').replace(/\/api$/, '')
  const getFileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath.split('/').pop()}`

  const handleOpenViewer = async () => {
    setShowViewer(v => !v)
    const ft = doc?.fileType || ''
    if (!showViewer && (ft === 'text/plain' || ft.includes('text')) && textContent === null) {
      setLoadingText(true)
      try {
        const res = await fetch(getFileUrl(doc.filePath))
        setTextContent(await res.text())
      } catch { setTextContent('Could not load file contents.') }
      finally { setLoadingText(false) }
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this document and all its analysis data?')) return
    setDeleting(true)
    await documents.delete(id)
    toast.success('Document deleted')
    router.push('/documents')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-medium">Loading document…</p>
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <FileText size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Document not found.</p>
          <Link href="/documents" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
            Back to Documents
          </Link>
        </div>
      </div>
    )
  }

  const analysis = doc.analysisResult
  const displayAnalysis = viewingRevision
    ? viewingRevision
    : activeTranslationLang && translations[activeTranslationLang]
      ? { ...analysis, ...translations[activeTranslationLang] }
      : analysis
  const isProcessing = doc.analysisStatus === 'processing' || doc.analysisStatus === 'pending'
  const pendingItems = analysis?.actionItems?.filter((i: any) => !i.completed) || []
  const doneItems    = analysis?.actionItems?.filter((i: any) => i.completed) || []
  const hasUrgent    = pendingItems.some((i: any) => i.priority === 'urgent')
  const hasOverdue   = pendingItems.some((i: any) => i.deadline && new Date(i.deadline) < new Date())
  const risk         = riskColors[analysis?.riskLevel] || riskColors.low
  const totalActions = (analysis?.actionItems?.length || 0)
  const doneCount    = doneItems.length
  const fileUrl      = doc.filePath ? getFileUrl(doc.filePath) : null
  const fileExt      = doc.fileName?.split('.').pop()?.toLowerCase()

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* ── Dark hero banner ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 55%, #0f172a 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative px-8 pt-6 pb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <Link
              href="/documents"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft size={15} />
              Documents
            </Link>
            <span className="text-slate-600 text-sm">/</span>
            <span className="text-slate-300 text-sm truncate max-w-[300px]">{doc.fileName}</span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-slate-300" />
                </div>
                <h1 className="text-2xl font-bold text-white truncate">{doc.fileName}</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap ml-13 pl-[52px]">
                {analysis?.documentType && (
                  <span className="text-xs font-semibold text-brand-300 bg-brand-900/40 border border-brand-700/40 px-2.5 py-1 rounded-full">
                    {analysis.documentType}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Uploaded {format(new Date(doc.uploadedAt || doc.createdAt), 'MMM d, yyyy · h:mm a')}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {fileUrl && (
                <a
                  href={fileUrl}
                  download={doc.fileName}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-sm font-medium rounded-xl transition-colors"
                >
                  <Download size={14} />
                  Download
                </a>
              )}
              {analysis && !isProcessing && (
                <>
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-sm font-medium rounded-xl transition-colors"
                  >
                    <MessageSquare size={14} />
                    Ask AI
                  </button>
                  <button
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {reanalyzing
                      ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Analyzing…</>
                      : <><RefreshCw size={14} /> Re-analyze</>
                    }
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>

          {/* Stat pills */}
          {analysis && !isProcessing && (
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <RiskBadge level={analysis.riskLevel} />
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-sm text-slate-300 font-medium">{doneCount}/{totalActions} actions done</span>
              </div>
              {pendingItems.length > 0 && (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                  <Clock size={14} className="text-amber-400" />
                  <span className="text-sm text-slate-300 font-medium">{pendingItems.length} pending</span>
                </div>
              )}
              {Object.keys(translations).length > 0 && (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                  <Globe size={14} className="text-brand-400" />
                  <span className="text-sm text-slate-300 font-medium">{Object.keys(translations).length} translation{Object.keys(translations).length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-8 py-6">

        {/* Processing state */}
        {isProcessing && (
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-10 text-center">
            <div className="w-12 h-12 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: '3px' }} />
            <p className="font-bold text-brand-800 text-lg mb-1">AI agents are analyzing your document…</p>
            <p className="text-sm text-brand-600">This usually takes 15–30 seconds. The page will update automatically.</p>
          </div>
        )}

        {/* Failed state */}
        {doc.analysisStatus === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
            <p className="font-bold text-red-800 mb-1">
              {doc._serverDown ? 'Server unavailable' : 'Analysis failed'}
            </p>
            <p className="text-sm text-red-600">
              {doc._serverDown
                ? 'The server went offline while this document was being analysed. Please try again when the server is back.'
                : 'Please try uploading the document again.'}
            </p>
            {doc._serverDown && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Main analysis content */}
        {analysis && !isProcessing && (
          <div className="grid grid-cols-5 gap-6">

            {/* Left column — main content */}
            <div className="col-span-3 space-y-5">

              {/* Viewing revision banner */}
              {viewingRevision && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <History size={15} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Viewing revision #{viewingRevision.revisionNumber}</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Saved {format(new Date(viewingRevision.createdAt), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreRevision(viewingRevision.id)}
                      className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Restore this version
                    </button>
                    <button
                      onClick={() => setViewingRevision(null)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-800 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Urgent banner */}
              {(hasUrgent || hasOverdue) && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={15} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      {hasOverdue ? 'Action overdue — act immediately' : 'Urgent action required'}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      This document has {hasOverdue ? 'overdue' : 'urgent'} items that need your attention below.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                  <Sparkles size={15} className="text-brand-500" />
                  <span className="font-semibold text-slate-900">AI Summary</span>
                </div>
                <div className="p-5">
                  <p className="text-slate-700 leading-relaxed text-[15px]">{displayAnalysis?.summary || 'No summary available.'}</p>

                  {/* Risk explanation */}
                  {analysis.riskExplanation && (
                    <div className={clsx('mt-4 rounded-xl px-4 py-3 border', risk.bg, risk.border)}>
                      <p className={clsx('text-xs font-bold uppercase tracking-wide mb-1', risk.text)}>{risk.label}</p>
                      <p className={clsx('text-sm leading-relaxed', risk.text)}>{displayAnalysis?.riskExplanation}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Translations */}
              {analysis.translatedText && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-brand-500" />
                      <span className="font-semibold text-slate-900">Translations</span>
                    </div>
                    <button
                      onClick={() => setPickerOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={11} /> Add language
                    </button>
                  </div>

                  {/* Language picker */}
                  {pickerOpen && (
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Select a language</p>
                      <div className="grid grid-cols-4 gap-2">
                        {LANGUAGES.map(lang => {
                          const isDone = !!translations[lang]
                          return (
                            <button
                              key={lang}
                              onClick={() => { handleRetranslate(lang); setPickerOpen(false) }}
                              className={clsx(
                                'text-xs px-3 py-2 rounded-xl border font-medium text-left transition-colors flex items-center justify-between gap-1',
                                isDone
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
                              )}
                            >
                              <span className="truncate">{lang}</span>
                              {isDone && <Check size={10} className="text-emerald-500 flex-shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  {(activeTranslationLang || Object.keys(translations).length > 0 || !!translatingLang) && (
                    <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 overflow-x-auto">
                      <button
                        onClick={() => setActiveTranslationLang(null)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0',
                          !activeTranslationLang ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        )}
                      >
                        Original
                      </button>
                      {Object.keys(translations).map(lang => (
                        <div key={lang} className="flex items-center flex-shrink-0">
                          <button
                            onClick={() => setActiveTranslationLang(lang)}
                            className={clsx(
                              'px-3 py-1.5 rounded-l-lg text-xs font-semibold whitespace-nowrap transition-colors',
                              activeTranslationLang === lang ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            )}
                          >
                            {lang}
                          </button>
                          <button
                            onClick={() => {
                              setTranslations(prev => { const n = { ...prev }; delete n[lang]; return n })
                              if (activeTranslationLang === lang) setActiveTranslationLang(null)
                              if (doc?.analysisResult?.id) {
                                analysisApi.deleteTranslation(doc.analysisResult.id, lang).catch(() => {})
                              }
                            }}
                            className={clsx(
                              'px-1.5 py-1.5 rounded-r-lg text-xs transition-colors border-l',
                              activeTranslationLang === lang
                                ? 'bg-brand-700 border-brand-800 text-white hover:bg-brand-800'
                                : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200',
                            )}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {translatingLang && !translations[translatingLang] && (
                        <button
                          onClick={() => setActiveTranslationLang(translatingLang)}
                          className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0',
                            activeTranslationLang === translatingLang
                              ? 'bg-brand-600 border-brand-700 text-white'
                              : 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100',
                          )}
                        >
                          <svg className="animate-spin h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          {translatingLang}…
                        </button>
                      )}
                    </div>
                  )}

                  {/* Text content */}
                  <div className="px-5 py-5">
                    {translatingLang !== null && translatingLang === activeTranslationLang && !translations[activeTranslationLang ?? ''] ? (
                      <div className="flex items-center gap-2.5 text-sm text-slate-500 py-3">
                        <svg className="animate-spin h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Translating to {activeTranslationLang}…
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {displayAnalysis?.translatedText || 'No translation available.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action items */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-brand-500" />
                    <span className="font-semibold text-slate-900">Action Items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingItems.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                        <Clock size={10} /> {pendingItems.length} pending
                      </span>
                    )}
                    {doneItems.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                        <Check size={10} /> {doneItems.length} done
                      </span>
                    )}
                    <button
                      onClick={() => setShowAddForm(v => !v)}
                      className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 transition-colors"
                    >
                      {showAddForm ? <X size={12} /> : <Plus size={12} />}
                      {showAddForm ? 'Cancel' : 'Add'}
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {/* Progress bar */}
                  {totalActions > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-400 font-medium">Progress</span>
                        <span className="text-xs font-bold text-slate-600">{doneCount}/{totalActions}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${totalActions > 0 ? (doneCount / totalActions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Add form */}
                  {showAddForm && (
                    <div className="bg-slate-50 border border-brand-200 rounded-xl p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Title *"
                        value={newItem.title}
                        onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
                        className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      />
                      <textarea
                        placeholder="Description"
                        value={newItem.description}
                        onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                        rows={2}
                        className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none transition-all"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Deadline', field: 'deadline', type: 'date', options: null },
                          { label: 'Priority', field: 'priority', type: 'select', options: ['urgent','high','medium','low'] },
                          { label: 'Category', field: 'category', type: 'select', options: ['deadline','document','payment','appointment','other'] },
                        ].map(({ label, field, type, options }) => (
                          <div key={field}>
                            <label className="text-xs font-medium text-slate-400 mb-1 block">{label}</label>
                            {type === 'select' ? (
                              <select
                                value={(newItem as any)[field]}
                                onChange={e => setNewItem(p => ({ ...p, [field]: e.target.value }))}
                                className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:border-brand-400"
                              >
                                {options!.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                              </select>
                            ) : (
                              <input
                                type="date"
                                value={(newItem as any)[field]}
                                onChange={e => setNewItem(p => ({ ...p, [field]: e.target.value }))}
                                className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:border-brand-400"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <Button size="sm" onClick={handleAddItem} disabled={addingItem || !newItem.title.trim()}>
                        {addingItem ? 'Adding…' : 'Add Action Item'}
                      </Button>
                    </div>
                  )}

                  {pendingItems.map((item: any) => (
                    <ActionItemCard key={item.id} item={item} onToggle={handleToggle} onDeadlineChange={handleDeadlineChange} onEdit={handleEdit} onDelete={handleDeleteActionItem} />
                  ))}
                  {doneItems.map((item: any) => (
                    <ActionItemCard key={item.id} item={item} onToggle={handleToggle} onDeadlineChange={handleDeadlineChange} onEdit={handleEdit} onDelete={handleDeleteActionItem} />
                  ))}

                  {analysis.actionItems?.length === 0 && !showAddForm && (
                    <div className="py-10 text-center">
                      <CheckCircle2 size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No action items for this document.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — metadata + viewer */}
            <div className="col-span-2 space-y-5">

              {/* Tags */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Tags</span>
                </div>
                <div className="px-5 py-4">
                  <TagEditor
                    documentId={doc.id}
                    initialTags={doc.tags || []}
                    onTagsChange={updatedTags => setDoc((prev: any) => ({ ...prev, tags: updatedTags }))}
                  />
                </div>
              </div>

              {/* Key Information */}
              {analysis.extractedData && Object.keys(analysis.extractedData).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowKeyData(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-brand-500" />
                      <span className="font-semibold text-slate-900">Key Information</span>
                    </div>
                    {showKeyData ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                  </button>

                  {showKeyData && (
                    <div className="p-4 grid grid-cols-1 gap-2">
                      {Object.entries(analysis.extractedData).map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
                          <p className="text-sm font-semibold text-slate-800">{v as string}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Document viewer */}
              {doc.filePath && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Eye size={15} className="text-brand-500" />
                      <span className="font-semibold text-slate-900">Document Preview</span>
                    </div>
                    <button
                      onClick={handleOpenViewer}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                        showViewer
                          ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          : 'bg-brand-50 text-brand-600 border-brand-200 hover:bg-brand-100',
                      )}
                    >
                      {showViewer ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
                    </button>
                  </div>

                  {!showViewer && (
                    <div className="px-5 py-6 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <FileText size={22} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">{doc.fileName}</p>
                      <p className="text-xs text-slate-400 mb-3">{fileExt?.toUpperCase()} · click Show to preview</p>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          download={doc.fileName}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Download size={12} /> Download
                        </a>
                      )}
                    </div>
                  )}

                  {showViewer && (() => {
                    const ft = doc.fileType || ''
                    const url = fileUrl!
                    const isImage = ft.startsWith('image/')
                    const isPdf = ft === 'application/pdf'
                    const isText = ft === 'text/plain' || ft.includes('text')
                    const isDocx = fileExt === 'docx' || fileExt === 'doc'

                    if (isImage) return (
                      <div className="p-4 bg-slate-50 flex justify-center">
                        <img src={url} alt={doc.fileName} className="max-w-full max-h-[500px] object-contain rounded-xl shadow-sm" />
                      </div>
                    )

                    if (isPdf) return (
                      <div className="bg-slate-50 p-3">
                        <iframe
                          src={`${url}#toolbar=1&navpanes=0`}
                          title={doc.fileName}
                          className="w-full rounded-xl border border-slate-200"
                          style={{ height: '500px' }}
                        />
                      </div>
                    )

                    if (isText) return (
                      <div
                        className="overflow-y-auto"
                        style={{ maxHeight: '460px', background: '#1e1e2e' }}
                      >
                        <div className="px-5 py-4">
                          {loadingText ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              Loading…
                            </div>
                          ) : (
                            <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">{textContent}</pre>
                          )}
                        </div>
                      </div>
                    )

                    return (
                      <div className="p-8 text-center bg-slate-50">
                        <FileText size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-600 mb-1">
                          {isDocx ? 'Word documents cannot be previewed in-browser' : 'Preview not available'}
                        </p>
                        <p className="text-xs text-slate-400 mb-4">Download to open in your application</p>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            download={doc.fileName}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
                          >
                            <Download size={14} /> Download {fileExt?.toUpperCase()}
                          </a>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Upcoming deadlines from this doc */}
              {pendingItems.filter((i: any) => i.deadline).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <Calendar size={15} className="text-amber-500" />
                    <span className="font-semibold text-slate-900">Upcoming Deadlines</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {pendingItems
                      .filter((i: any) => i.deadline)
                      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                      .slice(0, 4)
                      .map((item: any) => {
                        const diff = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000)
                        const isOverdue = diff < 0
                        const isHot = diff >= 0 && diff <= 3
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                              isOverdue || isHot ? 'bg-red-100' : 'bg-amber-100',
                            )}>
                              <Calendar size={12} className={isOverdue || isHot ? 'text-red-500' : 'text-amber-500'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{item.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {isOverdue ? `Overdue by ${Math.abs(diff)}d` : diff === 0 ? 'Due today' : `${diff}d left`}
                                {' · '}{format(new Date(item.deadline), 'MMM d')}
                              </p>
                            </div>
                            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full',
                              isOverdue || isHot ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                            )}>
                              {isOverdue ? 'Overdue' : `${diff}d`}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
              {/* Revision history */}
              {revisions.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowRevisions(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <History size={15} className="text-brand-500" />
                      <span className="font-semibold text-slate-900">Revision History</span>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{revisions.length}</span>
                    </div>
                    {showRevisions ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                  </button>

                  {showRevisions && (
                    <div className="divide-y divide-slate-50">
                      {revisions.map((rev: any) => {
                        const isViewing = viewingRevision?.id === rev.id
                        return (
                          <div
                            key={rev.id}
                            className={clsx(
                              'px-5 py-3.5 flex items-start gap-3 transition-colors',
                              isViewing ? 'bg-amber-50' : 'hover:bg-slate-50',
                            )}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-500">#{rev.revisionNumber}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{rev.documentType || 'Document'}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {format(new Date(rev.createdAt), 'MMM d, yyyy · h:mm a')}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rev.summary}</p>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => setViewingRevision(isViewing ? null : rev)}
                                className={clsx(
                                  'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                                  isViewing
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200',
                                )}
                              >
                                {isViewing ? 'Viewing' : 'View'}
                              </button>
                              <button
                                onClick={() => handleRestoreRevision(rev.id)}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 transition-colors"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showChat && analysis && (
        <ChatPanel
          analysisId={analysis.id}
          documentName={doc.fileName}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}
