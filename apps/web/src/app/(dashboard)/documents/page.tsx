'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText, Image as ImageIcon, FileCode2,
  Search, FolderOpen, Upload, ChevronRight,
  CheckCircle, Clock, AlertTriangle, ArrowUpDown,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { documents as docsApi, tags as tagsApi } from '@/lib/api'
import { RiskBadge } from '@/components/document/RiskBadge'
import { format } from 'date-fns'
import { clsx } from 'clsx'

function fileIcon(fileType: string) {
  if (fileType?.startsWith('image/')) return ImageIcon
  if (fileType === 'application/pdf') return FileText
  return FileCode2
}

function fileTypeLabel(fileType: string, fileName: string) {
  if (fileType?.startsWith('image/')) return 'Image'
  if (fileType === 'application/pdf') return 'PDF'
  if (fileName?.endsWith('.docx') || fileName?.endsWith('.doc')) return 'Word'
  if (fileType === 'text/plain') return 'Text'
  return 'Document'
}

const statusMap: Record<string, { label: string; dot: string; pill: string }> = {
  completed: { label: 'Ready',      dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  processing: { label: 'Analysing', dot: 'bg-brand-500 animate-pulse', pill: 'bg-brand-100 text-brand-700' },
  pending:    { label: 'Pending',   dot: 'bg-amber-400',   pill: 'bg-amber-100 text-amber-700' },
  failed:     { label: 'Failed',    dot: 'bg-red-500',     pill: 'bg-red-100 text-red-700' },
}

type StatusFilter = 'all' | 'completed' | 'processing' | 'failed'
type SortField = 'uploadedAt' | 'fileName' | 'status'
type SortDir = 'asc' | 'desc'

export default function DocumentsPage() {
  const [docs, setDocs]               = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField]     = useState<SortField>('uploadedAt')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')
  const [allTags, setAllTags]         = useState<any[]>([])
  const [tagFilter, setTagFilter]     = useState<string | null>(null)

  useEffect(() => {
    docsApi.list()
      .then(res => { setDocs(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    tagsApi.list().then(r => setAllTags(r.data)).catch(() => {})
  }, [])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filtered = docs
    .filter(doc => {
      if (search) {
        const q = search.toLowerCase()
        if (!doc.fileName?.toLowerCase().includes(q) &&
            !doc.analysisResult?.documentType?.toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'all' && doc.analysisStatus !== statusFilter) return false
      if (tagFilter && !doc.tags?.some((t: any) => t.id === tagFilter)) return false
      return true
    })
    .sort((a, b) => {
      let av: any, bv: any
      if (sortField === 'uploadedAt') {
        av = new Date(a.uploadedAt || a.createdAt).getTime()
        bv = new Date(b.uploadedAt || b.createdAt).getTime()
      } else if (sortField === 'fileName') {
        av = a.fileName?.toLowerCase() ?? ''
        bv = b.fileName?.toLowerCase() ?? ''
      } else {
        av = a.analysisStatus ?? ''
        bv = b.analysisStatus ?? ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const total      = docs.length
  const completed  = docs.filter(d => d.analysisStatus === 'completed').length
  const failed     = docs.filter(d => d.analysisStatus === 'failed').length
  const processing = docs.filter(d => d.analysisStatus === 'processing' || d.analysisStatus === 'pending').length

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: total },
    { key: 'completed',  label: 'Completed',  count: completed },
    { key: 'processing', label: 'Processing', count: processing },
    { key: 'failed',     label: 'Failed',     count: failed },
  ]

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={13} className="text-slate-300" />
    return sortDir === 'asc'
      ? <ArrowUp size={13} className="text-brand-500" />
      : <ArrowDown size={13} className="text-brand-500" />
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* Dark hero banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f172a 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <FolderOpen size={13} className="text-white" />
            </div>
            <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">Documents</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white leading-tight mb-1">Your Documents</h1>
              <p className="text-slate-400 text-sm">All uploaded German documents with AI analysis</p>
            </div>
            <Link
              href="/upload"
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              <Upload size={14} /> Upload new
            </Link>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[
              { label: 'Total',      value: total,      icon: FolderOpen,   accent: 'from-brand-500 to-brand-700' },
              { label: 'Completed',  value: completed,  icon: CheckCircle,  accent: 'from-emerald-500 to-emerald-700' },
              { label: 'Processing', value: processing, icon: Clock,        accent: 'from-amber-500 to-amber-700' },
              { label: 'Failed',     value: failed,     icon: AlertTriangle,accent: 'from-red-500 to-red-700' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4 hover:bg-white/8 transition-colors">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br flex-shrink-0', accent)}>
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
      </div>

      <div className="px-8 py-6">

        {/* Controls row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                  statusFilter === tab.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                )}
              >
                {tab.label}
                <span className={clsx(
                  'text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
                  statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tags:</span>
            <button
              onClick={() => setTagFilter(null)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                tagFilter === null
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
              )}
            >
              All
            </button>
            {allTags.map((tag: any) => (
              <button
                key={tag.id}
                onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  tagFilter === tag.id
                    ? 'text-white border-transparent'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                )}
                style={tagFilter === tag.id ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading documents…</p>
            </div>
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-slate-300" />
            </div>
            <p className="text-base font-semibold text-slate-700 mb-1">No documents yet</p>
            <p className="text-sm text-slate-400 mb-6">Upload your first German document to get started</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              <Upload size={15} /> Upload a document
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_44px] gap-0 border-b border-slate-100 bg-slate-50">
              <button
                onClick={() => toggleSort('fileName')}
                className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 text-left transition-colors"
              >
                File <SortIcon field="fileName" />
              </button>
              <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</div>
              <button
                onClick={() => toggleSort('status')}
                className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 text-left transition-colors"
              >
                Status <SortIcon field="status" />
              </button>
              <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk</div>
              <button
                onClick={() => toggleSort('uploadedAt')}
                className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 text-left transition-colors"
              >
                Uploaded <SortIcon field="uploadedAt" />
              </button>
              <div />
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-slate-500">No matching documents</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search or filter</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map((doc: any) => {
                  const st = statusMap[doc.analysisStatus] || statusMap.pending
                  const FileIcon = fileIcon(doc.fileType)
                  const typeLabel = fileTypeLabel(doc.fileType, doc.fileName)
                  const done = doc.analysisResult?.actionItems?.filter((i: any) => i.completed).length ?? 0
                  const totalActions = doc.analysisResult?.actionItems?.length ?? 0

                  return (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_44px] gap-0 items-center hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* File */}
                      <div className="flex items-center gap-3 px-5 py-4 min-w-0">
                        <div className="w-9 h-9 bg-slate-100 group-hover:bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                          <FileIcon size={16} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-700 transition-colors">
                            {doc.fileName}
                          </p>
                          {doc.analysisResult?.documentType && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">{doc.analysisResult.documentType}</p>
                          )}
                          {doc.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {doc.tags.slice(0, 3).map((tag: any) => (
                                <span
                                  key={tag.id}
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {doc.tags.length > 3 && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">
                                  +{doc.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {totalActions > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="h-1 w-20 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${totalActions > 0 ? (done / totalActions) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400">{done}/{totalActions}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Type */}
                      <div className="px-4 py-4">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {typeLabel}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="px-4 py-4">
                        <span className={clsx('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', st.pill)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                          {st.label}
                        </span>
                      </div>

                      {/* Risk */}
                      <div className="px-4 py-4">
                        {doc.analysisResult?.riskLevel
                          ? <RiskBadge level={doc.analysisResult.riskLevel} />
                          : <span className="text-xs text-slate-300">—</span>}
                      </div>

                      {/* Uploaded */}
                      <div className="px-4 py-4">
                        <span className="text-xs text-slate-500">
                          {format(new Date(doc.uploadedAt || doc.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center pr-3">
                        <ChevronRight size={15} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Showing {filtered.length} of {docs.length} document{docs.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
