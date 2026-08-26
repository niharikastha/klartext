'use client'

import { useEffect, useRef } from 'react'
import { X, FileText, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export interface DocRef {
  id: string
  name: string
  documentType: string
  passage: string
}

interface ReferencePanelProps {
  docRef: DocRef
  doc: any | null
  onClose: () => void
}

function HighlightedText({ text, passage }: { text: string; passage: string }) {
  const markRef = useRef<HTMLElement>(null)

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  if (!passage || !text) {
    return <span className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{text}</span>
  }

  const searchKey = passage.slice(0, 60).toLowerCase()
  const idx = text.toLowerCase().indexOf(searchKey)

  if (idx === -1) {
    return <span className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{text}</span>
  }

  const matchLen = Math.min(passage.length, 500)
  return (
    <span className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
      {text.slice(0, idx)}
      <mark
        ref={markRef as React.RefObject<HTMLElement>}
        className="bg-yellow-300/30 text-yellow-100 rounded px-0.5 border-b border-yellow-400/60"
      >
        {text.slice(idx, idx + matchLen)}
      </mark>
      {text.slice(idx + matchLen)}
    </span>
  )
}

export function ReferencePanel({ docRef, doc, onClose }: ReferencePanelProps) {
  const translatedText: string = doc?.analysisResult?.translatedText || ''

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col shadow-2xl border-l border-white/10"
      style={{ background: '#0f0f23', width: '50vw' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <FileText size={14} className="text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{docRef.name}</p>
            {docRef.documentType !== 'Unknown' && (
              <p className="text-[11px] text-slate-400 truncate">{docRef.documentType}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
          <Link
            href={`/documents/${docRef.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition-colors"
          >
            <ExternalLink size={11} />
            Open
          </Link>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Label */}
      <div className="px-5 py-2.5 border-b border-white/5 flex-shrink-0">
        <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">
          Translation · highlighted passage
        </span>
      </div>

      {/* Translated text with highlight */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {translatedText ? (
          <HighlightedText text={translatedText} passage={docRef.passage} />
        ) : (
          <p className="text-sm text-slate-500 italic">Translation not available for this document.</p>
        )}
      </div>
    </div>
  )
}
