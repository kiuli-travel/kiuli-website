'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, Search, X, Camera, Sparkles, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { searchImages, generateImagePrompts, generateAndSaveImage } from './actions'
import type { LibraryMatch, LibrarySearchResult, PhotographicPrompt, GeneratableImageType } from '../../../../../content-system/images/types'

// ── Kiuli brand ──────────────────────────────────────────────────────────────

const COUNTRIES = ['Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa', 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda', 'Mozambique']
const IMAGE_TYPES = ['wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail']
const MOODS = ['serene', 'adventurous', 'romantic', 'dramatic', 'intimate', 'luxurious', 'wild', 'peaceful']
const COMPOSITIONS = ['hero', 'establishing', 'detail', 'portrait', 'action', 'panoramic']
const _SUITABLE_FOR = ['hero-banner', 'article-feature', 'gallery', 'thumbnail', 'social', 'print']
const TIME_OF_DAY = ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'dusk', 'night']

// ── Styles ───────────────────────────────────────────────────────────────────

const btnPrimary = 'rounded bg-kiuli-clay px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40'
const btnSecondary = 'rounded bg-kiuli-teal px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-kiuli-teal/90 disabled:opacity-40'
const inputClass = 'w-full rounded border border-kiuli-gray bg-white px-3 py-1.5 text-sm text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal'

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ImageLibraryPage() {
  const [matches, setMatches] = useState<LibraryMatch[]>([])
  const [total, setTotal] = useState(0)
  const [_facets, setFacets] = useState<LibrarySearchResult['facets'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<LibraryMatch | null>(null)
  const [showGenPanel, setShowGenPanel] = useState(false)
  const [query, setQuery] = useState('')

  // Filters
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedCompositions, setSelectedCompositions] = useState<string[]>([])
  const [heroOnly, setHeroOnly] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'scraped' | 'generated'>('all')

  const doSearch = useCallback(async () => {
    setLoading(true)
    const result = await searchImages({
      country: selectedCountries.length > 0 ? selectedCountries : undefined,
      imageType: selectedTypes.length > 0 ? selectedTypes : undefined,
      mood: selectedMoods.length > 0 ? selectedMoods : undefined,
      composition: selectedCompositions.length > 0 ? selectedCompositions : undefined,
      isHero: heroOnly || undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
      query: query || undefined,
      limit: 60,
    })
    setLoading(false)
    if ('result' in result) {
      setMatches(result.result.matches)
      setTotal(result.result.total)
      setFacets(result.result.facets)
    }
  }, [selectedCountries, selectedTypes, selectedMoods, selectedCompositions, heroOnly, sourceFilter, query])

  useEffect(() => {
    doSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = useCallback(() => {
    setSelectedCountries([])
    setSelectedTypes([])
    setSelectedMoods([])
    setSelectedCompositions([])
    setHeroOnly(false)
    setSourceFilter('all')
    setQuery('')
  }, [])

  const activeFilterCount = selectedCountries.length + selectedTypes.length + selectedMoods.length + selectedCompositions.length + (heroOnly ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0) + (query ? 1 : 0)

  return (
    <div className="kiuli-view flex h-screen bg-white">
      {/* Left Sidebar — Filters */}
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-kiuli-gray/60 bg-kiuli-ivory/30">
        <div className="flex items-center justify-between border-b border-kiuli-gray/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-kiuli-charcoal">Filters</h2>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-kiuli-clay hover:underline">
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>

        <FilterSection title="Country" options={COUNTRIES} selected={selectedCountries} onChange={setSelectedCountries} />
        <FilterSection title="Image Type" options={IMAGE_TYPES} selected={selectedTypes} onChange={setSelectedTypes} />
        <FilterSection title="Mood" options={MOODS} selected={selectedMoods} onChange={setSelectedMoods} />
        <FilterSection title="Composition" options={COMPOSITIONS} selected={selectedCompositions} onChange={setSelectedCompositions} />

        {/* Hero toggle */}
        <div className="border-b border-kiuli-gray/30 px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-kiuli-charcoal">
            <input type="checkbox" checked={heroOnly} onChange={(e) => setHeroOnly(e.target.checked)} className="rounded" />
            Hero Only
          </label>
        </div>

        {/* Source filter */}
        <div className="border-b border-kiuli-gray/30 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Source</p>
          {(['all', 'scraped', 'generated'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 py-0.5 text-xs text-kiuli-charcoal">
              <input type="radio" name="source" checked={sourceFilter === val} onChange={() => setSourceFilter(val)} />
              {val === 'all' ? 'All' : val === 'scraped' ? 'Scraped' : 'Generated'}
            </label>
          ))}
        </div>

        <div className="p-4">
          <button onClick={doSearch} className={`${btnSecondary} w-full`}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-3 border-b border-kiuli-gray/60 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kiuli-charcoal/40" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search tags, scenes, alt text..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            />
          </div>
          <span className="shrink-0 text-xs text-kiuli-charcoal/50">{total} images</span>
          <button onClick={() => setShowGenPanel(true)} className={btnPrimary}>
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Generate
          </button>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-kiuli-gray/30 px-4 py-2">
            {selectedCountries.map((c) => (
              <FilterPill key={c} label={c} onRemove={() => setSelectedCountries((prev) => prev.filter((x) => x !== c))} />
            ))}
            {selectedTypes.map((t) => (
              <FilterPill key={t} label={t} onRemove={() => setSelectedTypes((prev) => prev.filter((x) => x !== t))} />
            ))}
            {selectedMoods.map((m) => (
              <FilterPill key={m} label={m} onRemove={() => setSelectedMoods((prev) => prev.filter((x) => x !== m))} />
            ))}
            {heroOnly && <FilterPill label="Hero Only" onRemove={() => setHeroOnly(false)} />}
            {sourceFilter !== 'all' && <FilterPill label={sourceFilter} onRemove={() => setSourceFilter('all')} />}
            {query && <FilterPill label={`"${query}"`} onRemove={() => setQuery('')} />}
          </div>
        )}

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-kiuli-teal" />
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-sm text-kiuli-charcoal/40">
              <p>No images found.</p>
              <p className="mt-1 text-xs">Adjust filters or generate new images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {matches.map((match) => (
                <ImageCard key={match.mediaId} match={match} onClick={() => setSelectedImage(match)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Panel */}
      {selectedImage && (
        <ImageDetailPanel image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}

      {/* Generation Panel */}
      {showGenPanel && (
        <GenerationPanel onClose={() => setShowGenPanel(false)} onGenerated={doSearch} />
      )}
    </div>
  )
}

// ── Filter Section ───────────────────────────────────────────────────────────

function FilterSection({ title, options, selected, onChange }: {
  title: string
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-kiuli-gray/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">
          {title} {selected.length > 0 && `(${selected.length})`}
        </span>
        {expanded ? <ChevronDown className="h-3 w-3 text-kiuli-charcoal/40" /> : <ChevronRight className="h-3 w-3 text-kiuli-charcoal/40" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 py-0.5 text-xs capitalize text-kiuli-charcoal">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt])
                  else onChange(selected.filter((x) => x !== opt))
                }}
                className="rounded"
              />
              {opt.replace(/-/g, ' ')}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-kiuli-teal/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-kiuli-teal">
      {label.replace(/-/g, ' ')}
      <button onClick={onRemove} className="hover:text-kiuli-clay">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ── Image Card ───────────────────────────────────────────────────────────────

function ImageCard({ match, onClick }: { match: LibraryMatch; onClick: () => void }) {
  const imgSrc = match.imgixUrl
    ? `${match.imgixUrl.split('?')[0]}?w=400&h=300&fit=crop&auto=format`
    : match.thumbnailUrl || ''

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded border border-kiuli-gray/40 bg-kiuli-ivory/30 transition-shadow hover:shadow-md"
    >
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={match.alt}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-kiuli-gray/20 text-xs text-kiuli-charcoal/30">
          No preview
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-2 text-[10px] leading-tight text-white">{match.alt}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {match.country && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] text-white">{match.country}</span>
          )}
          {match.imageType && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] capitalize text-white">{match.imageType}</span>
          )}
        </div>
      </div>

      {/* Source indicator */}
      <div className="absolute right-1.5 top-1.5">
        {match.source === 'generated' ? (
          <Sparkles className="h-3 w-3 text-amber-400 drop-shadow" />
        ) : (
          <Camera className="h-3 w-3 text-white drop-shadow" />
        )}
      </div>
    </button>
  )
}

