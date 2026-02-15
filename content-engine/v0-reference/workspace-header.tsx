// V0 Reference — WorkspaceHeader
// NOTE: This uses shadcn/ui DropdownMenu and Tooltip components.
// CLI must replace these with plain HTML/Tailwind equivalents since
// Payload admin context doesn't have shadcn installed.

"use client"

import { useState, useRef, useEffect } from "react"
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  MoreVertical,
} from "lucide-react"
import {
  contentTypeBadgeStyles,
  contentTypeLabels,
  stageLabels,
  getAdvanceButtonLabel,
  type WorkspaceProject,
} from "@/lib/workspace-data"
// REPLACE THESE with plain HTML/Tailwind implementations:
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WorkspaceHeaderProps {
  project: WorkspaceProject
  onBack: () => void
  onTitleChange: (title: string) => void
  onAdvance: () => void
}

export function WorkspaceHeader({
  project,
  onBack,
  onTitleChange,
  onAdvance,
}: WorkspaceHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(project.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditTitle(project.title)
  }, [project.title])

  function handleTitleSave() {
    if (editTitle.trim() && editTitle.trim() !== project.title) {
      onTitleChange(editTitle.trim())
    } else {
      setEditTitle(project.title)
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleTitleSave()
    } else if (e.key === "Escape") {
      setEditTitle(project.title)
      setIsEditing(false)
    }
  }

  const badge = contentTypeBadgeStyles[project.contentType]
  const advanceLabel = getAdvanceButtonLabel(
    project.stage,
    project.contentType
  )
  const isProcessing = project.processingStatus === "processing"

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-kiuli-gray/60 bg-white px-4 py-2.5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-kiuli-charcoal/60 transition-colors hover:bg-kiuli-ivory hover:text-kiuli-charcoal"
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
            className="min-w-0 truncate text-left text-sm font-semibold text-kiuli-charcoal hover:underline hover:underline-offset-2"
            title="Click to edit title"
          >
            {project.title}
          </button>
        )}

        {/* Content type badge */}
        <span
          className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}
        >
          {contentTypeLabels[project.contentType]}
        </span>

        {/* Stage badge */}
        <span className="inline-flex shrink-0 items-center rounded bg-kiuli-ivory px-2 py-0.5 text-[11px] font-medium text-kiuli-charcoal/70">
          {stageLabels[project.stage]}
        </span>

        {/* Processing status */}
        {project.processingStatus === "completed" && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
            title="Processing completed"
          />
        )}
        {project.processingStatus === "failed" && (
          {/* REPLACE with CSS :hover tooltip */}
          <span
            className="h-2.5 w-2.5 shrink-0 cursor-help rounded-full bg-red-500"
            title={project.errorMessage || "Processing failed"}
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
            onClick={onAdvance}
            disabled={isProcessing}
            className="rounded bg-kiuli-clay px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40"
          >
            {advanceLabel}
          </button>
        )}

        {/* REPLACE DropdownMenu with plain useState toggle + click-outside */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded text-kiuli-charcoal/50 transition-colors hover:bg-kiuli-ivory hover:text-kiuli-charcoal"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded border border-kiuli-gray bg-white text-sm text-kiuli-charcoal shadow-sm"
          >
            <DropdownMenuItem className="cursor-pointer text-xs hover:bg-kiuli-ivory">
              Reject
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-xs hover:bg-kiuli-ivory">
              View Versions
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-xs hover:bg-kiuli-ivory">
              View in Payload Admin
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
