'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import Link from 'next/link'
import {
  Upload, FileText, Image as ImageIcon, FileCode2,
  AlertTriangle, CheckCircle, Clock, ArrowRight, Sparkles,
  Zap, Shield, ListChecks, ChevronRight, X, RefreshCw, FilePlus,
} from 'lucide-react'
import { documents as docsApi } from '@/lib/api'
import { RiskBadge } from '@/components/document/RiskBadge'
import { DocViewer } from '@/components/document/DocViewer'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

function splitName(filename: string) {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return { base: filename, ext: '' }
  return { base: filename.slice(0, lastDot), ext: filename.slice(lastDot) }
}

function generateNewName(filename: string, existingNames: string[]): string {
  const { base, ext } = splitName(filename)
  const lower = (s: string) => s.toLowerCase()
  const taken = new Set(existingNames.map(lower))
  let n = 2
  let candidate = `${base} (${n})${ext}`
  while (taken.has(lower(candidate))) { n++; candidate = `${base} (${n})${ext}` }
  return candidate
}

const FORMAT_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
}

const FORMATS = [
  { ext: 'PDF', color: 'bg-red-50 text-red-600 border-red-200' },
  { ext: 'JPG', color: 'bg-sky-50 text-sky-600 border-sky-200' },
  { ext: 'PNG', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { ext: 'WEBP', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { ext: 'TXT', color: 'bg-amber-50 text-amber-600 border-amber-200' },
]

const DOC_TYPES = [
  { de: 'Mietvertrag', en: 'Rental Contract', color: 'bg-blue-500' },
  { de: 'Aufenthaltstitel', en: 'Residence Permit', color: 'bg-violet-500' },
  { de: 'Anmeldung', en: 'City Registration', color: 'bg-emerald-500' },
  { de: 'Steuerbescheid', en: 'Tax Notice', color: 'bg-amber-500' },
  { de: 'Arbeitsvertrag', en: 'Employment Contract', color: 'bg-rose-500' },
  { de: 'Behördenschreiben', en: 'Government Letter', color: 'bg-slate-500' },
]

const WHAT_YOU_GET = [
  { icon: Sparkles, label: 'Plain-English summary', desc: 'Understand what the document is about in seconds', color: 'text-brand-600 bg-brand-50' },
  { icon: ListChecks, label: 'Prioritised action items', desc: 'Every task sorted by urgency and deadline', color: 'text-amber-600 bg-amber-50' },
  { icon: Zap, label: 'Instant translation', desc: 'Full document in your preferred language', color: 'text-emerald-600 bg-emerald-50' },
  { icon: Shield, label: 'Risk assessment', desc: 'Know if you need to act urgently', color: 'text-red-500 bg-red-50' },
]

const statusMap: Record<string, { label: string; dot: string; icon: any }> = {
  completed: { label: 'Ready', dot: 'bg-emerald-500', icon: CheckCircle },
  processing: { label: 'Analysing…', dot: 'bg-brand-500 animate-pulse', icon: Clock },
  pending:    { label: 'Pending', dot: 'bg-amber-400', icon: Clock },
  failed:     { label: 'Failed', dot: 'bg-red-500', icon: AlertTriangle },
}

function fileIcon(fileType: string) {
  if (fileType?.startsWith('image/')) return ImageIcon
  if (fileType === 'application/pdf') return FileText
  return FileCode2
}

function fileAccentColor(fileType: string) {
  if (fileType?.startsWith('image/')) return 'bg-sky-500'
  if (fileType === 'application/pdf') return 'bg-red-500'
  return 'bg-amber-500'
}

export default function UploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [filter, setFilter] = useState<'completed' | 'failed'>('completed')
  const [viewerDoc, setViewerDoc] = useState<any>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [duplicateDoc, setDuplicateDoc] = useState<any | null>(null)

  useEffect(() => {
    docsApi.list()
      .then(res => { setDocs(res.data); setLoadingDocs(false) })
      .catch(() => setLoadingDocs(false))
  }, [])

  // Poll processing documents every 4s; mark failed if server goes down
  useEffect(() => {
    const processing = docs.filter(d => d.analysisStatus === 'processing' || d.analysisStatus === 'pending')
    if (processing.length === 0) return
    const timer = setTimeout(() => {
      docsApi.list()
        .then(res => setDocs(res.data))
        .catch(() => {
          setDocs(prev => prev.map(d =>
            (d.analysisStatus === 'processing' || d.analysisStatus === 'pending')
              ? { ...d, analysisStatus: 'failed' }
              : d,
          ))
        })
    }, 4000)
    return () => clearTimeout(timer)
  }, [docs])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setSelectedFile(file)
    try {
      const res = await docsApi.upload(file)
      toast.success('Uploaded! AI is analysing your document…')
      router.push(`/documents/${res.data.id}`)
    } catch {
      toast.error('Upload failed. Please try again.')
      setUploading(false)
      setSelectedFile(null)
    }
  }, [router])

  const onFileDrop = useCallback((file: File) => {
    const duplicate = docs.find(d => d.fileName.toLowerCase() === file.name.toLowerCase())
    if (duplicate) {
      setPendingFile(file)
      setDuplicateDoc(duplicate)
      return
    }
    handleUpload(file)
  }, [docs, handleUpload])

  const handleDuplicateReplace = useCallback(async () => {
    if (!pendingFile || !duplicateDoc) return
    const file = pendingFile
    const docToDelete = duplicateDoc
    setPendingFile(null)
    setDuplicateDoc(null)
    try {
      await docsApi.delete(docToDelete.id)
      setDocs(prev => prev.filter(d => d.id !== docToDelete.id))
    } catch {
      toast.error('Could not remove existing document.')
      return
    }
    await handleUpload(file)
  }, [pendingFile, duplicateDoc, handleUpload])

  const handleDuplicateRename = useCallback(async () => {
    if (!pendingFile) return
    const newName = generateNewName(pendingFile.name, docs.map(d => d.fileName))
    const renamed = new File([pendingFile], newName, { type: pendingFile.type })
    setPendingFile(null)
    setDuplicateDoc(null)
    await handleUpload(renamed)
  }, [pendingFile, docs, handleUpload])

  const handleDuplicateCancel = useCallback(() => {
    setPendingFile(null)
    setDuplicateDoc(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => files[0] && onFileDrop(files[0]),
    accept: FORMAT_ACCEPT,
    multiple: false,
    disabled: uploading,
  })

  const filteredDocs = docs.filter(d => d.analysisStatus === filter)

  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* ── Dark header ── */}
      <div className="relative overflow-hidden" style={{ background: '#0f0f23' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 10% 80%, rgba(79,70,229,0.4) 0%, transparent 50%), radial-gradient(ellipse at 90% 10%, rgba(124,58,237,0.25) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 px-8 pt-8 pb-10">
          <div className="max-w-5xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <Upload size={13} className="text-white" />
              </div>
              <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">Document Upload</span>
            </div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-2">
              Turn any German document<br />into a clear action plan
            </h1>
            <p className="text-slate-400 text-sm max-w-lg">
              Upload a scan, PDF, or photo — our AI agents read it, translate it, and hand you a prioritised to-do list in under 30 seconds.
            </p>

            {/* Step flow */}
            <div className="flex items-center gap-0 mt-6">
              {[
                { n: '1', label: 'Upload file' },
                { n: '2', label: 'AI analyses' },
                { n: '3', label: 'Get action plan' },
              ].map((step, i) => (
                <div key={step.n} className="flex items-center gap-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{step.n}</span>
                    <span className="text-slate-300 text-xs font-medium">{step.label}</span>
                  </div>
                  {i < 2 && <ChevronRight size={14} className="text-slate-600 mx-1" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 -mt-4 relative z-10">

        {/* ── Main two-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">

          {/* Drop zone — wider */}
          <div className="lg:col-span-3">
            <div
              {...getRootProps()}
              className={clsx(
                'relative rounded-2xl cursor-pointer transition-all select-none overflow-hidden',
                'border-2',
                isDragActive
                  ? 'border-brand-500 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]'
                  : 'border-slate-200 hover:border-brand-400',
                uploading ? 'opacity-70 cursor-not-allowed pointer-events-none' : '',
              )}
              style={{ background: isDragActive ? 'rgba(238,240,255,0.7)' : '#fff' }}
            >
              <input {...getInputProps()} />

              {/* Subtle grid pattern */}
              {!uploading && !isDragActive && (
                <div
                  className="absolute inset-0 opacity-[0.025] pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                  }}
                />
              )}

              <div className="relative flex flex-col items-center justify-center gap-6 py-14 px-8 text-center">
                {uploading ? (
                  <>
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-brand-50 border-2 border-brand-200 flex items-center justify-center">
                        <svg className="animate-spin h-9 w-9 text-brand-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                      <div className="absolute -inset-2 rounded-3xl border-2 border-brand-300/40 animate-ping" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">Uploading &amp; analysing…</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-xs truncate">{selectedFile?.name}</p>
                      <p className="text-xs text-slate-400 mt-2">AI agents are working on your document</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Upload icon */}
                    <div className={clsx(
                      'relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all',
                      isDragActive
                        ? 'bg-brand-100 border-2 border-brand-400 scale-110'
                        : 'bg-gradient-to-br from-brand-50 to-violet-50 border-2 border-dashed border-brand-200',
                    )}>
                      <Upload size={32} className={isDragActive ? 'text-brand-600' : 'text-brand-400'} />
                      {isDragActive && (
                        <div className="absolute -inset-1 rounded-3xl border-2 border-brand-400/30 animate-ping" />
                      )}
                    </div>

                    <div>
                      <p className="text-xl font-bold text-slate-900">
                        {isDragActive ? 'Release to upload' : 'Drop your document here'}
                      </p>
                      <p className="text-sm text-slate-400 mt-1.5">
                        {isDragActive ? 'We\'ll analyse it immediately' : 'or click to browse files from your device'}
                      </p>
                    </div>

                    {/* Format badges */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {FORMATS.map(({ ext, color }) => (
                        <span
                          key={ext}
                          className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold border tracking-wide', color)}
                        >
                          .{ext}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-slate-400 -mt-2">Max 10 MB per file</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* What you get */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">What you get</p>
              </div>
              <div className="p-4 space-y-3">
                {WHAT_YOU_GET.map(({ icon: Icon, label, desc, color }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Document types row */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Sparkles size={14} className="text-brand-500" />
            <p className="text-sm font-semibold text-slate-900">Supported document types</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DOC_TYPES.map(({ de, en, color }) => (
              <div key={de} className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className={clsx('w-2 h-8 rounded-full flex-shrink-0', color)} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{de}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{en}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Documents list ── */}
        <div className="pb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Your Documents</h2>
              <p className="text-xs text-slate-400 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} uploaded</p>
            </div>
          </div>

          {/* Filter tabs */}
          {docs.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              {(['completed', 'failed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    filter === status
                      ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60',
                  )}
                >
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    status === 'completed' ? 'bg-emerald-500' : 'bg-red-500',
                  )} />
                  {status === 'completed' ? 'Completed' : 'Failed'}
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded-md text-[10px]',
                    filter === status ? 'bg-slate-100 text-slate-600' : 'bg-slate-100/60 text-slate-400',
                  )}>
                    {docs.filter(d => d.analysisStatus === status).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {loadingDocs ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading documents…</p>
              </div>
            </div>
          ) : docs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-slate-300" />
              </div>
              <p className="text-base font-semibold text-slate-700 mb-1">No documents yet</p>
              <p className="text-sm text-slate-400">Upload your first German document above to get started</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-sm font-semibold text-slate-600 mb-1">
                No {filter} documents
              </p>
              <p className="text-xs text-slate-400">
                {filter === 'failed' ? 'No failed documents found.' : 'No completed documents yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDocs.map((doc: any) => {
                const st = statusMap[doc.analysisStatus] || statusMap.pending
                const FileIcon = fileIcon(doc.fileType)
                const accentColor = fileAccentColor(doc.fileType)
                const pendingCount = doc.analysisResult?.actionItems?.filter((i: any) => !i.completed).length ?? 0
                const done = doc.analysisResult?.actionItems?.filter((i: any) => i.completed).length ?? 0
                const total = (pendingCount + done)

                return (
                  <div
                    key={doc.id}
                    onClick={() => setViewerDoc(doc)}
                    className="group relative bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
                  >
                    {/* Color accent strip */}
                    <div className={clsx('h-1 w-full', accentColor)} />

                    <div className="p-5 flex-1 flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors', 'bg-slate-100 group-hover:bg-brand-50')}>
                          <FileIcon size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate leading-snug">{doc.fileName}</p>
                          {doc.analysisResult?.documentType ? (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.analysisResult.documentType}</p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">{format(new Date(doc.uploadedAt), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                      </div>

                      {/* Summary snippet */}
                      {doc.analysisResult?.summary && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {doc.analysisResult.summary}
                        </p>
                      )}

                      {/* Progress bar for action items */}
                      {total > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-400 font-medium">{done}/{total} actions done</span>
                            {pendingCount > 0 && (
                              <span className="text-[10px] text-amber-600 font-semibold">{pendingCount} pending</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                        <span className="text-xs text-slate-500 font-medium">{st.label}</span>
                        <span className="text-slate-200 text-xs">·</span>
                        <span className="text-xs text-slate-400">{format(new Date(doc.uploadedAt), 'MMM d')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.analysisResult?.riskLevel && (
                          <RiskBadge level={doc.analysisResult.riskLevel} />
                        )}
                        <Link
                          href={`/documents/${doc.id}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors"
                        >
                          View analysis <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* DocViewer modal */}
      {viewerDoc && <DocViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />}

      {/* Duplicate name modal */}
      {duplicateDoc && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden">

            {/* Dark header */}
            <div className="relative overflow-hidden px-6 py-5" style={{ background: '#0f0f23' }}>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 15% 60%, rgba(245,158,11,0.18) 0%, transparent 60%)' }}
              />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-white">File already exists</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Choose how to handle this conflict</p>
                  </div>
                </div>
                <button onClick={handleDuplicateCancel} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* File conflict cards */}
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-stretch gap-3">
                {/* Existing */}
                <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Existing</p>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText size={13} className="text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{duplicateDoc.fileName}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {format(new Date(duplicateDoc.uploadedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VS badge */}
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                    <span className="text-[10px] font-black text-amber-500 tracking-tighter">VS</span>
                  </div>
                </div>

                {/* Incoming */}
                <div className="flex-1 min-w-0 bg-brand-50 border border-brand-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2.5">Uploading</p>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Upload size={13} className="text-brand-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{pendingFile.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Just now</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extension mismatch warning */}
              {splitName(pendingFile.name).ext.toLowerCase() !== splitName(duplicateDoc.fileName).ext.toLowerCase() && (
                <div className="flex items-center gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Format mismatch — existing is{' '}
                    <span className="font-bold">{splitName(duplicateDoc.fileName).ext || 'unknown'}</span>
                    , uploading is{' '}
                    <span className="font-bold">{splitName(pendingFile.name).ext || 'unknown'}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-5 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">What would you like to do?</p>

              <button
                onClick={handleDuplicateReplace}
                className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-red-200 text-left transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center flex-shrink-0 transition-colors">
                  <RefreshCw size={15} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700">Replace existing</p>
                  <p className="text-[11px] text-red-400 mt-0.5">Permanently removes the current version</p>
                </div>
              </button>

              <button
                onClick={handleDuplicateRename}
                className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-brand-50 hover:bg-brand-100 border-2 border-transparent hover:border-brand-200 text-left transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-100 group-hover:bg-brand-200 flex items-center justify-center flex-shrink-0 transition-colors">
                  <FilePlus size={15} className="text-brand-600" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-brand-700">Keep both</p>
                  <p className="text-[11px] text-brand-400 mt-0.5 truncate">
                    Saves as &ldquo;{generateNewName(pendingFile.name, docs.map(d => d.fileName))}&rdquo;
                  </p>
                </div>
              </button>

              <button
                onClick={handleDuplicateCancel}
                className="w-full py-2.5 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
