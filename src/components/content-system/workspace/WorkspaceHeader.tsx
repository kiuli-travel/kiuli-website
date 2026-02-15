'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, Loader2, MoreVertical } from 'lucide-react'
import {
  contentTypeBadgeStyles,
  contentTypeLabels,
  stageLabels,
  getAdvanceButtonLabel,
  type WorkspaceProject,
} from '../workspace-types'
import {
  rejectProject,
  saveProjectFields,
  fetchProjectData,
} from '@/app/(payload)/admin/content-engine/project/[id]/actions'

interface WorkspaceHeaderProps {
  project: WorkspaceProject
  projectId: number
  onBack: () => void
  onAdvance: () => Promise<void>
  onProjectUpdate: (project: WorkspaceProject) => void
}

export function WorkspaceHeader({
  project,
  projectId,
  onBack,
  onAdvance,
  onProjectUpdate,
}: WorkspaceHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(project.title)
  const [advancing, setAdvancing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditTitle(project.title)
  }, [project.title])

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleTitleSave = useCallback(async () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== project.title) {
      const result = await saveProjectFields(projectId, { title: trimmed })
      if ('success' in result) {
        const refreshed = await fetchProjectData(projectId)
        if ('project' in refreshed) {
          onProjectUpdate(refreshed.project)
        }
      }
    } else {
      setEditTitle(project.title)
    }
    setIsEditing(false)
  }, [editTitle, project.title, projectId, onProjectUpdate])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditTitle(project.title)
      setIsEditing(false)
    }
  }

  async function handleAdvanceClick() {
    setAdvancing(true)
    try {
      await onAdvance()
    } finally {
      setAdvancing(false)
    }
  }

  async function handleReject() {
    setDropdownOpen(false)
    const reason = prompt('Rejection reason:')
    if (!reason) return
    const createDirective = confirm('Create an editorial directive from this reason?')
    const result = await rejectProject(projectId, reason, createDirective)
    if ('error' in result) {
      alert(result.error)
      return
    }
    const refreshed = await fetchProjectData(projectId)
    if ('project' in refreshed) {
      onProjectUpdate(refreshed.project)
    }
  }

  const badge = contentTypeBadgeStyles[project.contentType]
  const advanceLabel = getAdvanceButtonLabel(project.stage, project.contentType)
  const isProcessing = project.processingStatus === 'processing'

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-kiuli-gray/60 bg-white px-4 py-2.5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-0 bg-transparent text-kiuli-charcoal/60 transition-colors hover:bg-kiuli-ivory hover:text-kiuli-charcoal"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Title */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 rounded border border-kiuli-teal bg-white px-2 py-1 text-sm font-semibold text-kiuli-charcoal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="min-w-0 truncate border-0 bg-transparent text-left text-sm font-semibold text-kiuli-charcoal hover:underline hover:underline-offset-2"
            title="Click to edit title"
          >
            {project.title}
          </button>
        )}

        {/* Content type badge */}
        {badge && (
          <span
            className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}
          >
            {contentTypeLabels[project.contentType]}
          </span>
        )}

        {/* Stage badge */}
        <span className="inline-flex shrink-0 items-center rounded bg-kiuli-ivory px-2 py-0.5 text-[11px] font-medium text-kiuli-charcoal/70">
          {stageLabels[project.stage]}
        </span>

        {/* Processing status */}
        {project.processingStatus === 'completed' && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
            title="Processing completed"
          />
        )}
        {project.processingStatus === 'failed' && (
          <span
            className="h-2.5 w-2.5 shrink-0 cursor-help rounded-full bg-red-500"
            title={project.errorMessage || 'Processing failed'}
          />
        )}
        {isProcessing && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-kiuli-teal" />
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {advanceLabel && (
          <button
            onClick={handleAdvanceClick}
            disabled={isProcessing || advancing}
            className="rounded border-0 bg-kiuli-clay px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40"
          >
            {advancing ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : (
              advanceLabel
            )}
          </button>
        )}

        {/* Dropdown menu (plain HTML/Tailwind) */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-kiuli-charcoal/50 transition-colors hover:bg-kiuli-ivory hover:text-kiuli-charcoal"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded border border-kiuli-gray bg-white py-1 text-sm text-kiuli-charcoal shadow-sm">
              <button
                onClick={handleReject}
                className="w-full border-0 bg-transparent px-3 py-1.5 text-left text-xs hover:bg-kiuli-ivory"
              >
                Reject
              </button>
              <a
                href={`/admin/collections/content-projects/${project.id}/versions`}
                className="block px-3 py-1.5 text-xs no-underline hover:bg-kiuli-ivory"
                onClick={() => setDropdownOpen(false)}
              >
                View Versions
              </a>
              <a
                href={`/admin/collections/content-projects/${project.id}`}
                className="block px-3 py-1.5 text-xs no-underline hover:bg-kiuli-ivory"
                onClick={() => setDropdownOpen(false)}
              >
                View in Payload Admin
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
