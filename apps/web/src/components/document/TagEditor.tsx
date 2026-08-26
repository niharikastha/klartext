'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, Tag as TagIcon, Check, Pencil } from 'lucide-react'
import { tags as tagsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagEditorProps {
  documentId: string
  initialTags?: Tag[]
  onTagsChange?: (tags: Tag[]) => void
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

export function TagEditor({ documentId, initialTags = [], onTagsChange }: TagEditorProps) {
  const [docTags, setDocTags] = useState<Tag[]>(initialTags)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tagsApi.list().then(r => setAllTags(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setDocTags(initialTags)
  }, [initialTags.map(t => t.id).join(',')])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggle = async (tag: Tag) => {
    const isAttached = docTags.some(t => t.id === tag.id)
    const newDocTags = isAttached
      ? docTags.filter(t => t.id !== tag.id)
      : [...docTags, tag]
    setDocTags(newDocTags)
    onTagsChange?.(newDocTags)
    await tagsApi.setDocumentTags(documentId, newDocTags.map(t => t.id)).catch(() => {
      setDocTags(docTags)
      onTagsChange?.(docTags)
      toast.error('Failed to update tags')
    })
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const res = await tagsApi.create(newName.trim(), newColor)
      const tag: Tag = res.data
      setAllTags(prev => [...prev, tag])
      // Auto-attach to doc
      const newDocTags = [...docTags, tag]
      setDocTags(newDocTags)
      onTagsChange?.(newDocTags)
      await tagsApi.setDocumentTags(documentId, newDocTags.map(t => t.id))
      setNewName('')
      setNewColor(PRESET_COLORS[0])
      setCreating(false)
      toast.success('Tag created')
    } catch {
      toast.error('Failed to create tag')
    }
  }

  const handleEditSave = async (id: string) => {
    try {
      const res = await tagsApi.update(id, { name: editName.trim(), color: editColor })
      const updated: Tag = res.data
      setAllTags(prev => prev.map(t => t.id === id ? updated : t))
      setDocTags(prev => prev.map(t => t.id === id ? updated : t))
      setEditingId(null)
    } catch {
      toast.error('Failed to update tag')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await tagsApi.delete(id)
      setAllTags(prev => prev.filter(t => t.id !== id))
      const newDocTags = docTags.filter(t => t.id !== id)
      setDocTags(newDocTags)
      onTagsChange?.(newDocTags)
    } catch {
      toast.error('Failed to delete tag')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-wrap gap-1.5 items-center">
        {docTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => toggle(tag)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add tag
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-2 max-h-56 overflow-y-auto">
            {allTags.length === 0 && !creating && (
              <p className="text-xs text-gray-400 text-center py-3">No tags yet</p>
            )}
            {allTags.map(tag => {
              const attached = docTags.some(t => t.id === tag.id)
              if (editingId === tag.id) {
                return (
                  <div key={tag.id} className="p-1.5 rounded-lg bg-gray-50 mb-1">
                    <input
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 mb-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(tag.id)}
                    />
                    <div className="flex gap-1 flex-wrap mb-1.5">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          className={`w-4 h-4 rounded-full border-2 ${editColor === c ? 'border-gray-800' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditSave(tag.id)}
                        className="flex-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700"
                      >Save</button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                      >Cancel</button>
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group"
                >
                  <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggle(tag)}>
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: tag.color }}
                    >
                      {attached && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-sm text-gray-700">{tag.name}</span>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color) }}
                      className="p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-100 p-2">
            {creating ? (
              <div>
                <input
                  autoFocus
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Tag name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex gap-1 flex-wrap mb-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleCreate}
                    className="flex-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700"
                  >Create</button>
                  <button
                    onClick={() => { setCreating(false); setNewName('') }}
                    className="flex-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 px-1 py-1"
              >
                <Plus className="w-3 h-3" />
                Create new tag
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