// ── Image Detail Panel ───────────────────────────────────────────────────────

function ImageDetailPanel({ image, onClose }: { image: LibraryMatch; onClose: () => void }) {
  const previewUrl = image.imgixUrl
    ? `${image.imgixUrl.split('?')[0]}?w=800&auto=format`
    : image.url

  return (
    <div className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-kiuli-gray/60 bg-white">
      <div className="flex items-center justify-between border-b border-kiuli-gray/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Image Detail</h3>
        <button onClick={onClose} className="text-kiuli-charcoal/50 hover:text-kiuli-charcoal">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview */}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={image.alt} className="w-full border-b border-kiuli-gray/30" />
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Alt text */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Alt Text</span>
          <p className="mt-0.5 text-sm text-kiuli-charcoal">{image.altText || image.alt}</p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2">
          {image.country && <MetaField label="Country" value={image.country} />}
          {image.imageType && <MetaField label="Type" value={image.imageType} />}
          {image.composition && <MetaField label="Composition" value={image.composition} />}
          {image.quality && <MetaField label="Quality" value={image.quality} />}
          {image.timeOfDay && <MetaField label="Time" value={image.timeOfDay.replace(/-/g, ' ')} />}
          <MetaField label="Source" value={image.source} />
          {image.width && image.height && <MetaField label="Size" value={`${image.width}×${image.height}`} />}
          <MetaField label="Hero" value={image.isHero ? 'Yes' : 'No'} />
        </div>

        {/* Scene */}
        {image.scene && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Scene</span>
            <p className="mt-0.5 text-sm text-kiuli-charcoal">{image.scene}</p>
          </div>
        )}

        {/* Animals */}
        {image.animals.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Animals</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {image.animals.map((a, i) => (
                <span key={i} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium capitalize text-emerald-700">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Mood */}
        {image.mood.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Mood</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {image.mood.map((m, i) => (
                <span key={i} className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium capitalize text-purple-700">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {image.tags.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Tags</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {image.tags.map((t, i) => (
                <span key={i} className="rounded-full bg-kiuli-gray/30 px-2 py-0.5 text-[10px] text-kiuli-charcoal/70">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Property */}
        {image.sourceProperty && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Property</span>
            <p className="mt-0.5 text-sm text-kiuli-teal">{image.sourceProperty}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-kiuli-gray/30 pt-3">
          {image.imgixUrl && (
            <button
              onClick={() => navigator.clipboard.writeText(image.imgixUrl!)}
              className="flex items-center gap-2 rounded bg-kiuli-gray/20 px-3 py-1.5 text-xs text-kiuli-charcoal hover:bg-kiuli-gray/30"
            >
              <Copy className="h-3 w-3" /> Copy imgix URL
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-medium uppercase text-kiuli-charcoal/40">{label}</span>
      <p className="text-xs capitalize text-kiuli-charcoal">{value.replace(/-/g, ' ')}</p>
    </div>
  )
}

// ── Generation Panel ─────────────────────────────────────────────────────────

function GenerationPanel({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const [genType, setGenType] = useState<GeneratableImageType>('wildlife')
  const [species, setSpecies] = useState('')
  const [destination, setDestination] = useState('')
  const [country, setCountry] = useState('')
  const [mood, setMood] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')

  const [prompts, setPrompts] = useState<PhotographicPrompt[]>([])
  const [generatingPrompts, setGeneratingPrompts] = useState(false)
  const [generatingImage, setGeneratingImage] = useState<number | null>(null)
  const [results, setResults] = useState<Array<{ prompt: string; mediaId?: number; imgixUrl?: string; error?: string }>>([])

  const handleGeneratePrompts = useCallback(async () => {
    setGeneratingPrompts(true)
    setPrompts([])
    setResults([])
    const result = await generateImagePrompts({
      type: genType,
      species: species || undefined,
      destination: destination || undefined,
      country: country || undefined,
      mood: mood || undefined,
      timeOfDay: timeOfDay || undefined,
    }, 3)
    setGeneratingPrompts(false)
    if ('prompts' in result) {
      setPrompts(result.prompts)
    } else {
      alert(result.error)
    }
  }, [genType, species, destination, country, mood, timeOfDay])

  const handleGenerateImage = useCallback(async (index: number) => {
    const prompt = prompts[index]
    if (!prompt) return
    setGeneratingImage(index)
    const result = await generateAndSaveImage(prompt.prompt, {
      type: genType,
      species: species ? [species] : undefined,
      country: country || undefined,
      destination: destination || undefined,
      aspectRatio: prompt.aspectRatio,
    })
    setGeneratingImage(null)
    if ('mediaId' in result) {
      setResults((prev) => [...prev, { prompt: prompt.prompt, mediaId: result.mediaId, imgixUrl: result.imgixUrl }])
      onGenerated()
    } else {
      setResults((prev) => [...prev, { prompt: prompt.prompt, error: result.error }])
    }
  }, [prompts, genType, species, country, destination, onGenerated])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex w-[600px] flex-col overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-kiuli-gray/60 px-5 py-4">
          <h3 className="text-sm font-semibold text-kiuli-charcoal">Generate Image</h3>
          <button onClick={onClose} className="text-kiuli-charcoal/50 hover:text-kiuli-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Safety notice */}
        <div className="mx-5 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Generated images are limited to wildlife, landscapes, destinations, and countries. Property and accommodation images are never generated to ensure authenticity.
        </div>

        {/* Subject selection */}
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Subject Type</p>
            <div className="flex gap-2">
              {(['wildlife', 'landscape', 'destination', 'country'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setGenType(t)}
                  className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    genType === t ? 'bg-kiuli-teal text-white' : 'bg-kiuli-gray/20 text-kiuli-charcoal hover:bg-kiuli-gray/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {genType === 'wildlife' && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Species</label>
              <input className={inputClass} value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="e.g., leopard, elephant herd" />
            </div>
          )}

          {(genType === 'landscape' || genType === 'destination') && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Destination</label>
              <input className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Serengeti, Okavango Delta" />
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Country</label>
            <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Any</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Mood (optional)</label>
              <select className={inputClass} value={mood} onChange={(e) => setMood(e.target.value)}>
                <option value="">Any</option>
                {MOODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Time of Day (optional)</label>
              <select className={inputClass} value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
                <option value="">Any</option>
                {TIME_OF_DAY.map((t) => <option key={t} value={t} className="capitalize">{t.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleGeneratePrompts} disabled={generatingPrompts} className={btnSecondary}>
            {generatingPrompts ? (
              <><Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> Generating Prompts...</>
            ) : (
              'Generate Prompts'
            )}
          </button>
        </div>

        {/* Prompts */}
        {prompts.length > 0 && (
          <div className="border-t border-kiuli-gray/30 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Photographic Prompts</p>
            <div className="flex flex-col gap-3">
              {prompts.map((p, i) => (
                <div key={i} className="rounded border border-kiuli-gray/60 bg-white p-4">
                  <p className="text-xs leading-relaxed text-kiuli-charcoal">{p.prompt}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[10px] text-kiuli-charcoal/50">{p.cameraSpec}</span>
                    <span className="text-[10px] text-kiuli-charcoal/50">{p.aspectRatio}</span>
                  </div>
                  <p className="mt-1 text-[11px] italic text-kiuli-charcoal/60">{p.intent}</p>
                  <button
                    onClick={() => handleGenerateImage(i)}
                    disabled={generatingImage !== null}
                    className={`mt-3 ${btnPrimary}`}
                  >
                    {generatingImage === i ? (
                      <><Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> Generating...</>
                    ) : (
                      'Generate Image'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="border-t border-kiuli-gray/30 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-kiuli-charcoal/50">Generated Images</p>
            <div className="flex flex-col gap-3">
              {results.map((r, i) => (
                <div key={i} className="rounded border border-kiuli-gray/60 p-3">
                  {r.imgixUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${r.imgixUrl.split('?')[0]}?w=500&auto=format`} alt="Generated" className="w-full rounded" />
                      <p className="mt-2 text-[10px] text-emerald-600">Saved to library (ID: {r.mediaId})</p>
                    </>
                  ) : (
                    <p className="text-xs text-red-600">{r.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
