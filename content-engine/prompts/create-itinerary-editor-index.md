# Create Itinerary Editor Index Page

## Context

The itinerary editor custom admin page exists at `/admin/itinerary-editor/[id]` but there is no index page at `/admin/itinerary-editor/`. The nav link in the sidebar points to `/admin/itinerary-editor` and currently 404s. This task creates that index page.

The page must:
- Fetch all itineraries from the Payload API (both draft and published) using credentials
- Display them as a list, grouped by status (draft first, then published)
- Each row links to `/admin/itinerary-editor/[id]`
- Show: title, status badge, nights count (from `overview.nights`), and country names (from `overview.countries`)
- Match the visual style of the existing admin pages (padding, fonts, colours from the scrape page pattern)
- Be a `'use client'` component that fetches on mount

---

## Task 1 — Create the index page

Create `src/app/(payload)/admin/itinerary-editor/page.tsx` with the following implementation:

```tsx
'use client'

import React, { useState, useEffect } from 'react'
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
  updatedAt: string
}

export default function ItineraryEditorIndexPage() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        const res = await fetch(
          '/api/itineraries?limit=200&sort=-updatedAt&depth=0',
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
    fetchItineraries()
  }, [])

  const drafts = itineraries.filter((i) => i._status === 'draft')
  const published = itineraries.filter((i) => i._status === 'published')

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

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#666' }}>Loading itineraries...</div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#c00' }}>
        <strong>Error:</strong> {error}
      </div>
    )
  }

  const renderTable = (rows: Itinerary[]) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #DADADA' }}>
          <th style={{ textAlign: 'left', padding: '0.5rem 1rem 0.5rem 0', fontWeight: 600, color: '#404040' }}>Title</th>
          <th style={{ textAlign: 'left', padding: '0.5rem 1rem', fontWeight: 600, color: '#404040' }}>Countries</th>
          <th style={{ textAlign: 'left', padding: '0.5rem 1rem', fontWeight: 600, color: '#404040' }}>Nights</th>
          <th style={{ textAlign: 'left', padding: '0.5rem 0 0.5rem 1rem', fontWeight: 600, color: '#404040' }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((itinerary) => (
          <tr
            key={itinerary.id}
            style={{ borderBottom: '1px solid #DADADA' }}
          >
            <td style={{ padding: '0.75rem 1rem 0.75rem 0' }}>
              <Link
                href={`/admin/itinerary-editor/${itinerary.id}`}
                style={{ color: '#486A6A', textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
              >
                {itinerary.title}
              </Link>
            </td>
            <td style={{ padding: '0.75rem 1rem', color: '#404040' }}>
              {formatCountries(itinerary)}
            </td>
            <td style={{ padding: '0.75rem 1rem', color: '#404040' }}>
              {itinerary.overview?.nights ?? '—'}
            </td>
            <td style={{ padding: '0.75rem 0 0.75rem 1rem', color: '#666' }}>
              {formatDate(itinerary.updatedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 600, color: '#404040' }}>
        Itinerary Editor
      </h1>

      {drafts.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#404040', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#FFF3CD', color: '#856404', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}>DRAFT</span>
            {drafts.length} itinerar{drafts.length === 1 ? 'y' : 'ies'}
          </h2>
          {renderTable(drafts)}
        </section>
      )}

      {published.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#404040', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#D4EDDA', color: '#155724', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}>PUBLISHED</span>
            {published.length} itinerar{published.length === 1 ? 'y' : 'ies'}
          </h2>
          {renderTable(published)}
        </section>
      )}

      {itineraries.length === 0 && (
        <p style={{ color: '#666' }}>No itineraries found.</p>
      )}
    </div>
  )
}
```

---

## Task 2 — Build

```bash
npm run build 2>&1 | tail -20 > content-engine/evidence/itinerary-editor-index-build.txt
echo "BUILD EXIT: $?" >> content-engine/evidence/itinerary-editor-index-build.txt
cat content-engine/evidence/itinerary-editor-index-build.txt
```

Required: `BUILD EXIT: 0`. If the build fails, fix the error before proceeding. Do not proceed to commit with a failing build.

---

## Task 3 — Commit and push

```bash
git add src/app/\(payload\)/admin/itinerary-editor/page.tsx content-engine/evidence/itinerary-editor-index-build.txt
git commit -m "feat(admin): itinerary editor index page listing all itineraries"
git push origin main 2>&1
echo "PUSH EXIT: $?"
```

Required: `PUSH EXIT: 0`.

---

## Task 4 — Verify

```bash
git log --oneline -3
git status --short
```

Show the output of both commands plus the raw `BUILD EXIT` and `PUSH EXIT` values.

---

## Rules

- Do not modify any existing files. Only create `src/app/(payload)/admin/itinerary-editor/page.tsx`.
- Build must pass before commit. No exceptions.
- Do not summarise build output. Show the raw tail output and exit code.
