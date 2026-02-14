'use client'

import React, { useState, useEffect } from 'react'
import {
  Check,
  AlertCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Compass,
  Globe,
  PenTool,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import type { ContentProject, Origin } from './types'
import { contentTypeLabels, contentTypeBadgeColors, originLabels } from './types'

const ITEMS_PER_PAGE = 20

const originIcons: Record<Origin, React.ElementType> = {
  itinerary: MapPin,
  cascade: Compass,
  external: Globe,
  designer: PenTool,
}

function formatAge(date: Date): string {
  const diff = Date.now() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

interface ProjectListProps {
  projects: ContentProject[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}

export function ProjectList({
  projects,
  selectedIds,
  onToggleSelect,
}: ProjectListProps) {
  const totalPages = Math.max(1, Math.ceil(projects.length / ITEMS_PER_PAGE))
  const [page, setPage] = useState(1)

  // Reset page when projects change
  useEffect(() => {
    setPage(1)
  }, [projects.length])

  const paged = projects.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  )

  return (
    <div className="flex flex-col gap-0">
      {paged.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-kiuli-charcoal/50">
          No projects in this stage.
        </div>
      )}
      {paged.map((project) => {
        const badge = contentTypeBadgeColors[project.contentType]
        const OriginIcon = originIcons[project.origin]
        const isSelected = selectedIds.has(project.id)

        return (
          <div
            key={project.id}
            className={`flex items-center gap-4 border-b border-kiuli-gray/60 px-4 py-3 transition-colors ${
              isSelected ? 'bg-kiuli-ivory/60' : 'hover:bg-kiuli-ivory/30'
            }`}
          >
            {/* Checkbox */}
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(project.id)}
              className="border-kiuli-gray data-[state=checked]:border-kiuli-teal data-[state=checked]:bg-kiuli-teal"
            />

            {/* Type badge */}
            {badge && (
              <span
                className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
              >
                {contentTypeLabels[project.contentType]}
              </span>
            )}

            {/* Title + metadata */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <button className="truncate text-left text-sm font-semibold text-kiuli-charcoal underline-offset-2 hover:underline">
                {project.title}
              </button>
              {project.filterReason && (
                <span className="truncate text-xs italic text-kiuli-charcoal/40">
                  {project.filterReason}
                </span>
              )}
              <div className="flex items-center gap-1.5 text-xs text-kiuli-charcoal/50">
                {OriginIcon && <OriginIcon className="h-3 w-3" />}
                <span>{originLabels[project.origin]}</span>
                {project.destinationNames.length > 0 && (
                  <>
                    <span className="text-kiuli-gray">{'/'}</span>
                    <span className="truncate">
                      {project.destinationNames.join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Processing status */}
            <div className="flex shrink-0 items-center">
              {project.processingStatus === 'processing' && (
                <Loader2 className="h-4 w-4 animate-spin text-kiuli-teal" />
              )}
              {project.processingStatus === 'completed' && (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
              {project.processingStatus === 'failed' && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="h-4 w-4 cursor-help text-red-500" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className="max-w-xs rounded border border-kiuli-gray bg-white text-xs text-kiuli-charcoal"
                    >
                      {project.errorMessage}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Age */}
            <div className="flex shrink-0 items-center gap-1 text-xs text-kiuli-charcoal/40">
              <Clock className="h-3 w-3" />
              <span>{formatAge(project.createdAt)}</span>
            </div>
          </div>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-kiuli-gray/60 px-4 py-3">
          <span className="text-xs text-kiuli-charcoal/50">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-kiuli-charcoal/70 transition-colors hover:bg-kiuli-ivory disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="text-xs text-kiuli-charcoal/50">
              {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-kiuli-charcoal/70 transition-colors hover:bg-kiuli-ivory disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
