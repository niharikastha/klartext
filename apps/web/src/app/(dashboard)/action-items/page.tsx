'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { CheckCircle, Clock, AlertTriangle, CheckSquare, X, ChevronDown, Check, Download } from 'lucide-react'
import { documents, actionItems as actionItemsApi } from '@/lib/api'
import { ActionItemCard } from '@/components/document/ActionItemCard'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

function generateICS(items: any[]): string {
  const withDeadlines = items.filter(i => i.deadline && !i.completed)
  const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 5, low: 9 }

  const events = withDeadlines.map(item => {
    const d = new Date(item.deadline)
    const dateStr = d.toISOString().replace(/-/g, '').slice(0, 8)
    const nextDay = new Date(d)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().replace(/-/g, '').slice(0, 8)
    const desc = [item.description, item.documentName ? `From: ${item.documentName}` : ''].filter(Boolean).join(' | ').replace(/\n/g, '\\n')
    return ['BEGIN:VEVENT', `DTSTART;VALUE=DATE:${dateStr}`, `DTEND;VALUE=DATE:${nextDayStr}`, `SUMMARY:${item.title}`, `DESCRIPTION:${desc}`, `PRIORITY:${priorityMap[item.priority] ?? 5}`, `UID:${item.id}@klartext`, 'END:VEVENT'].join('\r\n')
  })

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Klartext//EN', 'X-WR-CALNAME:Klartext Action Items', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n')
}

function downloadICS(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'klartext-action-items.ics'
  a.click()
  URL.revokeObjectURL(url)
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const CATEGORIES = ['deadline', 'document', 'payment', 'appointment', 'other'] as const

type SortKey = 'priority' | 'deadline' | 'newest'
type StatusFilter = 'all' | 'pending' | 'completed'

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
}

const sortLabel: Record<SortKey, string> = {
  priority: 'Priority',
  deadline: 'Deadline',
  newest: 'Newest',
}

export default function ActionItemsPage() {
  const [allItems, setAllItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('pending')
  const [sortBy, setSortBy] = useState<SortKey>('priority')

  useEffect(() => {
    documents.list().then(res => {
      const items = res.data.flatMap((doc: any) =>
        (doc.analysisResult?.actionItems || []).map((item: any) => ({
          ...item,
          documentName: doc.fileName,
        })),
      )
      setAllItems(items)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleToggle = async (id: string, currentlyCompleted: boolean) => {
    if (currentlyCompleted) {
      await actionItemsApi.uncomplete(id)
    } else {
      await actionItemsApi.complete(id)
    }
    setAllItems(prev => prev.map(i => i.id === id ? { ...i, completed: !currentlyCompleted } : i))
    toast.success(currentlyCompleted ? 'Marked as incomplete' : 'Marked as complete!')
  }

  const handleDeadlineChange = async (id: string, deadline: string | null) => {
    await actionItemsApi.updateDeadline(id, deadline)
    setAllItems(prev => prev.map(i => i.id === id ? { ...i, deadline: deadline ? new Date(deadline).toISOString() : null } : i))
    toast.success('Deadline updated')
  }

  const handleEdit = async (id: string, data: { title: string; description: string; deadline: string | null; priority: string; category: string }) => {
    await actionItemsApi.update(id, data)
    setAllItems(prev => prev.map(i => i.id === id ? { ...i, ...data, deadline: data.deadline ? new Date(data.deadline).toISOString() : null } : i))
    toast.success('Action item updated')
  }

  const handleDelete = async (id: string) => {
    await actionItemsApi.delete(id)
    setAllItems(prev => prev.filter(i => i.id !== id))
    toast.success('Deleted')
  }

  const totalPending = allItems.filter(i => !i.completed).length
  const totalCompleted = allItems.filter(i => i.completed).length
  const totalUrgent = allItems.filter(i => !i.completed && (i.priority === 'urgent' || i.priority === 'high')).length

  const filtered = useMemo(() => {
    let items = [...allItems]
    if (filterStatus !== 'all') items = items.filter(i => filterStatus === 'completed' ? i.completed : !i.completed)
    if (filterPriority !== 'all') items = items.filter(i => i.priority === filterPriority)
    if (filterCategory !== 'all') items = items.filter(i => i.category === filterCategory)
    items.sort((a, b) => {
      if (sortBy === 'priority') return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
      if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return items
  }, [allItems, filterStatus, filterPriority, filterCategory, sortBy])

  const hasActiveFilter = filterPriority !== 'all' || filterCategory !== 'all'

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Action Items</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track everything your documents require you to do</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadICS(generateICS(allItems))}
              disabled={allItems.filter(i => i.deadline && !i.completed).length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export deadlines to calendar"
            >
              <Download size={13} /> Export calendar
            </button>
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3.5 py-2">
              <CheckSquare size={14} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{allItems.length}</span>
              <span className="text-xs text-slate-400">total</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2">
              <Clock size={14} className="text-amber-500" />
              <span className="text-sm font-semibold text-amber-700">{totalPending}</span>
              <span className="text-xs text-amber-400">pending</span>
            </div>
            {totalUrgent > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-sm font-semibold text-red-700">{totalUrgent}</span>
                <span className="text-xs text-red-400">urgent</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">{totalCompleted}</span>
              <span className="text-xs text-emerald-400">done</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50 text-xs font-semibold">
            {(['pending', 'all', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={clsx(
                  'px-4 py-2 transition-all',
                  filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                )}
              >
                {s === 'pending' ? `Pending · ${totalPending}` : s === 'all' ? `All · ${allItems.length}` : `Done · ${totalCompleted}`}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Priority dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={clsx(
                  'flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all',
                  filterPriority !== 'all'
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {filterPriority !== 'all' && (
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', priorityDot[filterPriority])} />
                )}
                {filterPriority === 'all' ? 'Priority' : filterPriority.charAt(0).toUpperCase() + filterPriority.slice(1)}
                <ChevronDown size={12} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup value={filterPriority} onValueChange={setFilterPriority}>
                <DropdownMenuRadioItem value="all">
                  All priorities
                </DropdownMenuRadioItem>
                {PRIORITIES.map(p => (
                  <DropdownMenuRadioItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', priorityDot[p])} />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={clsx(
                  'flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all',
                  filterCategory !== 'all'
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {filterCategory === 'all' ? 'Category' : filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)}
                <ChevronDown size={12} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup value={filterCategory} onValueChange={setFilterCategory}>
                <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
                {CATEGORIES.map(c => (
                  <DropdownMenuRadioItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={() => { setFilterPriority('all'); setFilterCategory('all') }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X size={12} /> Clear filters
            </button>
          )}

          {/* Sort dropdown — pushed right */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all">
                  Sort: {sortLabel[sortBy]}
                  <ChevronDown size={12} className="text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
                  <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="deadline">Deadline (soonest)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-slate-400">Loading your action items...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckCircle size={30} className="text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-700 text-lg">
                {allItems.length === 0 ? 'No action items yet' : 'No items match your filters'}
              </p>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto">
                {allItems.length === 0
                  ? 'Upload a German document and AI will extract what you need to do'
                  : 'Try adjusting the filters above'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 font-medium mb-4">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              {hasActiveFilter && ' · filtered'}
            </p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filtered.map(item => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onDeadlineChange={handleDeadlineChange}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showSource
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
