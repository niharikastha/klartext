'use client'

import { useEffect, useState } from 'react'
import { X, Download, FileText, Image as ImageIcon, FileCode2 } from 'lucide-react'
import { clsx } from 'clsx'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api').replace(/\/api$/, '')

interface DocViewerProps {
  doc: any
  onClose: () => void
}

function isDocx(doc: any) {
  const name: string = doc.fileName || ''
  return name.endsWith('.docx') || name.endsWith('.doc')
}

export function DocViewer({ doc, onClose }: DocViewerProps) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)

  const fileName = doc.fileName || 'document'
  const fileType: string = doc.fileType || ''
  const filePath: string = doc.filePath || ''
  const url = `${API_BASE}/uploads/${filePath.split('/').pop()}`

  const isImage = fileType.startsWith('image/')
  const isPdf = fileType === 'application/pdf'
  const isText = fileType === 'text/plain'
  const isWordDoc = isDocx(doc)
  const canPreview = isImage || isPdf || isText

  useEffect(() => {
    if (!isText) return
    setTextLoading(true)
    fetch(url)
      .then(r => r.text())
      .then(t => { setTextContent(t); setTextLoading(false) })
      .catch(() => { setTextContent('Failed to load text content.'); setTextLoading(false) })
  }, [url, isText])

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={handleBackdropClick}
    >
      {/* Modal panel */}
      <div
        className="flex flex-col w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0f0f23', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {isImage ? (
              <ImageIcon size={15} className="text-sky-400 flex-shrink-0" />
            ) : isPdf ? (
              <FileText size={15} className="text-red-400 flex-shrink-0" />
            ) : isText ? (
              <FileCode2 size={15} className="text-amber-400 flex-shrink-0" />
            ) : (
              <FileText size={15} className="text-slate-400 flex-shrink-0" />
            )}
            <span className="text-sm font-semibold text-slate-200 truncate">{fileName}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <a
              href={url}
              download={fileName}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium transition-colors"
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div
          className={clsx(
            'flex-1 overflow-hidden flex items-center justify-center min-h-0',
            isImage ? 'bg-slate-100' : isPdf ? 'bg-white' : '',
          )}
          style={isText || isWordDoc || (!canPreview) ? { background: '#1e1e2e' } : undefined}
        >
          {isImage && (
            <img
              src={url}
              alt={fileName}
              className="max-h-full max-w-full object-contain p-4"
            />
          )}

          {isPdf && (
            <iframe
              src={url}
              title={fileName}
              className="w-full border-0"
              style={{ height: 'calc(90vh - 56px)' }}
            />
          )}

          {isText && (
            <div className="w-full h-full overflow-auto p-6" style={{ background: '#1e1e2e' }}>
              {textLoading ? (
                <p className="text-slate-400 text-sm">Loading…</p>
              ) : (
                <pre className="font-mono text-sm text-slate-200 whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {(isWordDoc || (!canPreview && !isWordDoc)) && (
            <div className="flex flex-col items-center gap-4 text-center px-8 py-12">
              <FileText size={48} className="text-slate-500" />
              <p className="text-slate-300 text-sm">
                {isWordDoc
                  ? 'Preview is not available for Word documents.'
                  : 'Preview is not available for this file type.'}
              </p>
              <a
                href={url}
                download={fileName}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                <Download size={15} />
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocViewer
