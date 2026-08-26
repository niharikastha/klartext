'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, MessageSquare, Sparkles, RotateCcw, Copy, Check, Printer, Pencil } from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { analysis as analysisApi } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'model'
  content: string
  streaming?: boolean
}

const SUGGESTED_QUESTIONS = [
  'What does this document require me to do?',
  'What happens if I miss the deadline?',
  'What documents do I need to bring?',
  'Can you explain this in simpler terms?',
  'What are the most important action items?',
]

interface ChatPanelProps {
  analysisId: string
  documentName: string
  onClose: () => void
}

export function ChatPanel({ analysisId, documentName, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const copyMsg = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const printMsg = useCallback((content: string) => {
    const w = window.open('', '_blank', 'width=640,height=480')
    if (!w) return
    const safe = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    w.document.write(`<!DOCTYPE html><html><head><title>Message</title><style>body{font-family:system-ui,sans-serif;padding:32px;max-width:560px;line-height:1.6}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${safe}</pre></body></html>`)
    w.document.close()
    w.print()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const assistantId = crypto.randomUUID()

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'model', content: '', streaming: true }])
    setInput('')
    setStreaming(true)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const chatUrl = analysisApi.chatUrl(analysisId)
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.text }
                    : m,
                ),
              )
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const errMsg = err?.message?.includes('rate limit') || err?.message?.includes('quota')
        ? err.message
        : 'Sorry, something went wrong. Please try again.'
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: errMsg, streaming: false }
            : m,
        ),
      )
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming, analysisId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleReset = () => {
    handleStop()
    setMessages([])
    setInput('')
    setStreaming(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-[420px] max-w-full flex flex-col bg-white shadow-2xl pointer-events-auto"
        style={{ height: '100dvh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={14} className="text-brand-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Ask about this document</p>
              <p className="text-[11px] text-slate-400 truncate">{documentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                title="Clear chat"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: '#f8fafc' }}>
          {messages.length === 0 && (
            <div className="pt-4">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-brand-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Document Q&A</p>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
                  Ask any question about this document — deadlines, requirements, what to do next, or translations.
                </p>
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Suggested questions</p>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors leading-snug"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={clsx('group flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'model' && (
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <Sparkles size={11} className="text-brand-500" />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm',
                  )}
                >
                  {msg.role === 'user' ? (
                    <span>{msg.content}</span>
                  ) : (
                    msg.content ? (
                      <div className="prose-message">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (msg.streaming && (
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ))
                  )}
                  {msg.role === 'model' && msg.content && msg.streaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-brand-400 animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </div>
              </div>
              {/* Action bar — visible on hover, hidden while streaming */}
              {!msg.streaming && msg.content && (
                <div className={clsx(
                  'flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
                  msg.role === 'user' ? 'pr-1' : 'pl-8',
                )}>
                  <button onClick={() => copyMsg(msg.id, msg.content)} title="Copy" className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    {copiedId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                  <button onClick={() => printMsg(msg.content)} title="Print" className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <Printer size={11} />
                  </button>
                  {msg.role === 'user' && (
                    <button
                      onClick={() => { setInput(msg.content); textareaRef.current?.focus() }}
                      title="Edit & resend"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this document…"
              rows={1}
              disabled={streaming}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none leading-relaxed min-h-[24px] disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            {streaming ? (
              <button
                onClick={handleStop}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-brand-600 hover:bg-brand-700 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={13} className="text-white" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
