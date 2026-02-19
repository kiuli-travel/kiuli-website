'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, Search, X, Sparkles, Camera, ExternalLink } from 'lucide-react'
import {
  searchImages,
  selectHeroImage,
  removeHeroImage,
  generateImagePrompts,
  generateAndSaveImage,
} from '@/app/(payload)/admin/image-library/actions'
import type { LibraryMatch, GeneratableImageType, PhotographicPrompt } from '../../../../content-system/images/types'

const COUNTRIES = ['Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa', 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda', 'Mozambique']
const IMAGE_TYPES = ['wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail']

const inputClass = 'rounded border border-kiuli-gray bg-white px-2.5 py-1.5 text-xs text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal'

interface ImageLibraryPickerProps {
  projectId: number
  selectedId?: number | null
  selectedImgixUrl?: string | null
  selectedAlt?: string | null
  defaultCountry?: string
  defaultSpecies?: string[]
  defaultDestinations?: string[]
  onHeroChanged?: () => void
}

export function ImageLibraryPicker({
  projectId,
  selectedId,
  selectedImgixUrl,
  selectedAlt,
  defaultCountry,
  defaultSpecies,
  defaultDestinations: _defaultDestinations,
  onHeroChanged,
}: ImageLibraryPickerProps) {
  const [matches, setMatches] = useState<LibraryMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState(defaultCountry || '')
  const [imageType, setImageType] = useState('')
  const [heroOnly, setHeroOnly] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)

  // Local hero state for immediate feedback
  const [currentHeroId, setCurrentHeroId] = useState<number | null>(selectedId ?? null)
  const [currentHeroUrl, setCurrentHeroUrl] = useState<string | null>(selectedImgixUrl ?? null)
  const [currentHeroAlt, setCurrentHeroAlt] = useState<string | null>(selectedAlt ?? null)
  const [toast, setToast] = useState<string | null>(null)

  const doSearch = useCallback(async () => {
    setLoading(true)
    const result = await searchImages({
      country: country || undefined,
      imageType: imageType || undefined,
      isHero: heroOnly || undefined,
      query: query || undefined,
      species: defaultSpecies?.length ? defaultSpecies : undefined,
      limit: 24,
    })
    setLoading(false)
    if ('result' in result) {
      setMatches(result.result.matches)
    }
  }, [country, imageType, heroOnly, query, defaultSpecies])

  useEffect(() => {
    doSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(async (match: LibraryMatch) => {
    const result = await selectHeroImage(projectId, match.mediaId)
    if ('success' in result) {
      setCurrentHeroId(match.mediaId)
      setCurrentHeroUrl(match.imgixUrl)
      setCurrentHeroAlt(match.alt)
      setToast('Hero image saved')
      setTimeout(() => setToast(null), 2500)
      onHeroChanged?.()
    } else {
      alert(result.error)
    }
  }, [projectId, onHeroChanged])

  const handleRemoveHero = useCallback(async () => {
    const result = await removeHeroImage(projectId)
    if ('success' in result) {
      setCurrentHeroId(null)
      setCurrentHeroUrl(null)
      setCurrentHeroAlt(null)
      setToast('Hero image removed')
      setTimeout(() => setToast(null), 2500)
      onHeroChanged?.()
    } else {
      alert(result.error)
    }
  }, [projectId, onHeroChanged])

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Toast */}
      {toast && (
        <div className="rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700">
          {toast}
        </div>
      )}

      {/* Current hero image */}
      {currentHeroId && (
        <div className="rounded border border-kiuli-teal/30 bg-kiuli-teal/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-teal">Current Hero Image</span>
            <button onClick={handleRemoveHero} className="text-[10px] text-red-500 hover:underline">Remove</button>
          </div>
          {currentHeroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${currentHeroUrl.split('?')[0]}?w=600&h=300&fit=crop&auto=format`}
              alt={currentHeroAlt || 'Hero image'}
              className="w-full rounded"
            />
          )}
          {currentHeroAlt && <p className="mt-1.5 text-xs text-kiuli-charcoal/60">{currentHeroAlt}</p>}
        </div>
      )}

      {/* Compact filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Country</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={inputClass} value={imageType} onChange={(e) => setImageType(e.target.value)}>
          <option value="">Type</option>
          {IMAGE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-kiuli-charcoal">
          <input type="checkbox" checked={heroOnly} onChange={(e) => setHeroOnly(e.target.checked)} className="rounded" />
          Hero
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-kiuli-charcoal/40" />
          <input
            className={`${inputClass} w-full pl-7`}
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          />
        </div>
        <button onClick={doSearch} className="rounded bg-kiuli-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-kiuli-teal/90">
          Search
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <a href="/admin/image-library" target="_blank" className="flex items-center gap-1 text-xs text-kiuli-clay hover:underline">
          <ExternalLink className="h-3 w-3" /> Open Full Library
        </a>
        <button
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-1 rounded bg-kiuli-clay px-3 py-1.5 text-xs font-medium text-white hover:bg-kiuli-clay/90"
        >
          <Sparkles className="h-3 w-3" /> Generate New
        </button>
      </div>

      {/* Image grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-kiuli-teal" />
        </div>
      ) : matches.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-xs text-kiuli-charcoal/40">
          No images found. Adjust filters or generate new ones.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {matches.map((match) => (
            <button
              key={match.mediaId}
              onClick={() => handleSelect(match)}
              className={`group relative overflow-hidden rounded border transition-all ${
                match.mediaId === currentHeroId
                  ? 'border-kiuli-teal ring-2 ring-kiuli-teal/30'
                  : 'border-kiuli-gray/40 hover:border-kiuli-teal/50'
              }`}
            >
              {match.imgixUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${match.imgixUrl.split('?')[0]}?w=250&h=180&fit=crop&auto=format`}
                  alt={match.alt}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-kiuli-gray/20 text-[10px] text-kiuli-charcoal/30">
                  No preview
                </div>
              )}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="line-clamp-1 text-[10px] text-white">{match.alt}</span>
              </div>
              <div className="absolute right-1 top-1">
                {match.source === 'generated' ? (
                  <Sparkles className="h-2.5 w-2.5 text-amber-400 drop-shadow" />
                ) : (
                  <Camera className="h-2.5 w-2.5 text-white drop-shadow" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Simple generation modal */}
      {showGenModal && (
        <CompactGenerationModal
          defaultCountry={defaultCountry}
          defaultSpecies={defaultSpecies}
          onClose={() => setShowGenModal(false)}
          onGenerated={() => {
            setShowGenModal(false)
            doSearch()
          }}
        />
      )}
    </div>
  )
}

// ── Compact Generation Modal ─────────────────────────────────────────────────

function CompactGenerationModal({ defaultCountry, defaultSpecies, onClose, onGenerated }: {
  defaultCountry?: string
  defaultSpecies?: string[]
  onClose: () => void
  onGenerated: () => void
}) {
  const [genType, setGenType] = useState<GeneratableImageType>('wildlife')
  const [species, setSpecies] = useState(defaultSpecies?.[0] || '')
  const [country, setCountry] = useState(defaultCountry || '')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [prompts, setPrompts] = useState<PhotographicPrompt[]>([])

  const handleGenPrompts = useCallback(async () => {
    setGenerating(true)
    const result = await generateImagePrompts({
      type: genType,
      species: species || undefined,
      country: country || undefined,
      description: description || undefined,
    }, 3)
    setGenerating(false)
    if ('prompts' in result) setPrompts(result.prompts)
    else alert(result.error)
  }, [genType, species, country, description])

  const handleGenImage = useCallback(async (prompt: PhotographicPrompt) => {
    setGenerating(true)
    const result = await generateAndSaveImage(prompt.prompt, {
      type: genType,
      species: species ? [species] : undefined,
      country: country || undefined,
      aspectRatio: prompt.aspectRatio,
    })
    setGenerating(false)
    if ('mediaId' in result) {
      onGenerated()
    } else {
      alert(result.error)
    }
  }, [genType, species, country, onGenerated])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="max-h-[80vh] w-[500px] overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-kiuli-charcoal">Generate Image</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-kiuli-charcoal/50" /></button>
        </div>

        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
          Only wildlife, landscapes, destinations, and country images can be generated.
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            {(['wildlife', 'landscape', 'destination', 'country'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setGenType(t)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize ${genType === t ? 'bg-kiuli-teal text-white' : 'bg-kiuli-gray/20 text-kiuli-charcoal'}`}
              >{t}</button>
            ))}
          </div>

          {genType === 'wildlife' && (
            <input className={inputClass} value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Species" />
          )}
          <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <textarea
            className={`${inputClass} min-h-[50px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scene description (optional)"
            rows={2}
          />

          <button onClick={handleGenPrompts} disabled={generating} className="rounded bg-kiuli-teal px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
            {generating ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Generate Prompts'}
          </button>
        </div>

        {prompts.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {prompts.map((p, i) => (
              <div key={i} className="rounded border border-kiuli-gray/60 p-3">
                <p className="line-clamp-3 text-[11px] text-kiuli-charcoal">{p.prompt}</p>
                <p className="mt-1 text-[10px] text-kiuli-charcoal/50">{p.cameraSpec} | {p.aspectRatio}</p>
                <button
                  onClick={() => handleGenImage(p)}
                  disabled={generating}
                  className="mt-2 rounded bg-kiuli-clay px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                >
                  {generating ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Generate & Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
