'use client'

import { RefreshCw, AlertCircle, Database, Clock, FileWarning, BookOpen } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { stageLabels, type JobStatus, type DashboardMetrics, type RecentJob, type Stage } from './types'

const statusDotColors: Record<JobStatus, string> = {
  completed: 'bg-emerald-500',
  running: 'bg-amber-400',
  failed: 'bg-red-500',
}

const statusLabels: Record<JobStatus, string> = {
  completed: 'Completed',
  running: 'Running',
  failed: 'Failed',
}

function formatDate(date: Date | null): string {
  if (!date) return '--'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const m = months[date.getUTCMonth()]
  const d = date.getUTCDate()
  const h = date.getUTCHours().toString().padStart(2, '0')
  const min = date.getUTCMinutes().toString().padStart(2, '0')
  return `${m} ${d}, ${h}:${min}`
}

interface SystemHealthViewProps {
  metrics: DashboardMetrics
  jobs: RecentJob[]
  onRetry: (jobId: string) => void
}

export function SystemHealthView({ metrics, jobs, onRetry }: SystemHealthViewProps) {
  return (
    <div className="flex flex-col gap-8 p-6">
      {/* System Metrics */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
          System Metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Embeddings */}
          <div className="flex flex-col gap-3 rounded border border-kiuli-gray/60 bg-white p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-kiuli-teal" />
              <span className="text-sm font-semibold text-kiuli-charcoal">Embeddings</span>
            </div>
            <div className="text-2xl font-bold text-kiuli-charcoal">
              {metrics.embeddings.total}
            </div>
            <div className="flex flex-col gap-1">
              {metrics.embeddings.groups.map((g) => (
                <div
                  key={g.type}
                  className="flex items-center justify-between text-xs text-kiuli-charcoal/60"
                >
                  <span>{g.type}</span>
                  <span className="font-medium text-kiuli-charcoal">{g.count}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-kiuli-charcoal/40">
              Last updated: {formatDate(metrics.embeddings.lastUpdated)}
            </div>
          </div>

          {/* Stale Projects */}
          <div className="flex flex-col gap-3 rounded border border-kiuli-gray/60 bg-white p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-kiuli-charcoal">Stale Projects</span>
            </div>
            <div className="text-2xl font-bold text-kiuli-charcoal">
              {metrics.staleProjects.total}
            </div>
            <div className="flex flex-col gap-1">
              {metrics.staleProjects.breakdown.map((b) => (
                <div
                  key={b.stage}
                  className="flex items-center justify-between text-xs text-kiuli-charcoal/60"
                >
                  <span>{stageLabels[b.stage as Stage] || b.stage}</span>
                  <span className="font-medium text-kiuli-charcoal">{b.count}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-kiuli-charcoal/40">Not advanced in 7+ days</div>
          </div>

          {/* Failed Operations */}
          <div className="flex flex-col gap-3 rounded border border-kiuli-gray/60 bg-white p-4">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-kiuli-charcoal">Failed Operations</span>
            </div>
            <div className="text-2xl font-bold text-kiuli-charcoal">
              {metrics.failedOperations}
            </div>
            <div className="text-xs text-kiuli-charcoal/60">
              Projects with failed processing status
            </div>
          </div>

          {/* Directives */}
          <div className="flex flex-col gap-3 rounded border border-kiuli-gray/60 bg-white p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-kiuli-teal" />
              <span className="text-sm font-semibold text-kiuli-charcoal">Directives</span>
            </div>
            <div className="text-2xl font-bold text-kiuli-charcoal">
              {metrics.directives.totalActive}
              <span className="ml-1 text-sm font-normal text-kiuli-charcoal/50">active</span>
            </div>
            <div className="flex flex-col gap-1">
              {metrics.directives.pastReviewDate > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{metrics.directives.pastReviewDate} past review date</span>
                </div>
              )}
              {metrics.directives.zeroFilterHits > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-kiuli-charcoal/60">
                  <span>{metrics.directives.zeroFilterHits} with 0 filter hits</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Jobs */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
          Recent Jobs
        </h2>
        <div className="overflow-x-auto rounded border border-kiuli-gray/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kiuli-gray/60 bg-kiuli-ivory/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Itinerary
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Duration
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Error
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-kiuli-charcoal/50">
                    No recent jobs.
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-kiuli-gray/40 last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="rounded bg-kiuli-ivory px-2 py-0.5 text-xs font-medium capitalize text-kiuli-charcoal">
                      {job.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${statusDotColors[job.status] || 'bg-gray-400'}`}
                      />
                      <span className="text-xs text-kiuli-charcoal/70">
                        {statusLabels[job.status] || job.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-kiuli-charcoal">{job.itinerary}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-kiuli-charcoal/60">
                    {job.duration}
                  </td>
                  <td className="max-w-xs px-4 py-2.5">
                    {job.error ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help truncate text-xs text-red-600">
                              {job.error.length > 40
                                ? job.error.slice(0, 40) + '...'
                                : job.error}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-sm rounded border border-kiuli-gray bg-white text-xs text-kiuli-charcoal"
                          >
                            {job.error}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-xs text-kiuli-charcoal/30">{'--'}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {job.status === 'failed' && (
                      <button
                        onClick={() => onRetry(job.id)}
                        className="inline-flex items-center gap-1 rounded bg-kiuli-clay/10 px-2 py-1 text-xs font-medium text-kiuli-clay transition-colors hover:bg-kiuli-clay/20"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
