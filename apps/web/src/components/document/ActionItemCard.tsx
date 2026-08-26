'use client'

import { useState } from 'react'
import { Calendar, FileText, CreditCard, CalendarClock, MoreHorizontal, CheckCircle2, Pencil, X, Check, Trash2 } from 'lucide-react'
import { format, isPast, differenceInDays } from 'date-fns'
import { clsx } from 'clsx'

interface ActionItem {
  id: string
  title: string
  description: string
  deadline?: string
  priority: string
  category: string
  completed: boolean
}

interface ActionItemCardProps {
  item: ActionItem & { documentName?: string }
  onToggle: (id: string, completed: boolean) => void
  onDeadlineChange?: (id: string, deadline: string | null) => void
  onEdit?: (id: string, data: { title: string; description: string; deadline: string | null; priority: string; category: string }) => void
  onDelete?: (id: string) => void
  showSource?: boolean
}

const categoryIcon: Record<string, React.ElementType> = {
  deadline: Calendar,
  document: FileText,
  payment: CreditCard,
  appointment: CalendarClock,
  other: MoreHorizontal,
}

const priorityStyles: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50/30',
  high: 'border-l-orange-400 bg-orange-50/30',
  medium: 'border-l-yellow-400 bg-yellow-50/20',
  low: 'border-l-green-400 bg-green-50/20',
}

const priorityBadge: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
}

export function ActionItemCard({ item, onToggle, onDeadlineChange, onEdit, onDelete, showSource }: ActionItemCardProps) {
  const Icon = categoryIcon[item.category] || MoreHorizontal
  const daysUntil = item.deadline ? differenceInDays(new Date(item.deadline), new Date()) : null
  const isOverdue = item.deadline && isPast(new Date(item.deadline)) && !item.completed

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    title: item.title,
    description: item.description,
    deadline: item.deadline ? format(new Date(item.deadline), 'yyyy-MM-dd') : '',
    priority: item.priority,
    category: item.category,
  })

  // non-edit deadline inline edit
  const [editingDeadline, setEditingDeadline] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState(
    item.deadline ? format(new Date(item.deadline), 'yyyy-MM-dd') : '',
  )

  const handleSaveEdit = () => {
    onEdit?.(item.id, {
      title: draft.title,
      description: draft.description,
      deadline: draft.deadline || null,
      priority: draft.priority,
      category: draft.category,
    })
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setDraft({
      title: item.title,
      description: item.description,
      deadline: item.deadline ? format(new Date(item.deadline), 'yyyy-MM-dd') : '',
      priority: item.priority,
      category: item.category,
    })
    setEditing(false)
  }

  const handleDeadlineSave = () => {
    setEditingDeadline(false)
    onDeadlineChange?.(item.id, deadlineInput || null)
  }

  if (editing) {
    return (
      <div className={clsx('bg-white rounded-xl border-2 border-brand-300 border-l-4 p-4 shadow-sm', priorityStyles[item.priority])}>
        <div className="space-y-3">
          <input
            type="text"
            value={draft.title}
            onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400"
            placeholder="Title"
            autoFocus
          />
          <textarea
            value={draft.description}
            onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 resize-none"
            placeholder="Description"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Deadline</label>
              <input
                type="date"
                value={draft.deadline}
                onChange={e => setDraft(p => ({ ...p, deadline: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Priority</label>
              <select
                value={draft.priority}
                onChange={e => setDraft(p => ({ ...p, priority: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select
                value={draft.category}
                onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400"
              >
                <option value="deadline">Deadline</option>
                <option value="document">Document</option>
                <option value="payment">Payment</option>
                <option value="appointment">Appointment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={!draft.title.trim()}
              className="flex items-center gap-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 border-l-4 p-4 shadow-sm transition-opacity group',
        priorityStyles[item.priority] || priorityStyles.medium,
        item.completed && 'opacity-50',
      )}
    >
      <div className="flex gap-3 items-start">
        {/* Toggle complete/incomplete */}
        <button
          onClick={() => onToggle(item.id, item.completed)}
          title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
          className={clsx(
            'mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
            item.completed
              ? 'bg-green-500 border-green-500 hover:bg-gray-300 hover:border-gray-300'
              : 'border-gray-300 hover:border-brand-500',
          )}
        >
          {item.completed && <CheckCircle2 size={14} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Icon size={14} className="text-gray-400 flex-shrink-0" />
            <span className={clsx('font-medium text-gray-900 text-sm', item.completed && 'line-through text-gray-400')}>
              {item.title}
            </span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', priorityBadge[item.priority])}>
              {item.priority}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2">{item.description}</p>

          {showSource && item.documentName && (
            <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
              <FileText size={10} />
              {item.documentName}
            </p>
          )}

          {/* Deadline row */}
          {onDeadlineChange ? (
            <div className="flex items-center gap-1.5">
              {editingDeadline ? (
                <>
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={e => setDeadlineInput(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:border-brand-400"
                    autoFocus
                  />
                  <button onClick={handleDeadlineSave} className="text-green-600 hover:text-green-700">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setEditingDeadline(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1 group/deadline">
                  <div
                    className={clsx(
                      'flex items-center gap-1.5 text-xs font-medium',
                      isOverdue ? 'text-red-600' : daysUntil !== null && daysUntil <= 7 ? 'text-orange-600' : 'text-gray-400',
                    )}
                  >
                    <Calendar size={11} />
                    {item.deadline
                      ? isOverdue
                        ? `Overdue by ${Math.abs(daysUntil!)} day${Math.abs(daysUntil!) !== 1 ? 's' : ''}`
                        : daysUntil === 0 ? 'Due today'
                        : daysUntil === 1 ? 'Due tomorrow'
                        : `Due ${format(new Date(item.deadline), 'MMM d, yyyy')}`
                      : 'No deadline'}
                  </div>
                  <button
                    onClick={() => setEditingDeadline(true)}
                    className="opacity-0 group-hover/deadline:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity ml-1"
                    title="Edit deadline"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            item.deadline && (
              <div
                className={clsx(
                  'flex items-center gap-1.5 text-xs font-medium',
                  isOverdue ? 'text-red-600' : daysUntil !== null && daysUntil <= 7 ? 'text-orange-600' : 'text-gray-400',
                )}
              >
                <Calendar size={11} />
                {isOverdue
                  ? `Overdue by ${Math.abs(daysUntil!)} day${Math.abs(daysUntil!) !== 1 ? 's' : ''}`
                  : daysUntil === 0 ? 'Due today'
                  : daysUntil === 1 ? 'Due tomorrow'
                  : `Due ${format(new Date(item.deadline), 'MMM d, yyyy')}`}
              </div>
            )
          )}
        </div>

        {/* Edit + Delete buttons */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0 mt-0.5">
          {onEdit && (
            <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-500" title="Edit">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-500" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
