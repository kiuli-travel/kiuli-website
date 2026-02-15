'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Search, Filter, Loader2 } from 'lucide-react'
import {
  stageLabels,
  type Stage,
  type ContentType,
  type Origin,
  type ProcessingStatus,
  type ContentProject,
  type DashboardMetrics,
  type RecentJob,
} from './types'
import { ProjectList } from './ProjectList'
import { BatchActionBar } from './BatchActionBar'
import { SystemHealthView } from './SystemHealthView'

const stages: Stage[] = [
  'ideas',
  'briefs',
  'research',
  'drafts',
  'review',
  'published',
  'filtered',
]

type TabValue = Stage | 'system_health'

export default function ContentEngineDashboard() {
  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabValue>('ideas')
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | ContentType>('all')
  const [originFilter, setOriginFilter] = useState<'all' | Origin>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ProcessingStatus>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [projects, setProjects] = useState<ContentProject[]>([])
  const [jobs, setJobs] = useState<RecentJob[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [batchLoading, setBatchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────

  const applyData = useCallback((data: Record<string, unknown>) => {
    setProjects(
      ((data.projects as Record<string, unknown>[]) || []).map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt as string),
      })) as ContentProject[],
    )
    setJobs((data.jobs as RecentJob[]) || [])
    const m = data.metrics as Record<string, unknown> | undefined
    if (m) {
      const emb = m.embeddings as Record<string, unknown>
      setMetrics({
        ...(m as unknown as DashboardMetrics),
        embeddings: {
          ...(emb as unknown as DashboardMetrics['embeddings']),
          lastUpdated: emb.lastUpdated ? new Date(emb.lastUpdated as string) : null,
        },
      })
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/content/dashboard', { credentials: 'include' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to load dashboard: ${res.status} ${text}`)
      }
      applyData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [applyData])

  const refetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/content/dashboard', { credentials: 'include' })
      if (res.ok) applyData(await res.json())
    } catch {
      // silent — data stays stale until next manual refresh
    }
  }, [applyData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived ──────────────────────────────────────────────────────────────

  const stageCounts = useMemo(() => {
    const counts: Record<Stage, number> = {
      ideas: 0,
      briefs: 0,
      research: 0,
      drafts: 0,
      review: 0,
      published: 0,
      filtered: 0,
    }
    for (const p of projects) {
      if (counts[p.stage] !== undefined) {
        counts[p.stage]++
      }
    }
    return counts
  }, [projects])

  const filteredProjects = useMemo(() => {
    if (activeTab === 'system_health') return []
    return projects.filter((p) => {
      if (p.stage !== activeTab) return false
      if (contentTypeFilter !== 'all' && p.contentType !== contentTypeFilter) return false
      if (originFilter !== 'all' && p.origin !== originFilter) return false
      if (statusFilter !== 'all' && p.processingStatus !== statusFilter) return false
      if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [projects, activeTab, contentTypeFilter, originFilter, statusFilter, search])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredProjects.map((p) => p.id)))
  }, [filteredProjects])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleAdvance = useCallback(async () => {
    const ids = Array.from(selectedIds).map(Number)
    setBatchLoading(true)
    try {
      await fetch('/api/content/dashboard/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance', projectIds: ids }),
      })
      setSelectedIds(new Set())
      await refetchData()
    } catch {
      // Error handled silently; user can retry
    } finally {
      setBatchLoading(false)
    }
  }, [selectedIds, refetchData])

  const handleReject = useCallback(
    async (reason: string, createDirective: boolean) => {
      const ids = Array.from(selectedIds).map(Number)
      setBatchLoading(true)
      try {
        await fetch('/api/content/dashboard/batch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject', projectIds: ids, reason, createDirective }),
        })
        setSelectedIds(new Set())
        await refetchData()
      } catch {
        // Error handled silently; user can retry
      } finally {
        setBatchLoading(false)
      }
    },
    [selectedIds, refetchData],
  )

  const handleRetry = useCallback(
    async (jobId: string) => {
      try {
        await fetch('/api/content/dashboard/batch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry', projectIds: [Number(jobId)] }),
        })
        await refetchData()
      } catch {
        // ignore
      }
    },
    [refetchData],
  )

  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab)
    setSelectedIds(new Set())
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-kiuli-charcoal/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading Content Engine...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="max-w-md rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 text-sm font-semibold text-red-700">Error loading dashboard</p>
          <p className="mb-4 text-xs text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="rounded bg-kiuli-teal px-4 py-2 text-xs font-medium text-white hover:bg-kiuli-teal/90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isStageTab = activeTab !== 'system_health'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-kiuli-gray/60 px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-kiuli-charcoal">Content Engine</h1>

          {isStageTab && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Content Type */}
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kiuli-charcoal/40" />
                <select
                  value={contentTypeFilter}
                  onChange={(e) =>
                    setContentTypeFilter(e.target.value as 'all' | ContentType)
                  }
                  className="h-8 appearance-none rounded border border-kiuli-gray bg-white pl-8 pr-8 text-xs text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
                >
                  <option value="all">All Types</option>
                  <option value="itinerary_cluster">Articles</option>
                  <option value="destination_page">Destination Pages</option>
                  <option value="property_page">Property Pages</option>
                </select>
              </div>

              {/* Origin */}
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as 'all' | Origin)}
                className="h-8 appearance-none rounded border border-kiuli-gray bg-white px-3 pr-8 text-xs text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
              >
                <option value="all">All Origins</option>
                <option value="itinerary">Itinerary</option>
                <option value="cascade">Cascade</option>
                <option value="external">External</option>
                <option value="designer">Designer</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | ProcessingStatus)
                }
                className="h-8 appearance-none rounded border border-kiuli-gray bg-white px-3 pr-8 text-xs text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
              >
                <option value="all">All Statuses</option>
                <option value="idle">Idle</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kiuli-charcoal/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="h-8 w-52 rounded border border-kiuli-gray bg-white pl-8 pr-3 text-xs text-kiuli-charcoal placeholder:text-kiuli-charcoal/40 focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Stage Tabs */}
      <nav className="flex items-center border-b border-kiuli-gray/60 px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {stages.map((stage) => {
            const isActive = activeTab === stage
            return (
              <button
                key={stage}
                onClick={() => handleTabChange(stage)}
                className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-kiuli-teal'
                    : 'text-kiuli-charcoal/60 hover:text-kiuli-charcoal'
                } ${stage === 'filtered' ? 'opacity-60' : ''}`}
              >
                {stageLabels[stage]}
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-medium ${
                    isActive
                      ? 'bg-kiuli-teal text-white'
                      : 'bg-kiuli-gray/50 text-kiuli-charcoal/60'
                  }`}
                >
                  {stageCounts[stage]}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kiuli-teal" />
                )}
              </button>
            )
          })}
        </div>

        {/* Divider + System Health */}
        <div className="mx-2 h-6 w-px shrink-0 bg-kiuli-gray/60" />
        <button
          onClick={() => handleTabChange('system_health')}
          className={`relative flex shrink-0 items-center px-4 py-3 text-sm transition-colors ${
            activeTab === 'system_health'
              ? 'font-semibold text-kiuli-teal'
              : 'text-kiuli-charcoal/60 hover:text-kiuli-charcoal'
          }`}
        >
          System Health
          {activeTab === 'system_health' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kiuli-teal" />
          )}
        </button>
      </nav>

      {/* Content */}
      {activeTab === 'system_health' ? (
        <SystemHealthView
          metrics={metrics!}
          jobs={jobs}
          onRetry={handleRetry}
        />
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Batch Action Bar */}
          <BatchActionBar
            selectedCount={selectedIds.size}
            totalCount={filteredProjects.length}
            stage={activeTab}
            loading={batchLoading}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onAdvance={handleAdvance}
            onReject={handleReject}
          />

          {/* Project List */}
          <ProjectList
            projects={filteredProjects}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      )}
    </div>
  )
}
