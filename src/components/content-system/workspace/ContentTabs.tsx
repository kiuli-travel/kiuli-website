'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  isArticleType,
  isCompoundType,
  sectionLabels,
  type WorkspaceProject,
  type ConsistencyIssueDisplay,
  type ArticleImage,
} from '../workspace-types'
import {
  saveProjectFields,
  triggerResearch,
  triggerDraft,
  saveFaqItems,
  triggerConsistencyCheck,
  resolveConsistencyIssue,
  saveArticleImages,
} from '@/app/(payload)/admin/content-engine/project/[id]/actions'

// ── Shared styles ────────────────────────────────────────────────────────────

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50'
const inputClass =
  'w-full rounded border border-kiuli-gray bg-white px-3 py-2 text-sm text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal'
const textareaClass = `${inputClass} resize-y`
const btnPrimary =
  'rounded bg-kiuli-clay px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40'
const btnSecondary =
  'rounded bg-kiuli-teal px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-kiuli-teal/90 disabled:opacity-40'
const contentArea = 'rounded border border-kiuli-gray/60 bg-kiuli-ivory/50 p-4'

// ── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdownText(text: string) {
  // Split into paragraphs by double newline
  const paragraphs = text.split(/\n{2,}/)

  return paragraphs.map((para, i) => {
    const trimmed = para.trim()
    if (!trimmed) return null

    // Headings
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={i} className="mt-4 mb-2 text-sm font-semibold text-kiuli-charcoal first:mt-0">
          {trimmed.slice(4)}
        </h4>
      )
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={i} className="mt-5 mb-2 text-sm font-bold text-kiuli-charcoal first:mt-0">
          {trimmed.slice(3)}
        </h3>
      )
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={i} className="mt-5 mb-2 text-base font-bold text-kiuli-charcoal first:mt-0">
          {trimmed.slice(2)}
        </h2>
      )
    }

    // Bullet list (lines starting with -)
    const lines = trimmed.split('\n')
    const allBullets = lines.every((l) => l.trim().startsWith('- '))
    if (allBullets && lines.length > 1) {
      return (
        <ul key={i} className="my-2 ml-4 list-disc space-y-1">
          {lines.map((line, j) => (
            <li key={j} className="text-sm leading-relaxed text-kiuli-charcoal">
              {renderInlineMarkdown(line.trim().slice(2))}
            </li>
          ))}
        </ul>
      )
    }

    // Regular paragraph — render inline markdown for bold
    return (
      <p key={i} className="mb-2 text-sm leading-relaxed text-kiuli-charcoal last:mb-0">
        {renderInlineMarkdown(trimmed.replace(/\n/g, ' '))}
      </p>
    )
  })
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Strip internal tags like [article_section]
  const cleaned = text.replace(/\[article_section\]/g, '')

  // Split by **bold** markers
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

// ── Brief Tab ────────────────────────────────────────────────────────────────

interface BriefTabProps {
  project: WorkspaceProject
  projectId: number
}

export function BriefTab({ project, projectId }: BriefTabProps) {
  const [summary, setSummary] = useState(project.briefSummary || '')
  const [angle, setAngle] = useState(project.targetAngle || '')
  const [audience, setAudience] = useState(
    (project.targetAudience || []).join(', '),
  )
  const [notes, setNotes] = useState(project.competitiveNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-sync local state when project prop changes (e.g. after conversation action)
  useEffect(() => {
    setSummary(project.briefSummary || '')
    setAngle(project.targetAngle || '')
    setAudience((project.targetAudience || []).join(', '))
    setNotes(project.competitiveNotes || '')
  }, [project.briefSummary, project.targetAngle, project.targetAudience, project.competitiveNotes])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    const result = await saveProjectFields(projectId, {
      briefSummary: summary,
      targetAngle: angle,
      targetAudience: audience
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      competitiveNotes: notes,
    })
    setSaving(false)
    if ('success' in result) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      alert(result.error)
    }
  }, [projectId, summary, angle, audience, notes])

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Brief Summary</label>
        <textarea
          className={textareaClass}
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What is this piece about?"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Target Angle</label>
        <input
          className={inputClass}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="Unique angle or hook"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Target Audience</label>
        <input
          className={inputClass}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Comma-separated audiences"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Competitive Notes</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How does this differentiate from existing content?"
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Save Brief'}
        </button>
        {saved && (
          <span className="text-xs text-emerald-600">Saved</span>
        )}
      </div>
    </div>
  )
}

// ── Research Tab ─────────────────────────────────────────────────────────────

interface ResearchTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

