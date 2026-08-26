'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Calendar,
  AlertTriangle, Clock,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  subMonths, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns'
import { clsx } from 'clsx'
import { documents as docsApi, calendarEvents } from '@/lib/api'
import toast from 'react-hot-toast'

interface CalEvent {
  id: string
  title: string
  description: string | null
  date: string
  color: string
  type: 'user'
}

interface ActionItem {
  id: string
  title: string
  description: string
  deadline: string
  priority: string
  completed: boolean
  documentName?: string
  type: 'action'
}

type AnyEvent = CalEvent | ActionItem

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

const EVENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  const days: Date[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

interface EventModalProps {
  date: Date
  event?: CalEvent
  onSave: (data: { title: string; description: string; date: string; color: string }) => void
  onDelete?: () => void
  onClose: () => void
}

function EventModal({ date, event, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [color, setColor] = useState(event?.color ?? '#6366f1')
  const [selectedDate, setSelectedDate] = useState(event?.date ?? format(date, 'yyyy-MM-dd'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-[15px]">{event ? 'Edit event' : 'New event'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add description…"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full transition-transform hover:scale-110', color === c && 'ring-2 ring-offset-2 ring-slate-400 scale-110')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2">
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (title.trim()) onSave({ title: title.trim(), description, date: selectedDate, color }) }}
            disabled={!title.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-40"
          >
            <Check size={14} /> {event ? 'Save' : 'Add event'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [userEvents, setUserEvents] = useState<CalEvent[]>([])
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ date: Date; event?: CalEvent } | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [eventsRes, docsRes] = await Promise.allSettled([
        calendarEvents.list(
          format(startOfWeek(startOfMonth(currentMonth)), 'yyyy-MM-dd'),
          format(endOfWeek(endOfMonth(currentMonth)), 'yyyy-MM-dd'),
        ),
        docsApi.list(),
      ])
      if (eventsRes.status === 'fulfilled') {
        setUserEvents(eventsRes.value.data.map((e: any) => ({ ...e, type: 'user' as const })))
      }
      if (docsRes.status === 'fulfilled') {
        const items = docsRes.value.data.flatMap((doc: any) =>
          (doc.analysisResult?.actionItems || [])
            .filter((i: any) => i.deadline)
            .map((i: any) => ({
              ...i,
              documentName: doc.fileName,
              type: 'action' as const,
            }))
        )
        setActionItems(items)
      }
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])

  const getEventsForDay = useCallback((day: Date): AnyEvent[] => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const evts: AnyEvent[] = userEvents.filter(e => e.date === dateStr)
    const acts: AnyEvent[] = actionItems.filter(a => a.deadline?.startsWith(dateStr) && !a.completed)
    return [...evts, ...acts]
  }, [userEvents, actionItems])

  const handleAddEvent = async (data: { title: string; description: string; date: string; color: string }) => {
    try {
      const res = await calendarEvents.create(data)
      setUserEvents(prev => [...prev, { ...res.data, type: 'user' as const }])
      setModal(null)
      toast.success('Event added')
    } catch {
      toast.error('Failed to add event')
    }
  }

  const handleUpdateEvent = async (id: string, data: { title: string; description: string; date: string; color: string }) => {
    try {
      const res = await calendarEvents.update(id, data)
      setUserEvents(prev => prev.map(e => e.id === id ? { ...res.data, type: 'user' as const } : e))
      setModal(null)
      toast.success('Event updated')
    } catch {
      toast.error('Failed to update event')
    }
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await calendarEvents.remove(id)
      setUserEvents(prev => prev.filter(e => e.id !== id))
      setModal(null)
      toast.success('Event deleted')
    } catch {
      toast.error('Failed to delete event')
    }
  }

  const calDays = getCalendarDays(currentMonth)
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  const todayHasEvents = getEventsForDay(new Date()).length > 0

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8fafc' }}>

      {/* ── Left: calendar grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h1 className="text-lg font-bold text-slate-800">
              {format(currentMonth, 'MMMM yyyy')}
            </h1>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={() => setModal({ date: selectedDay ?? new Date() })}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> Add event
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 bg-white border-b border-slate-100 flex-shrink-0">
          {DAYS.map(d => (
            <div key={d} className="px-3 py-2.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: 'minmax(110px, 1fr)' }}>
              {calDays.map(day => {
                const dayEvents = getEventsForDay(day)
                const inMonth = isSameMonth(day, currentMonth)
                const today = isToday(day)
                const selected = selectedDay && isSameDay(day, selectedDay)
                const MAX_VISIBLE = 3

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
                    className={clsx(
                      'border-r border-b border-slate-100 p-2 cursor-pointer transition-colors min-h-[110px]',
                      !inMonth && 'bg-slate-50/60',
                      inMonth && !selected && 'hover:bg-brand-50/40',
                      selected && 'bg-brand-50/70 ring-1 ring-inset ring-brand-300',
                    )}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={clsx(
                          'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                          today && 'bg-brand-600 text-white',
                          !today && inMonth && 'text-slate-700',
                          !today && !inMonth && 'text-slate-300',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setModal({ date: day }) }}
                          className="opacity-0 hover:opacity-100 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-brand-600 hover:bg-brand-100 transition-all"
                        >
                          <Plus size={11} />
                        </button>
                      )}
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, MAX_VISIBLE).map((evt, i) => {
                        const isAction = evt.type === 'action'
                        const color = isAction ? PRIORITY_COLORS[(evt as ActionItem).priority] ?? '#94a3b8' : (evt as CalEvent).color
                        return (
                          <div
                            key={evt.id + i}
                            onClick={e => {
                              e.stopPropagation()
                              if (!isAction) setModal({ date: parseISO((evt as CalEvent).date), event: evt as CalEvent })
                            }}
                            className={clsx(
                              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium truncate leading-tight',
                              isAction ? 'cursor-default' : 'cursor-pointer hover:brightness-95',
                            )}
                            style={{ background: color + '22', color }}
                          >
                            {isAction ? <AlertTriangle size={9} className="flex-shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                            <span className="truncate">{evt.title}</span>
                          </div>
                        )
                      })}
                      {dayEvents.length > MAX_VISIBLE && (
                        <div className="text-[10px] font-semibold text-slate-400 pl-1">
                          +{dayEvents.length - MAX_VISIBLE} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: selected day detail ── */}
      <div className="w-[300px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          {selectedDay ? (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-800 leading-none">{format(selectedDay, 'd')}</p>
                <p className="text-sm font-medium text-slate-500 mt-0.5">{format(selectedDay, 'EEEE, MMMM yyyy')}</p>
              </div>
              <button
                onClick={() => setModal({ date: selectedDay })}
                className="flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={15} className="text-brand-500" />
                <p className="text-sm font-bold text-slate-700">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
              <p className="text-xs text-slate-400">Click a date to see its events</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedDay ? (
            selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-2">
                  <Calendar size={18} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No events</p>
                <button
                  onClick={() => setModal({ date: selectedDay })}
                  className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  + Add one
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {selectedDayEvents.map((evt, i) => {
                  const isAction = evt.type === 'action'
                  const color = isAction ? PRIORITY_COLORS[(evt as ActionItem).priority] ?? '#94a3b8' : (evt as CalEvent).color
                  return (
                    <div
                      key={evt.id + i}
                      className={clsx(
                        'rounded-xl p-3 border transition-colors',
                        isAction ? 'cursor-default' : 'cursor-pointer hover:brightness-95',
                      )}
                      style={{ background: color + '12', borderColor: color + '30' }}
                      onClick={() => !isAction && setModal({ date: parseISO((evt as CalEvent).date), event: evt as CalEvent })}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">{evt.title}</p>
                          {isAction && (evt as ActionItem).documentName && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              <Clock size={9} className="inline mr-0.5" />
                              {(evt as ActionItem).documentName}
                            </p>
                          )}
                          {!isAction && (evt as CalEvent).description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{(evt as CalEvent).description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: color + '20', color }}
                            >
                              {isAction ? (evt as ActionItem).priority : 'Event'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* Mini upcoming events when no day selected */
            <div className="p-3 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1 mb-2">Upcoming this month</p>
              {(() => {
                const today = format(new Date(), 'yyyy-MM-dd')
                const upcoming = [
                  ...userEvents.filter(e => e.date >= today && e.date <= monthEnd),
                  ...actionItems.filter(a => !a.completed && a.deadline >= today && a.deadline.startsWith(monthStart.slice(0, 7))),
                ].sort((a, b) => {
                  const dateA = a.type === 'user' ? (a as CalEvent).date : (a as ActionItem).deadline.slice(0, 10)
                  const dateB = b.type === 'user' ? (b as CalEvent).date : (b as ActionItem).deadline.slice(0, 10)
                  return dateA.localeCompare(dateB)
                }).slice(0, 8)

                if (!upcoming.length) return (
                  <p className="text-xs text-slate-400 text-center py-6">No upcoming events</p>
                )

                return upcoming.map((evt, i) => {
                  const isAction = evt.type === 'action'
                  const color = isAction ? PRIORITY_COLORS[(evt as ActionItem).priority] ?? '#94a3b8' : (evt as CalEvent).color
                  const dateStr = isAction ? (evt as ActionItem).deadline.slice(0, 10) : (evt as CalEvent).date
                  return (
                    <div key={evt.id + i} className="flex items-center gap-2.5 px-1 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-8 flex-shrink-0 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{format(parseISO(dateStr), 'MMM')}</p>
                        <p className="text-sm font-bold text-slate-700 leading-none">{format(parseISO(dateStr), 'd')}</p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <p className="text-xs font-medium text-slate-700 truncate">{evt.title}</p>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          onSave={data => {
            if (modal.event) {
              handleUpdateEvent(modal.event.id, data)
            } else {
              handleAddEvent(data)
            }
          }}
          onDelete={modal.event ? () => handleDeleteEvent(modal.event!.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
