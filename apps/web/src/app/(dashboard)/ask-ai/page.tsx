'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, MessageSquare, Sparkles, FileText, Trash2, Send, X, RotateCcw, ChevronDown, Check, Copy, Printer, Pencil, Database, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clsx } from 'clsx'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { ReferencePanel, type DocRef } from '@/components/document/ReferencePanel'

interface Session {
  id: string
  title: string
  documentId: string | null
  documentName: string | null
  updatedAt: string
  createdAt: string
}

interface Message {
  id: string
  role: 'user' | 'model'
  content: string
  streaming?: boolean
  toolsUsed?: string[]
  refs?: DocRef[]
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const DOC_SUGGESTIONS = [
  'What does this document require me to do?',
  'What happens if I miss the deadline?',
  'What documents do I need to bring?',
  'Can you explain this in simpler terms?',
  'What are the most important action items?',
]

const GENERAL_SUGGESTIONS = [
  'What documents do I need for a German work visa?',
  'How do I register my address (Anmeldung)?',
  'What is the Sozialversicherungsnummer?',
  'How do I get a Steueridentifikationsnummer?',
  'What is a Finanzamt and what do they do?',
]

export default function AskAIPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeRef, setActiveRef] = useState<DocRef | null>(null)
  const [followUps, setFollowUps] = useState<string[]>([])
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

  const activeSession = sessions.find(s => s.id === activeId) || null

  useEffect(() => {
    Promise.all([
      api.get('/chat-sessions').then(r => { setSessions(r.data); setLoadingSessions(false) }).catch(() => setLoadingSessions(false)),
      api.get('/documents').then(r => setDocuments(r.data)).catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNewChat = async () => {
    try {
      const res = await api.post('/chat-sessions', {})
      const newSession: Session = res.data
      setSessions(prev => [newSession, ...prev])
      setActiveId(newSession.id)
      setMessages([])
    } catch {
      toast.error('Failed to create chat session')
    }
  }

  const handleSelectSession = async (id: string) => {
    if (id === activeId) return
    setActiveId(id)
    try {
      const res = await api.get(`/chat-sessions/${id}`)
      const sess = res.data
      setMessages((sess.messages || []).map((m: any) => ({
        id: crypto.randomUUID(),
        role: m.role,
        content: m.content,
        refs: m.refs ?? undefined,
      })))
    } catch {
      setMessages([])
    }
  }

  const handleDeleteSession = async (id: string) => {
    try {
      await api.delete(`/chat-sessions/${id}`)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeId === id) {
        setActiveId(null)
        setMessages([])
      }
    } catch {
      toast.error('Failed to delete session')
    }
  }

  const handleAttachDocument = async (docId: string | null, docName: string | null) => {
    setDocPickerOpen(false)
    if (!activeId) return
    try {
      await api.patch(`/chat-sessions/${activeId}`, { documentId: docId, documentName: docName })
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, documentId: docId, documentName: docName } : s))
    } catch {
      toast.error('Failed to update document')
    }
  }

  const handleClearMessages = () => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }

  const exportChat = useCallback(() => {
    if (!messages.length) return
    const title = activeSession?.title || 'Chat'
    const lines = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([`# ${title}\n\n${lines}`], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages, activeSession])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !activeId) return

    setFollowUps([])
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'model', content: '', streaming: true }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStreaming(true)
    abortRef.current = new AbortController()

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api'
      const res = await fetch(`${API_BASE}/chat-sessions/${activeId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text.trim() }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

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
            if (parsed.type === 'tool_use') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolsUsed: [...(m.toolsUsed || []), parsed.label as string] }
                  : m
              ))
            } else if (parsed.type === 'references') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, refs: parsed.refs as DocRef[] } : m
              ))
            } else if (parsed.text) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + parsed.text } : m
              ))
            }
          } catch { /* skip malformed */ }
        }
      }

      // Refresh session title (may have been auto-set)
      const [updated, suggestRes] = await Promise.allSettled([
        api.get(`/chat-sessions/${activeId}`),
        api.post(`/chat-sessions/${activeId}/follow-ups`, { message: text.trim() }),
      ])
      if (updated.status === 'fulfilled') {
        setSessions(prev => prev.map(s => s.id === activeId
          ? { ...s, title: updated.value.data.title, updatedAt: updated.value.data.updatedAt }
          : s))
      }
      if (suggestRes.status === 'fulfilled' && Array.isArray(suggestRes.value.data)) {
        setFollowUps(suggestRes.value.data.slice(0, 3))
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const errMsg = err?.message?.includes('rate limit') || err?.message?.includes('quota')
        ? err.message
        : 'Sorry, something went wrong. Please try again.'
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: errMsg, streaming: false }
          : m
      ))
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
      setStreaming(false)
      abortRef.current = null
    }
  }, [activeId, streaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const suggestions = activeSession?.documentId ? DOC_SUGGESTIONS : GENERAL_SUGGESTIONS

  return (
    <div className="flex h-screen overflow-hidden" style={{ marginLeft: 0 }}>
      {/* Left sidebar */}
      <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 flex-shrink-0 border-b border-white/10" style={{ background: '#0f0f23' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-brand-400" />
              <span className="text-sm font-bold text-white">Ask AI</span>
            </div>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> New
            </button>
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="p-4 text-center text-sm text-slate-400">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No chats yet</p>
              <p className="text-xs text-slate-300 mt-1">Click "New" to start</p>
            </div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={clsx(
                  'group w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors',
                  activeId === s.id && 'bg-brand-50 border-l-2 border-brand-500',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium text-slate-700 truncate leading-snug flex-1">{s.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {s.documentName && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                    <FileText size={9} />
                    {s.documentName.length > 22 ? s.documentName.slice(0, 22) + '…' : s.documentName}
                  </span>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">{formatRelativeTime(s.updatedAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ background: '#f8fafc' }}>
            <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-brand-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Ask anything</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
              Chat with AI about your German documents. Ask about deadlines, requirements, what to bring, or anything else.
            </p>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Start a new chat
            </button>
          </div>
        ) : (
          <>
            {/* Topbar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-sm font-bold text-slate-800 truncate">{activeSession?.title || 'Chat'}</h1>
                {activeSession?.documentName && (
                  <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full">
                    <FileText size={11} />
                    {activeSession.documentName.length > 28 ? activeSession.documentName.slice(0, 28) + '…' : activeSession.documentName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Document picker */}
                <div className="relative">
                  <button
                    onClick={() => setDocPickerOpen(p => !p)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <FileText size={12} />
                    {activeSession?.documentName ? 'Change doc' : 'Select document'}
                    <ChevronDown size={11} />
                  </button>
                  {docPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDocPickerOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Select document for context</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                          <button
                            onClick={() => handleAttachDocument(null, null)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <X size={13} /> No document (general chat)
                          </button>
                          {documents.filter(d => d.analysisStatus === 'completed').map(d => (
                            <button
                              key={d.id}
                              onClick={() => handleAttachDocument(d.id, d.originalName)}
                              className={clsx(
                                'w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 flex items-center gap-2 transition-colors',
                                activeSession?.documentId === d.id ? 'text-brand-600 bg-brand-50' : 'text-slate-700',
                              )}
                            >
                              <FileText size={13} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate flex-1">{d.originalName}</span>
                              {activeSession?.documentId === d.id && <Check size={12} className="flex-shrink-0 text-brand-500" />}
                            </button>
                          ))}
                          {documents.filter(d => d.analysisStatus === 'completed').length === 0 && (
                            <p className="px-4 py-3 text-sm text-slate-400">No analyzed documents yet</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {messages.length > 0 && (
                  <>
                    <button
                      onClick={exportChat}
                      className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
                      title="Export chat"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={handleClearMessages}
                      className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
                      title="Clear messages"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ background: '#f8fafc' }}>
              {messages.length === 0 && (
                <div className="pt-6 max-w-2xl mx-auto">
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
                      <Sparkles size={24} className="text-brand-500" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 mb-1.5">
                      {activeSession?.documentName ? `Asking about: ${activeSession.documentName}` : 'General AI Assistant'}
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-md">
                      {activeSession?.documentName
                        ? 'Ask anything about this document — deadlines, requirements, what to do next, or translations.'
                        : 'Ask anything about German immigration, bureaucracy, or documents you need to navigate.'}
                    </p>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Suggested questions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestions.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-left text-sm px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors leading-snug shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={clsx('group flex flex-col max-w-3xl', msg.role === 'user' ? 'items-end ml-auto' : 'items-start mr-auto')}
                  style={{ width: '100%' }}
                >
                  <div className={clsx('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'model' && (
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2.5">
                        <Sparkles size={12} className="text-brand-500" />
                      </div>
                    )}
                    <div
                      className={clsx(
                        'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm',
                      )}
                    >
                      {msg.role === 'user' ? (
                        <span>{msg.content}</span>
                      ) : (
                        <>
                          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2.5 border-b border-slate-100">
                              {msg.toolsUsed.map((label, i) => (
                                <span key={i} className="flex items-center gap-1 text-[10px] font-medium bg-brand-50 text-brand-600 border border-brand-100 px-2 py-0.5 rounded-full">
                                  <Database size={9} />
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                          {msg.content ? (
                            <>
                              <div className="prose-message">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                              {!msg.streaming && msg.refs && msg.refs.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Sources</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.refs.map(ref => (
                                      <button
                                        key={ref.id}
                                        onClick={() => setActiveRef(ref)}
                                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full hover:bg-brand-100 hover:border-brand-300 transition-colors"
                                      >
                                        <FileText size={10} />
                                        {ref.name.length > 26 ? ref.name.slice(0, 26) + '…' : ref.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (msg.streaming && (
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          ))}
                        </>
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
                      msg.role === 'user' ? 'pr-1' : 'pl-10',
                    )}>
                      <button onClick={() => copyMsg(msg.id, msg.content)} title="Copy" className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                      <button onClick={() => printMsg(msg.content)} title="Print" className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                        <Printer size={12} />
                      </button>
                      {msg.role === 'user' && (
                        <button
                          onClick={() => { setInput(msg.content); textareaRef.current?.focus() }}
                          title="Edit & resend"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div ref={bottomRef} />
            </div>

            {/* Follow-up suggestions */}
            {!streaming && followUps.length > 0 && (
              <div className="flex-shrink-0 px-6 pt-3 pb-1 bg-white border-t border-slate-100">
                <div className="flex flex-wrap gap-2 max-w-3xl mx-auto">
                  {followUps.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors leading-snug text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all max-w-3xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={activeSession?.documentName ? `Ask about ${activeSession.documentName}…` : 'Ask anything about German bureaucracy…'}
                  rows={1}
                  disabled={streaming}
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none leading-relaxed min-h-[24px] disabled:opacity-50"
                  style={{ maxHeight: '140px' }}
                />
                {streaming ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                    title="Stop"
                  >
                    <span className="w-3 h-3 rounded-sm bg-white" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim()}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={14} className="text-white" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
      {activeRef && (
        <ReferencePanel
          docRef={activeRef}
          doc={documents.find(d => d.id === activeRef.id) || null}
          onClose={() => setActiveRef(null)}
        />
      )}
    </div>
  )
}
