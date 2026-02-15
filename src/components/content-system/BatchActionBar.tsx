'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { Stage } from './types'

interface BatchActionBarProps {
  selectedCount: number
  totalCount: number
  stage: Stage
  loading?: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onAdvance: () => void
  onReject: (reason: string, createDirective: boolean) => void
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  stage,
  loading = false,
  onSelectAll,
  onClearSelection,
  onAdvance,
  onReject,
}: BatchActionBarProps) {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [createDirective, setCreateDirective] = useState(false)

  if (selectedCount === 0) return null

  const advanceLabel =
    stage === 'briefs' || stage === 'review'
      ? stage === 'review'
        ? 'Publish Selected'
        : 'Approve Selected'
      : 'Advance Selected'

  function handleRejectClick() {
    if (!showRejectInput) {
      setShowRejectInput(true)
      return
    }
    onReject(rejectReason, createDirective)
    setShowRejectInput(false)
    setRejectReason('')
    setCreateDirective(false)
  }

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-kiuli-gray bg-kiuli-ivory px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-kiuli-charcoal">
          <span className="font-semibold">{selectedCount} selected</span>
          <button
            onClick={onSelectAll}
            className="text-kiuli-teal underline-offset-2 hover:underline"
          >
            Select All ({totalCount})
          </button>
          <button
            onClick={() => {
              onClearSelection()
              setShowRejectInput(false)
            }}
            className="text-kiuli-charcoal/50 underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAdvance}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded bg-kiuli-teal px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-kiuli-teal/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? 'Advancing...' : advanceLabel}
          </button>
          <button
            onClick={handleRejectClick}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
          >
            Reject Selected
          </button>
        </div>
      </div>

      {showRejectInput && (
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Shared rejection reason..."
            className="flex-1 rounded border border-kiuli-gray bg-white px-3 py-1.5 text-sm text-kiuli-charcoal placeholder:text-kiuli-charcoal/40 focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
          />
          <label className="flex items-center gap-1.5 text-xs text-kiuli-charcoal/70">
            <Checkbox
              checked={createDirective}
              onCheckedChange={(checked) => setCreateDirective(checked === true)}
              className="h-3.5 w-3.5 border-kiuli-gray data-[state=checked]:border-kiuli-teal data-[state=checked]:bg-kiuli-teal"
            />
            Create Directive?
          </label>
          <button
            onClick={handleRejectClick}
            disabled={!rejectReason.trim() || loading}
            className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? 'Rejecting...' : 'Confirm Reject'}
          </button>
          <button
            onClick={() => {
              setShowRejectInput(false)
              setRejectReason('')
              setCreateDirective(false)
            }}
            className="text-xs text-kiuli-charcoal/50 underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
