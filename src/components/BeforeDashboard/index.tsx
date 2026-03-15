'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface TargetSummary {
  total: number
  primary: number
  secondary: number
  byStatus: Record<string, number>
  setA: number
  setB: number
}

interface PipelineJob {
  id: string
  status: string
  itineraryTitle?: string
  itineraryDbId?: number | null
  createdAt: string
}

interface ContentSummary {
  byStage: Record<string, number>
  total: number
}

interface ItinerarySummary {
  total: number
  published: number
  draft: number
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  building: 'Building in iTrvl',
  ready_to_scrape: 'Ready to Scrape',
  scraped: 'Scraped',
  enhancing: 'Enhancing',
  in_review: 'In Review',
  published: 'Published',
}

const STATUS_COLORS: Record<string, string> = {
  not_started: '#DADADA',
  building: '#E8B86D',
  ready_to_scrape: '#5B7A8A',
  scraped: '#486A6A',
  enhancing: '#DA7A5A',
  in_review: '#8B6DB8',
  published: '#4A8B6A',
}

const BeforeDashboard: React.FC = () => {
  const [targets, setTargets] = useState<TargetSummary | null>(null)
  const [jobs, setJobs] = useState<PipelineJob[]>([])
  const [content, setContent] = useState<ContentSummary | null>(null)
  const [itineraries, setItineraries] = useState<ItinerarySummary | null>(null)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [targetsRes, jobsRes, contentRes, itinerariesRes] = await Promise.allSettled([
        fetch('/api/itinerary-targets?limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/itinerary-jobs?limit=5&sort=-createdAt&depth=1', { credentials: 'include' }),
        fetch('/api/content/dashboard', {
          credentials: 'include',
        }).catch(() => null),
        fetch('/api/itineraries?limit=0&depth=0&draft=true', { credentials: 'include' }),
      ])

      // Parse targets
      if (targetsRes.status === 'fulfilled' && targetsRes.value?.ok) {
        const data = await targetsRes.value.json()
        const docs = data.docs || []
        const byStatus: Record<string, number> = {}
        let primary = 0, secondary = 0, setA = 0, setB = 0
        for (const doc of docs) {
          byStatus[doc.status] = (byStatus[doc.status] || 0) + 1
          if (doc.priority === 'primary') primary++
          else secondary++
          if (doc.set === 'A') setA++
          else setB++
        }
        setTargets({ total: docs.length, primary, secondary, byStatus, setA, setB })
      }

      // Parse jobs — include itinerary link if available
      if (jobsRes.status === 'fulfilled' && jobsRes.value?.ok) {
        const data = await jobsRes.value.json()
        setJobs((data.docs || []).map((j: any) => ({
          id: j.id,
          status: j.status || 'unknown',
          itineraryTitle: j.itineraryTitle || (typeof j.processedItinerary === 'object' && j.processedItinerary?.title) || j.itineraryId?.replace(/^https?:\/\/[^/]+\//, '').slice(0, 40) || j.itrvlUrl?.replace(/^https?:\/\/[^/]+\//, '').slice(0, 40) || 'Untitled',
          itineraryDbId: typeof j.processedItinerary === 'object' ? j.processedItinerary?.id : (typeof j.processedItinerary === 'number' ? j.processedItinerary : null),
          createdAt: j.createdAt,
        })))
      }

      // Parse content
      if (contentRes.status === 'fulfilled' && contentRes.value?.ok) {
        const data = await contentRes.value.json()
        const stages = data.stageCounts || data.stages
        if (stages) {
          const byStage: Record<string, number> = {}
          let total = 0
          for (const [stage, count] of Object.entries(stages)) {
            byStage[stage] = count as number
            total += count as number
          }
          setContent({ byStage, total })
        }
      }

      // Parse itineraries
      if (itinerariesRes.status === 'fulfilled' && itinerariesRes.value?.ok) {
        const data = await itinerariesRes.value.json()
        const docs = data.docs || []
        let published = 0, draft = 0
        for (const doc of docs) {
          if (doc._status === 'published') published++
          else draft++
        }
        setItineraries({ total: docs.length, published, draft })
      }
    } catch (err) {
      console.error('Dashboard data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return
    setScraping(true)
    setScrapeResult(null)
    try {
      const res = await fetch('/api/scrape-itinerary', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setScrapeResult({ success: true, message: `Import started — Job #${data.jobId || data.id || 'created'}` })
        setScrapeUrl('')
        // Refresh jobs after a short delay
        setTimeout(fetchDashboardData, 2000)
      } else {
        setScrapeResult({ success: false, message: data.error || 'Import failed' })
      }
    } catch (err) {
      setScrapeResult({ success: false, message: 'Network error' })
    } finally {
      setScraping(false)
    }
  }

  // Calculate target progress
  const completedTargets = targets ? (targets.byStatus.published || 0) + (targets.byStatus.in_review || 0) + (targets.byStatus.enhancing || 0) + (targets.byStatus.scraped || 0) : 0
  const inProgressTargets = targets ? (targets.byStatus.building || 0) + (targets.byStatus.ready_to_scrape || 0) : 0
  const notStartedTargets = targets ? (targets.byStatus.not_started || 0) : 0

  return (
    <div style={{
      padding: '0 1rem 1.5rem',
      fontFamily: "'Satoshi', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #E5E2DB',
      }}>
        <div>
          <h2 style={{
            fontFamily: "'General Sans', system-ui, sans-serif",
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#2d2d2d',
            margin: 0,
          }}>
            Workspace
          </h2>
          <p style={{ color: '#888', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            href="/admin/content-engine"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#DA7A5A',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.2s',
            }}
          >
            Content Engine
          </Link>
          <Link
            href="/admin/image-library"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#5B7A8A',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.2s',
            }}
          >
            Image Library
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Loading workspace...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* === ITINERARY TARGETS === */}
          <div style={{
            gridColumn: '1 / -1',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #E5E2DB',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: '#2d2d2d',
                margin: 0,
              }}>
                Itinerary Targets
              </h3>
              <Link
                href="/admin/collections/itinerary-targets"
                style={{ fontSize: '0.75rem', color: '#486A6A', textDecoration: 'none', fontWeight: 500 }}
              >
                View all →
              </Link>
            </div>

            {/* Progress bar */}
            {targets && (
              <>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.8125rem',
                  color: '#666',
                }}>
                  <span><strong style={{ color: '#4A8B6A' }}>{completedTargets}</strong> processed</span>
                  <span>·</span>
                  <span><strong style={{ color: '#E8B86D' }}>{inProgressTargets}</strong> in progress</span>
                  <span>·</span>
                  <span><strong style={{ color: '#DADADA' }}>{notStartedTargets}</strong> not started</span>
                  <span>·</span>
                  <span>{targets.primary} primary, {targets.secondary} secondary</span>
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#F0EDE6',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  display: 'flex',
                }}>
                  {completedTargets > 0 && (
                    <div style={{
                      width: `${(completedTargets / targets.total) * 100}%`,
                      backgroundColor: '#4A8B6A',
                      transition: 'width 0.3s',
                    }} />
                  )}
                  {inProgressTargets > 0 && (
                    <div style={{
                      width: `${(inProgressTargets / targets.total) * 100}%`,
                      backgroundColor: '#E8B86D',
                      transition: 'width 0.3s',
                    }} />
                  )}
                </div>

                {/* Status breakdown */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                }}>
                  {Object.entries(targets.byStatus)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([status, count]) => (
                      <span
                        key={status}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.25rem 0.625rem',
                          backgroundColor: '#F9F8F5',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          color: '#555',
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[status] || '#ccc',
                        }} />
                        {STATUS_LABELS[status] || status}: {count as number}
                      </span>
                    ))}
                </div>
              </>
            )}
          </div>

          {/* === IMPORT ITINERARY === */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #E5E2DB',
            padding: '1.25rem',
          }}>
            <h3 style={{
              fontFamily: "'General Sans', system-ui, sans-serif",
              fontSize: '1rem',
              fontWeight: 600,
              color: '#2d2d2d',
              margin: '0 0 0.75rem',
            }}>
              Import from iTrvl
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="Paste iTrvl URL..."
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #DADADA',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              />
              <button
                onClick={handleScrape}
                disabled={scraping || !scrapeUrl.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: scraping ? '#888' : '#486A6A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: scraping ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {scraping ? 'Importing...' : 'Import'}
              </button>
            </div>
            {scrapeResult && (
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: scrapeResult.success ? '#4A8B6A' : '#c44',
              }}>
                {scrapeResult.message}
              </p>
            )}

            {/* Recent jobs */}
            {jobs.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.6875rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 0.5rem' }}>
                  Recent Imports
                </p>
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.375rem 0',
                      borderBottom: '1px solid #F0EDE6',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Link
                        href={job.itineraryDbId
                          ? `/admin/collections/itineraries/${job.itineraryDbId}`
                          : `/admin/collections/itinerary-jobs/${job.id}`}
                        style={{ color: '#486A6A', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {job.itineraryTitle}
                      </Link>
                      {job.itineraryDbId && (
                        <Link
                          href={`/admin/collections/itinerary-jobs/${job.id}`}
                          style={{ color: '#888', textDecoration: 'none', fontSize: '0.625rem' }}
                          title="View import job"
                        >
                          (job)
                        </Link>
                      )}
                    </span>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      backgroundColor: (job.status === 'complete' || job.status === 'completed') ? '#E8F5E9' : job.status === 'failed' ? '#FDECEA' : '#FFF3E0',
                      color: (job.status === 'complete' || job.status === 'completed') ? '#2E7D32' : job.status === 'failed' ? '#C62828' : '#E65100',
                    }}>
                      {job.status === 'complete' ? 'completed' : job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === ITINERARY STATUS === */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #E5E2DB',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: '#2d2d2d',
                margin: 0,
              }}>
                Itineraries
              </h3>
              <Link
                href="/admin/itinerary-editor"
                style={{ fontSize: '0.75rem', color: '#486A6A', textDecoration: 'none', fontWeight: 500 }}
              >
                Editor →
              </Link>
            </div>
            {itineraries && (
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2d2d2d', fontFamily: "'General Sans', system-ui, sans-serif" }}>
                    {itineraries.total}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Total</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4A8B6A', fontFamily: "'General Sans', system-ui, sans-serif" }}>
                    {itineraries.published}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Published</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E8B86D', fontFamily: "'General Sans', system-ui, sans-serif" }}>
                    {itineraries.draft}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Draft</div>
                </div>
              </div>
            )}
          </div>

          {/* === CONTENT ENGINE === */}
          {content && (
            <div style={{
              gridColumn: '1 / -1',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #E5E2DB',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{
                  fontFamily: "'General Sans', system-ui, sans-serif",
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#2d2d2d',
                  margin: 0,
                }}>
                  Content Pipeline
                </h3>
                <Link
                  href="/admin/content-engine"
                  style={{ fontSize: '0.75rem', color: '#486A6A', textDecoration: 'none', fontWeight: 500 }}
                >
                  Open Engine →
                </Link>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {Object.entries(content.byStage).map(([stage, count]) => (
                  <div key={stage} style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#F9F8F5',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '80px',
                  }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2d2d2d', fontFamily: "'General Sans', system-ui, sans-serif" }}>
                      {count as number}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#888', textTransform: 'capitalize' }}>
                      {stage}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === QUICK LINKS === */}
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Itinerary Editor', href: '/admin/itinerary-editor', color: '#486A6A' },
              { label: 'Destinations', href: '/admin/collections/destinations', color: '#486A6A' },
              { label: 'Properties', href: '/admin/collections/properties', color: '#486A6A' },
              { label: 'Articles', href: '/admin/collections/posts', color: '#486A6A' },
              { label: 'Pages', href: '/admin/collections/pages', color: '#486A6A' },
              { label: 'Inquiries', href: '/admin/collections/inquiries', color: '#DA7A5A' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #E5E2DB',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: link.color,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: '#fff',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BeforeDashboard
