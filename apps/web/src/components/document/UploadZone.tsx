'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText } from 'lucide-react'
import { clsx } from 'clsx'

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
}

export function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      setSelectedFile(file)
      await onUpload(file)
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-brand-500 bg-brand-50/60 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/30',
          uploading && 'opacity-60 cursor-not-allowed',
        )}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <svg className="animate-spin h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-800">Uploading &amp; analyzing...</p>
              <p className="text-sm text-slate-400 mt-1">AI agents are processing your document</p>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <FileText size={28} className="text-emerald-600" />
            </div>
            <p className="text-[15px] font-semibold text-slate-800">{selectedFile.name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={clsx(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
              isDragActive ? 'bg-brand-100 border border-brand-200' : 'bg-slate-100 border border-slate-200',
            )}>
              <Upload size={26} className={isDragActive ? 'text-brand-600' : 'text-slate-400'} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-800">
                {isDragActive ? 'Drop your document here' : 'Drag & drop your German document'}
              </p>
              <p className="text-sm text-slate-400 mt-1">or click to browse files</p>
            </div>
            <div className="flex gap-2 text-xs text-slate-400 mt-1">
              {['PDF', 'JPG', 'PNG', 'WEBP', 'TXT'].map(fmt => (
                <span key={fmt} className="px-2.5 py-1 bg-slate-100 rounded-lg font-semibold tracking-wide">
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