export function ResearchTab({ project, projectId, onDataChanged }: ResearchTabProps) {
  const [running, setRunning] = useState(false)

  const handleRunResearch = useCallback(async () => {
    setRunning(true)
    const result = await triggerResearch(projectId)
    setRunning(false)
    if ('error' in result) {
      alert(result.error)
    } else {
      // Refresh project data to show new research
      if (onDataChanged) onDataChanged()
    }
  }, [projectId, onDataChanged])

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Research</h3>
        <button onClick={handleRunResearch} disabled={running} className={btnSecondary}>
          {running ? (
            <>
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            'Run Research'
          )}
        </button>
      </div>

      {/* Synthesis */}
      {project.researchSynthesis && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Synthesis</label>
          <div className={contentArea}>
            {renderMarkdownText(project.researchSynthesis)}
          </div>
        </div>
      )}

      {/* Existing Site Content */}
      {project.existingSiteContent && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Existing Site Content</label>
          <div className={contentArea}>
            {renderMarkdownText(project.existingSiteContent)}
          </div>
        </div>
      )}

      {/* Sources table */}
      {project.researchSources && project.researchSources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>
            Sources ({project.researchSources.length})
          </label>
          <div className="overflow-x-auto rounded border border-kiuli-gray/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-kiuli-gray/60 bg-kiuli-ivory/50">
                  <th className="px-3 py-2 text-left font-medium text-kiuli-charcoal/60">
                    Title
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-kiuli-charcoal/60">
                    Credibility
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-kiuli-charcoal/60">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.researchSources.map((source, i) => (
                  <tr key={i} className="border-b border-kiuli-gray/30 last:border-0">
                    <td className="px-3 py-2">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-kiuli-clay hover:underline"
                        >
                          {source.title || source.url}
                        </a>
                      ) : (
                        source.title || '(untitled)'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-kiuli-gray/30 px-2 py-0.5 text-[10px] font-medium capitalize">
                        {source.credibility}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-kiuli-charcoal/60">
                      {source.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Uncertainty map */}
      {project.uncertaintyMap && project.uncertaintyMap.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>
            Uncertainty Map ({project.uncertaintyMap.length})
          </label>
          <div className="flex flex-col gap-2">
            {project.uncertaintyMap.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded border border-kiuli-gray/60 bg-white p-3"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                    item.confidence === 'fact'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.confidence === 'inference'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {item.confidence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-kiuli-charcoal">{item.claim}</p>
                  {item.notes && (
                    <p className="mt-0.5 text-xs text-kiuli-charcoal/50">{item.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editorial notes */}
      {project.editorialNotes && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Editorial Notes</label>
          <div className={contentArea}>
            {renderMarkdownText(project.editorialNotes)}
          </div>
        </div>
      )}

      {!project.researchSynthesis &&
        !project.researchSources?.length &&
        !project.uncertaintyMap?.length && (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-kiuli-charcoal/40">
            <p>No research data yet.</p>
            <p className="mt-1 text-xs">Click &quot;Run Research&quot; to compile sources.</p>
          </div>
        )}
    </div>
  )
}

// ── Draft Tab ────────────────────────────────────────────────────────────────

interface DraftTabProps {
  project: WorkspaceProject
  projectId: number
  onFocusSection?: (sectionName: string) => void
}

export function DraftTab({ project, projectId, onFocusSection }: DraftTabProps) {
  const [generating, setGenerating] = useState(false)
  const compound = isCompoundType(project.contentType)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    const result = await triggerDraft(projectId)
    setGenerating(false)
    if ('error' in result) {
      alert(result.error)
    }
  }, [projectId])

  // Compound type — sections view
  if (compound && project.sections) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-kiuli-charcoal">Sections</h3>
        </div>
        {Object.entries(project.sections).map(([key, content]) => (
          <div
            key={key}
            className="rounded border border-kiuli-gray/60 bg-white"
          >
            <div className="flex items-center justify-between border-b border-kiuli-gray/60 px-4 py-2.5">
              <span className="text-xs font-semibold text-kiuli-charcoal">
                {sectionLabels[key] || key}
              </span>
              {onFocusSection && (
                <button
                  onClick={() => onFocusSection(sectionLabels[key] || key)}
                  className="rounded bg-kiuli-teal/10 px-2.5 py-1 text-[11px] font-medium text-kiuli-teal transition-colors hover:bg-kiuli-teal/20"
                >
                  Focus
                </button>
              )}
            </div>
            <div className="p-4">
              {content ? (
                renderMarkdownText(content)
              ) : (
                <p className="text-sm text-kiuli-charcoal/40">(empty)</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Article type — single body
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Draft</h3>
        {!project.draftBody && (
          <button onClick={handleGenerate} disabled={generating} className={btnSecondary}>
            {generating ? (
              <>
                <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Draft'
            )}
          </button>
        )}
      </div>

      {/* Meta fields */}
      {(project.metaTitle || project.metaDescription || project.answerCapsule) && (
        <div className="flex flex-col gap-3 rounded border border-kiuli-gray/60 bg-white p-4">
          {project.metaTitle && (
            <div>
              <label className={labelClass}>Meta Title</label>
              <p className="mt-0.5 text-sm text-kiuli-charcoal">{project.metaTitle}</p>
            </div>
          )}
          {project.metaDescription && (
            <div>
              <label className={labelClass}>Meta Description</label>
              <p className="mt-0.5 text-sm text-kiuli-charcoal/70">{project.metaDescription}</p>
            </div>
          )}
          {project.answerCapsule && (
            <div>
              <label className={labelClass}>Answer Capsule</label>
              <p className="mt-0.5 text-sm text-kiuli-charcoal/70">{project.answerCapsule}</p>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {project.draftBody ? (
        <div className={contentArea}>
          {renderMarkdownText(project.draftBody)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-sm text-kiuli-charcoal/40">
          <p>No draft yet.</p>
          <p className="mt-1 text-xs">Click &quot;Generate Draft&quot; to create one.</p>
        </div>
      )}

      {/* Page update: current vs proposed */}
      {project.targetCurrentContent && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Current Content</label>
          <div className={`${contentArea} border-amber-200 bg-amber-50/50`}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-kiuli-charcoal/60">
              {project.targetCurrentContent}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FAQ Tab ──────────────────────────────────────────────────────────────────

interface FAQTabProps {
  project: WorkspaceProject
  projectId: number
}

export function FAQTab({ project, projectId }: FAQTabProps) {
  const [items, setItems] = useState(project.faq || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-sync when project prop changes (e.g. after conversation adds FAQ)
  useEffect(() => {
    setItems(project.faq || [])
  }, [project.faq])

  const handleChange = useCallback(
    (index: number, field: 'question' | 'answer', value: string) => {
      setItems((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    [],
  )

  const handleAdd = useCallback(() => {
    setItems((prev) => [...prev, { question: '', answer: '' }])
  }, [])

  const handleRemove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    const result = await saveFaqItems(
      projectId,
      items.filter((item) => item.question.trim() || item.answer.trim()),
    )
    setSaving(false)
    if ('success' in result) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      alert(result.error)
    }
  }, [projectId, items])

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">
          FAQ ({items.length})
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={handleAdd} className={btnSecondary}>
            + Add Item
          </button>
          <button onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Save FAQ'}
          </button>
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
      </div>

      {items.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-kiuli-charcoal/40">
          No FAQ items yet.
        </div>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          className="rounded border border-kiuli-gray/60 bg-white p-4"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="mt-0.5 text-[10px] font-medium text-kiuli-charcoal/40">
              Q{i + 1}
            </span>
            <button
              onClick={() => handleRemove(i)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <input
              className={inputClass}
              value={item.question}
              onChange={(e) => handleChange(i, 'question', e.target.value)}
              placeholder="Question"
            />
            <textarea
              className={textareaClass}
              rows={2}
              value={item.answer}
              onChange={(e) => handleChange(i, 'answer', e.target.value)}
              placeholder="Answer"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Images Tab ───────────────────────────────────────────────────────────────

import { ImageLibraryPicker } from './ImageLibraryPicker'

interface ImagesTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

export function ImagesTab({ project, projectId, onDataChanged }: ImagesTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <ImageLibraryPicker
        projectId={projectId}
        selectedId={project.heroImageId}
        selectedImgixUrl={project.heroImageImgixUrl}
        selectedAlt={project.heroImageAlt}
        defaultCountry={project.destinations?.[0]}
        defaultSpecies={project.species}
        defaultDestinations={project.destinations}
        onHeroChanged={onDataChanged}
      />
      {isArticleType(project.contentType) && (
        <ArticleImagesSection
          project={project}
          projectId={projectId}
          onDataChanged={onDataChanged}
        />
      )}
    </div>
  )
}

// ── Article Images Section ───────────────────────────────────────────────────

import { extractHeadingsFromLexical } from '../../../../content-system/embeddings/lexical-text'

interface ArticleImagesSectionProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

function ArticleImagesSection({ project, projectId, onDataChanged }: ArticleImagesSectionProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [images, setImages] = useState<ArticleImage[]>(project.articleImages || [])
  const imagesRef = useRef<ArticleImage[]>(project.articleImages || [])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedImages, setLastSavedImages] = useState<ArticleImage[]>(project.articleImages || [])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pickingForPosition, setPickingForPosition] = useState<number | null>(null)

  // ── Heading extraction (same as bugfix2) ───────────────────────────────
  const lexicalHeadings = extractHeadingsFromLexical(project.draftBodyRaw)
  const headings = lexicalHeadings.length > 0
    ? lexicalHeadings
    : (project.draftBody
      ? project.draftBody.split(/\n{2,}/).filter((p) => p.trim().length > 0).slice(0, 8).map((_, i) => `Section ${i + 1}`)
      : [])

  // ── Dirty tracking ────────────────────────────────────────────────────
  const isDirty = JSON.stringify(images) !== JSON.stringify(lastSavedImages)

  // ── Navigation guard ──────────────────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // ── Sync from props when project data refreshes externally ────────────
  useEffect(() => {
    const incoming = project.articleImages || []
    setImages(incoming)
    imagesRef.current = incoming
    setLastSavedImages(incoming)
    setSaveStatus('idle')
    setSaveError(null)
  }, [project.articleImages])

  // ── Debounced save ────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    const current = imagesRef.current
    setSaveStatus('saving')
    setSaveError(null)
    const result = await saveArticleImages(projectId, current)
    if ('success' in result) {
      setLastSavedImages(current)
      setSaveStatus('saved')
      onDataChanged?.()
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    } else {
      setSaveStatus('error')
      setSaveError(result.error)
    }
  }, [projectId, onDataChanged])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => doSave(), 800)
  }, [doSave])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Mutation helpers (local-only, then schedule save) ──────────────────

  const updateImages = useCallback((fn: (prev: ArticleImage[]) => ArticleImage[]) => {
    setImages((prev) => {
      const next = fn(prev)
      imagesRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const handleAssign = useCallback((position: number, match: { mediaId: number; imgixUrl: string | null; alt: string }) => {
    updateImages((prev) => {
      const updated = prev.filter((img) => img.position !== position)
      updated.push({
        position,
        mediaId: match.mediaId,
        imgixUrl: match.imgixUrl || undefined,
        alt: match.alt || undefined,
      })
      updated.sort((a, b) => a.position - b.position)
      return updated
    })
    setPickingForPosition(null)
  }, [updateImages])

  const handleRemove = useCallback((position: number) => {
    updateImages((prev) => prev.filter((img) => img.position !== position))
  }, [updateImages])

  const handleCaptionChange = useCallback((position: number, caption: string) => {
    updateImages((prev) =>
      prev.map((img) => img.position === position ? { ...img, caption } : img),
    )
  }, [updateImages])

  const handleRetry = useCallback(() => {
    doSave()
  }, [doSave])

  // ── Render ────────────────────────────────────────────────────────────

  if (!project.draftBody) {
    return (
      <div className="mx-5 rounded border border-kiuli-gray/30 bg-kiuli-gray/5 p-4">
        <p className="text-xs text-kiuli-charcoal/50">Generate a draft first to add inline images.</p>
      </div>
    )
  }

  return (
    <div className="mx-5 flex flex-col gap-3">
      {/* Header with save status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal">Article Images</h3>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-kiuli-charcoal/50">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[10px] text-emerald-600">Saved</span>
          )}
          {saveStatus === 'error' && (
            <button onClick={handleRetry} className="text-[10px] font-medium text-red-600 hover:underline">
              Save failed — Retry
            </button>
          )}
          {isDirty && saveStatus === 'idle' && (
            <span className="text-[10px] text-amber-600">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {saveStatus === 'error' && saveError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {saveError}
        </div>
      )}

      <p className="text-[10px] text-kiuli-charcoal/50">
        Assign images to positions in the article. They will be inserted after each heading when published.
      </p>

      {/* Position slots */}
      <div className="flex flex-col gap-2">
        {headings.map((heading, i) => {
          const assigned = images.find((img) => img.position === i)
          return (
            <div key={i} className="rounded border border-kiuli-gray/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-kiuli-charcoal">
                  After: <span className="text-kiuli-teal">{heading}</span>
                </span>
                <span className="text-[10px] text-kiuli-charcoal/40">Position {i}</span>
              </div>

              {assigned ? (
                <div className="flex gap-3">
                  {assigned.imgixUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${assigned.imgixUrl.split('?')[0]}?w=120&h=80&fit=crop&auto=format`}
                      alt={assigned.alt || ''}
                      className="h-16 w-24 rounded object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <input
                      className={`${inputClass} text-[11px]`}
                      placeholder="Caption (optional)"
                      value={assigned.caption || ''}
                      onChange={(e) => handleCaptionChange(i, e.target.value)}
                    />
                    <button
                      onClick={() => handleRemove(i)}
                      className="self-start text-[10px] text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPickingForPosition(i)}
                  className="rounded border border-dashed border-kiuli-gray/50 px-3 py-2 text-xs text-kiuli-charcoal/50 hover:border-kiuli-teal hover:text-kiuli-teal"
                >
                  + Choose image
                </button>
              )}
            </div>
          )
        })}
      </div>

      {headings.length === 0 && (
        <p className="text-[10px] text-kiuli-charcoal/40">No headings found in draft. Images require section headings to determine placement.</p>
      )}

      {/* Inline picker modal for choosing article images */}
      {pickingForPosition !== null && (
        <ArticleImagePickerModal
          position={pickingForPosition}
          defaultCountry={project.destinations?.[0]}
          defaultSpecies={project.species}
          excludeIds={images.map((img) => img.mediaId)}
          onSelect={handleAssign}
          onClose={() => setPickingForPosition(null)}
        />
      )}
    </div>
  )
}

// ── Article Image Picker Modal ───────────────────────────────────────────────

import { searchImages, generateImagePrompts } from '@/app/(payload)/admin/image-library/actions'
import { generateImageViaApi } from '@/app/(payload)/admin/image-library/generate-client'
import type { LibraryMatch, GeneratableImageType, PhotographicPrompt } from '../../../../content-system/images/types'
function ArticleImagePickerModal({ position, defaultCountry, defaultSpecies, excludeIds, onSelect, onClose }: {
  position: number
  defaultCountry?: string
  defaultSpecies?: string[]
  excludeIds?: number[]
  onSelect: (position: number, match: { mediaId: number; imgixUrl: string | null; alt: string }) => void
  onClose: () => void
}) {
  const [matches, setMatches] = useState<LibraryMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [showGenModal, setShowGenModal] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const doSearch = useCallback(async () => {
    setLoading(true)
    setSearchError(null)
    const result = await searchImages({
      country: defaultCountry || undefined,
      query: query || undefined,
      species: defaultSpecies?.length ? defaultSpecies : undefined,
      excludeIds: excludeIds?.length ? excludeIds : undefined,
      limit: 24,
    })
    setLoading(false)
    if ('result' in result) {
      setMatches(result.result.matches)
    } else {
      setSearchError(result.error)
    }
  }, [defaultCountry, defaultSpecies, excludeIds, query])

  useEffect(() => {
    doSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="max-h-[80vh] w-[600px] overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-kiuli-charcoal">Choose Image for Position {position}</h3>
          <button onClick={onClose} className="text-xs text-kiuli-charcoal/50 hover:text-kiuli-charcoal">Close</button>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            placeholder="Search images..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          />
          <button onClick={doSearch} className="rounded bg-kiuli-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-kiuli-teal/90">
            Search
          </button>
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1 rounded bg-kiuli-clay px-3 py-1.5 text-xs font-medium text-white hover:bg-kiuli-clay/90"
          >
            <Sparkles className="h-3 w-3" /> Generate
          </button>
        </div>

        {searchError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {searchError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-kiuli-teal" />
          </div>
        ) : matches.length === 0 ? (
          <p className="py-8 text-center text-xs text-kiuli-charcoal/40">No images found.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {matches.map((match) => (
              <button
                key={match.mediaId}
                onClick={() => onSelect(position, { mediaId: match.mediaId, imgixUrl: match.imgixUrl, alt: match.alt })}
                className="group relative overflow-hidden rounded border border-kiuli-gray/40 hover:border-kiuli-teal/50"
              >
                {match.imgixUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${match.imgixUrl.split('?')[0]}?w=150&h=100&fit=crop&auto=format`}
                    alt={match.alt}
                    className="aspect-[3/2] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center bg-kiuli-gray/20 text-[9px] text-kiuli-charcoal/30">
                    No preview
                  </div>
                )}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="line-clamp-1 text-[9px] text-white">{match.alt}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {showGenModal && (
          <ArticleImageGenModal
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
    </div>
  )
}

// ── Article Image Generation Modal ──────────────────────────────────────────

const COUNTRIES_COMPACT = ['Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa', 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda', 'Mozambique']

function ArticleImageGenModal({ defaultCountry, defaultSpecies, onClose, onGenerated }: {
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
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [genSuccess, setGenSuccess] = useState<{ mediaId: number; imgixUrl: string } | null>(null)

  const handleGenPrompts = useCallback(async () => {
    setGenerating(true)
    setGenError(null)
    setGenSuccess(null)
    try {
      const result = await generateImagePrompts({
        type: genType,
        species: species || undefined,
        country: country || undefined,
        description: description || undefined,
      }, 3)
      if ('prompts' in result) setPrompts(result.prompts)
      else setGenError(result.error)
    } catch (error) {
      setGenError(error instanceof Error ? error.message : 'Failed to generate prompts')
    } finally {
      setGenerating(false)
    }
  }, [genType, species, country, description])

  const handleGenImage = useCallback(async (index: number) => {
    setGeneratingIndex(index)
    setGenError(null)
    setGenSuccess(null)
    try {
      const result = await generateImageViaApi(prompts[index].prompt, {
        type: genType,
        species: species ? [species] : undefined,
        country: country || undefined,
        aspectRatio: prompts[index].aspectRatio,
      })
      if ('mediaId' in result) {
        setGenSuccess({ mediaId: result.mediaId, imgixUrl: result.imgixUrl })
        setTimeout(() => onGenerated(), 1500)
      } else {
        setGenError(result.error)
      }
    } catch (error) {
      setGenError(error instanceof Error ? error.message : 'Unexpected error')
    } finally {
      setGeneratingIndex(null)
    }
  }, [prompts, genType, species, country, onGenerated])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="max-h-[80vh] w-[500px] overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-kiuli-charcoal">Generate Image</h3>
          <button onClick={onClose} className="text-xs text-kiuli-charcoal/50 hover:text-kiuli-charcoal">Close</button>
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
            {COUNTRIES_COMPACT.map((c) => <option key={c} value={c}>{c}</option>)}
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

        {/* Error banner */}
        {genError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {genError}
          </div>
        )}

        {/* Success banner */}
        {genSuccess && (
          <div className="mt-3 flex items-center gap-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${genSuccess.imgixUrl.split('?')[0]}?w=80&h=60&fit=crop&auto=format`}
              alt="Generated"
              className="h-12 w-16 rounded object-cover"
            />
            <span className="text-xs font-medium text-emerald-700">Image saved to library!</span>
          </div>
        )}

        {prompts.length > 0 && !genSuccess && (
          <div className="mt-4 flex flex-col gap-2">
            {prompts.map((p, i) => (
              <div key={i} className="rounded border border-kiuli-gray/60 p-3">
                <p className="line-clamp-3 text-[11px] text-kiuli-charcoal">{p.prompt}</p>
                <p className="mt-1 text-[10px] text-kiuli-charcoal/50">{p.cameraSpec} | {p.aspectRatio}</p>
                <button
                  onClick={() => handleGenImage(i)}
                  disabled={generatingIndex !== null}
                  className="mt-2 rounded bg-kiuli-clay px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                >
                  {generatingIndex === i ? (
                    <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Generating...</>
                  ) : (
                    'Generate & Save'
                  )}
                </button>
                {generatingIndex === i && (
                  <p className="mt-2 text-[10px] text-kiuli-charcoal/50">
                    Generating image — this typically takes 30-60 seconds. Please don&apos;t close this window.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Consistency Tab ──────────────────────────────────────────────────────────

interface ConsistencyTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

const resultBannerStyles: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'No contradictions found' },
  soft_contradiction: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Soft contradictions detected' },
  hard_contradiction: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Hard contradictions detected' },
  not_checked: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Not yet checked' },
}

const issueTypeBadge: Record<string, { bg: string; text: string }> = {
  hard: { bg: 'bg-red-100', text: 'text-red-700' },
  soft: { bg: 'bg-amber-100', text: 'text-amber-700' },
  staleness: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

const resolutionBadge: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
  updated_draft: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Draft Updated' },
  updated_existing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Existing Updated' },
  overridden: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Overridden' },
}

export function ConsistencyTab({ project, projectId, onDataChanged }: ConsistencyTabProps) {
  const [running, setRunning] = useState(false)
  const [overrideIssueId, setOverrideIssueId] = useState<string | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [resolving, setResolving] = useState<string | null>(null)

  const result = project.consistencyCheckResult || 'not_checked'
  const issues = project.consistencyIssues || []
  const banner = resultBannerStyles[result] || resultBannerStyles.not_checked

  const handleRunCheck = useCallback(async () => {
    setRunning(true)
    const res = await triggerConsistencyCheck(projectId)
    setRunning(false)
    if ('error' in res) {
      alert(res.error)
    } else if (onDataChanged) {
      onDataChanged()
    }
  }, [projectId, onDataChanged])

  const handleResolve = useCallback(async (
    issueId: string,
    resolution: 'updated_draft' | 'updated_existing' | 'overridden',
    note?: string,
  ) => {
    setResolving(issueId)
    const res = await resolveConsistencyIssue(projectId, issueId, resolution, note)
    setResolving(null)
    if ('error' in res) {
      alert(res.error)
    } else {
      setOverrideIssueId(null)
      setOverrideNote('')
      if (onDataChanged) onDataChanged()
    }
  }, [projectId, onDataChanged])

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header + Run button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Consistency Check</h3>
        <button onClick={handleRunCheck} disabled={running} className={btnSecondary}>
          {running ? (
            <>
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Checking...
            </>
          ) : (
            'Run Consistency Check'
          )}
        </button>
      </div>

      {/* Result banner */}
      <div className={`rounded border p-3 ${banner.bg}`}>
        <span className={`text-sm font-medium ${banner.text}`}>{banner.label}</span>
        {issues.length > 0 && (
          <span className={`ml-2 text-xs ${banner.text}`}>
            ({issues.length} issue{issues.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-3">
          {issues.map((issue: ConsistencyIssueDisplay) => {
            const typeBadge = issueTypeBadge[issue.issueType] || issueTypeBadge.soft
            const resBadge = resolutionBadge[issue.resolution] || resolutionBadge.pending
            const isResolving = resolving === issue.id

            return (
              <div key={issue.id} className="rounded border border-kiuli-gray/60 bg-white p-4">
                {/* Badges row */}
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${typeBadge.bg} ${typeBadge.text}`}>
                    {issue.issueType}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${resBadge.bg} ${resBadge.text}`}>
                    {resBadge.label}
                  </span>
                </div>

                {/* Content */}
                <div className="mb-2">
                  <label className={labelClass}>New Content (Draft)</label>
                  <p className="mt-0.5 text-sm text-kiuli-charcoal">{issue.newContent}</p>
                </div>
                <div className="mb-2">
                  <label className={labelClass}>Existing Content</label>
                  <p className="mt-0.5 text-sm text-kiuli-charcoal/70">{issue.existingContent}</p>
                </div>
                <div className="mb-3">
                  <label className={labelClass}>Source</label>
                  <p className="mt-0.5 text-xs text-kiuli-charcoal/50">{issue.sourceRecord}</p>
                </div>

                {/* Resolution note if resolved */}
                {issue.resolutionNote && (
                  <div className="mb-3 rounded bg-gray-50 p-2">
                    <label className={labelClass}>Resolution Note</label>
                    <p className="mt-0.5 text-xs text-kiuli-charcoal/70">{issue.resolutionNote}</p>
                  </div>
                )}

                {/* Action buttons for pending issues */}
                {issue.resolution === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-kiuli-gray/30 pt-3">
                    <button
                      onClick={() => handleResolve(issue.id, 'updated_draft')}
                      disabled={isResolving}
                      className="rounded bg-kiuli-teal/10 px-3 py-1.5 text-[11px] font-medium text-kiuli-teal transition-colors hover:bg-kiuli-teal/20 disabled:opacity-40"
                    >
                      {isResolving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Update Draft'}
                    </button>
                    <button
                      onClick={() => handleResolve(issue.id, 'updated_existing')}
                      disabled={isResolving}
                      className="rounded bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-40"
                    >
                      Update Existing
                    </button>
                    {overrideIssueId === issue.id ? (
                      <div className="flex w-full items-center gap-2 pt-1">
                        <input
                          className="flex-1 rounded border border-kiuli-gray bg-white px-2 py-1 text-xs text-kiuli-charcoal focus:border-kiuli-teal focus:outline-none"
                          placeholder="Why override? (required)"
                          value={overrideNote}
                          onChange={(e) => setOverrideNote(e.target.value)}
                        />
                        <button
                          onClick={() => handleResolve(issue.id, 'overridden', overrideNote)}
                          disabled={!overrideNote.trim() || isResolving}
                          className="rounded bg-purple-50 px-3 py-1 text-[11px] font-medium text-purple-600 hover:bg-purple-100 disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => { setOverrideIssueId(null); setOverrideNote('') }}
                          className="text-[11px] text-kiuli-charcoal/50 hover:text-kiuli-charcoal"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setOverrideIssueId(issue.id)}
                        disabled={isResolving}
                        className="rounded bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-600 transition-colors hover:bg-purple-100 disabled:opacity-40"
                      >
                        Override
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {result === 'not_checked' && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-sm text-kiuli-charcoal/40">
          <p>No consistency check has been run yet.</p>
          <p className="mt-1 text-xs">Click &quot;Run Consistency Check&quot; to scan for contradictions.</p>
        </div>
      )}
    </div>
  )
}

// ── Distribution Tab ─────────────────────────────────────────────────────────

interface DistributionTabProps {
  project: WorkspaceProject
  projectId: number
}

export function DistributionTab({ project, projectId }: DistributionTabProps) {
  const dist = project.distribution
  const [linkedin, setLinkedin] = useState(dist?.linkedinSummary || '')
  const [facebook, setFacebook] = useState(dist?.facebookSummary || '')
  const [pinnedComment, setPinnedComment] = useState(dist?.facebookPinnedComment || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-sync when project prop changes
  useEffect(() => {
    setLinkedin(project.distribution?.linkedinSummary || '')
    setFacebook(project.distribution?.facebookSummary || '')
    setPinnedComment(project.distribution?.facebookPinnedComment || '')
  }, [project.distribution])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    const result = await saveProjectFields(projectId, {
      linkedinSummary: linkedin,
      facebookSummary: facebook,
      facebookPinnedComment: pinnedComment,
    })
    setSaving(false)
    if ('success' in result) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      alert(result.error)
    }
  }, [projectId, linkedin, facebook, pinnedComment])

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Distribution</h3>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Save'}
          </button>
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>LinkedIn Summary</label>
        <textarea
          className={textareaClass}
          rows={4}
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="LinkedIn post content..."
        />
        {dist?.linkedinPosted && (
          <span className="text-[10px] text-emerald-600">Posted</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Facebook Summary</label>
        <textarea
          className={textareaClass}
          rows={4}
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="Facebook post content..."
        />
        {dist?.facebookPosted && (
          <span className="text-[10px] text-emerald-600">Posted</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Facebook Pinned Comment</label>
        <textarea
          className={textareaClass}
          rows={2}
          value={pinnedComment}
          onChange={(e) => setPinnedComment(e.target.value)}
          placeholder="Pinned comment..."
        />
      </div>
    </div>
  )
}

// ── Metadata Tab ─────────────────────────────────────────────────────────────

interface MetadataTabProps {
  project: WorkspaceProject
}

export function MetadataTab({ project }: MetadataTabProps) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <h3 className="text-sm font-semibold text-kiuli-charcoal">Metadata</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Content Type</label>
          <p className="mt-0.5 text-sm capitalize text-kiuli-charcoal">
            {project.contentType.replace(/_/g, ' ')}
          </p>
        </div>
        <div>
          <label className={labelClass}>Stage</label>
          <p className="mt-0.5 text-sm capitalize text-kiuli-charcoal">{project.stage}</p>
        </div>
        {project.originPathway && (
          <div>
            <label className={labelClass}>Origin Pathway</label>
            <p className="mt-0.5 text-sm text-kiuli-charcoal">{project.originPathway}</p>
          </div>
        )}
        {project.originSource && (
          <div>
            <label className={labelClass}>Origin Source</label>
            <p className="mt-0.5 text-sm text-kiuli-charcoal">{project.originSource}</p>
          </div>
        )}
        {project.freshnessCategory && (
          <div>
            <label className={labelClass}>Freshness</label>
            <p className="mt-0.5 text-sm capitalize text-kiuli-charcoal">
              {project.freshnessCategory}
            </p>
          </div>
        )}
        {project.publishedAt && (
          <div>
            <label className={labelClass}>Published At</label>
            <p className="mt-0.5 text-sm text-kiuli-charcoal">
              {new Date(project.publishedAt).toLocaleDateString()}
            </p>
          </div>
        )}
        {project.lastReviewedAt && (
          <div>
            <label className={labelClass}>Last Reviewed</label>
            <p className="mt-0.5 text-sm text-kiuli-charcoal">
              {new Date(project.lastReviewedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Tags */}
      {project.destinations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Destinations</label>
          <div className="flex flex-wrap gap-1.5">
            {project.destinations.map((d, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {project.properties.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Properties</label>
          <div className="flex flex-wrap gap-1.5">
            {project.properties.map((p, i) => (
              <span
                key={i}
                className="rounded-full bg-kiuli-teal/10 px-2.5 py-0.5 text-[11px] font-medium text-kiuli-teal"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {project.species.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Species</label>
          <div className="flex flex-wrap gap-1.5">
            {project.species.map((s, i) => (
              <span
                key={i}
                className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Page update target */}
      {project.targetCollection && (
        <div className="flex flex-col gap-1.5 rounded border border-kiuli-gray/60 bg-white p-4">
          <label className={labelClass}>Update Target</label>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-kiuli-charcoal/50">Collection</span>
              <p className="text-kiuli-charcoal">{project.targetCollection}</p>
            </div>
            <div>
              <span className="text-xs text-kiuli-charcoal/50">Field</span>
              <p className="text-kiuli-charcoal">{project.targetField}</p>
            </div>
            <div>
              <span className="text-xs text-kiuli-charcoal/50">Record ID</span>
              <p className="text-kiuli-charcoal">{project.targetRecordId}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
