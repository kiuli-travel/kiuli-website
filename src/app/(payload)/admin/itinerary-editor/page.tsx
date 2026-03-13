'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

interface Itinerary {
  id: number
  title: string
  slug: string
  _status: 'draft' | 'published'
  overview?: {
    nights?: number
    countries?: { country?: string }[]
  }
  heroImage?: { url?: string; thumbnailURL?: string } | number
  updatedAt: string
  createdAt: string
}

type StatusFilter = 'all' | 'draft' | 'published'
type SortField = 'updatedAt' | 'createdAt' | 'title' | 'nights'

export default function ItineraryEditorIndexPage() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDesc, setSortDesc] = useState(true)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchItineraries()
  }, [])

  const fetchItineraries = async () => {
    try {
      const res = await fetch(
        '/api/itineraries?limit=200&sort=-updatedAt&depth=1&draft=true',
        { credentials: 'include' }
      )
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/admin/login'
          return
        }
        throw new Error(`Failed to fetch itineraries: ${res.status}`)
      }
      const data = await res.json()
      setItineraries(data.docs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load itineraries')
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
        setTimeout(fetchItineraries, 3000)
      } else {
        setScrapeResult({ success: false, message: data.error || 'Import failed' })
      }
    } catch (err) {
      setScrapeResult({ success: false, message: 'Network error' })
    } finally {
      setScraping(false)
    }
  }

  const formatCountries = (itinerary: Itinerary): string => {
    const countries = itinerary.overview?.countries
      ?.map((c) => c.country)
      .filter(Boolean)
    return countries && countries.length > 0 ? countries.join(', ') : '—'
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const filtered = useMemo(() => {
    let result = [...itineraries]

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((i) => i._status === statusFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((i) =>
        i.title?.toLowerCase().includes(q) ||
        formatCountries(i).toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '')
          break
        case 'nights':
          cmp = (a.overview?.nights || 0) - (b.overview?.nights || 0)
          break
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updatedAt':
        default:
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
      }
      return sortDesc ? -cmp : cmp
    })

    return result
  }, [itineraries, statusFilter, search, sortField, sortDesc])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc)
    } else {
      setSortField(field)
      setSortDesc(true)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ color: '#ccc', marginLeft: '0.25rem' }}>↕</span>
    return <span style={{ marginLeft: '0.25rem' }}>{sortDesc ? '↓' : '↑'}</span>
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#888', fontFamily: "'Satoshi', system-ui, sans-serif" }}>
        Loading itineraries...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#c44', fontFamily: "'Satoshi', system-ui, sans-serif" }}>
        <strong>Error:</strong> {error}
      </div>
    )
  }

  const drafts = itineraries.filter((i) => i._status === 'draft').length
  const published = itineraries.filter((i) => i._status === 'published').length

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1100px',
      margin: '0 auto',
      fontFamily: "'Satoshi', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#2d2d2d',
            margin: 0,
            fontFamily: "'General Sans', system-ui, sans-serif",
          }}>
            Itinerary Editor
          </h1>
          <p style={{ color: '#888', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
            {itineraries.length} itineraries — {published} published, {drafts} draft
          </p>
        </div>
      </div>

      {/* Import bar */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #E5E2DB',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.8125rem', color: '#666', whiteSpace: 'nowrap', fontWeight: 500 }}>
          Import from iTrvl:
        </span>
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
            padding: '0.5rem 1.25rem',
            backgroundColor: scraping ? '#888' : '#486A6A',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: scraping ? 'wait' : 'pointer',
          }}
        >
          {scraping ? 'Importing...' : 'Import'}
        </button>
        {scrapeResult && (
          <span style={{
            fontSize: '0.75rem',
            color: scrapeResult.success ? '#4A8B6A' : '#c44',
            whiteSpace: 'nowrap',
          }}>
            {scrapeResult.message}
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1rem',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or country..."
          style={{
            flex: 1,
            maxWidth: '320px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #DADADA',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            outline: 'none',
            fontFamily: "'Satoshi', system-ui, sans-serif",
          }}
        />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {(['all', 'draft', 'published'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid',
                borderColor: statusFilter === status ? '#486A6A' : '#DADADA',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: statusFilter === status ? '#486A6A' : '#fff',
                color: statusFilter === status ? '#fff' : '#666',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {status === 'all' ? `All (${itineraries.length})` : status === 'draft' ? `Draft (${drafts})` : `Published (${published})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', padding: '2rem 0', textAlign: 'center' }}>
          {search || statusFilter !== 'all' ? 'No itineraries match your filters.' : 'No itineraries found.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E2DB' }}>
              <th
                style={{ textAlign: 'left', padding: '0.625rem 1rem 0.625rem 0', fontWeight: 600, color: '#666', cursor: 'pointer', userSelect: 'none', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                onClick={() => handleSort('title')}
              >
                Title <SortIcon field="title" />
              </th>
              <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontWeight: 600, color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Countries
              </th>
              <th
                style={{ textAlign: 'center', padding: '0.625rem 1rem', fontWeight: 600, color: '#666', cursor: 'pointer', userSelect: 'none', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                onClick={() => handleSort('nights')}
              >
                Nights <SortIcon field="nights" />
              </th>
              <th style={{ textAlign: 'center', padding: '0.625rem 1rem', fontWeight: 600, color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Status
              </th>
              <th
                style={{ textAlign: 'right', padding: '0.625rem 0 0.625rem 1rem', fontWeight: 600, color: '#666', cursor: 'pointer', userSelect: 'none', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                onClick={() => handleSort('updatedAt')}
              >
                Updated <SortIcon field="updatedAt" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((itinerary) => (
              <tr
                key={itinerary.id}
                style={{
                  borderBottom: '1px solid #F0EDE6',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FAFAF7' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <td style={{ padding: '0.75rem 1rem 0.75rem 0' }}>
                  <Link
                    href={`/admin/itinerary-editor/${itinerary.id}`}
                    style={{
                      color: '#486A6A',
                      textDecoration: 'none',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                    }}
                  >
                    {itinerary.title}
                  </Link>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#555' }}>
                  {formatCountries(itinerary)}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#555', textAlign: 'center' }}>
                  {itinerary.overview?.nights ?? '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.125rem 0.625rem',
                    borderRadius: '10px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    backgroundColor: itinerary._status === 'published' ? '#E8F5E9' : '#FFF8E1',
                    color: itinerary._status === 'published' ? '#2E7D32' : '#F57F17',
                  }}>
                    {itinerary._status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 0 0.75rem 1rem', color: '#888', textAlign: 'right', fontSize: '0.75rem' }}>
                  {formatDate(itinerary.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
