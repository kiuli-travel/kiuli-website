'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  isCompoundType,
  sectionLabels,
  type WorkspaceProject,
} from '../workspace-types'
import {
  saveProjectFields,
  triggerResearch,
  triggerDraft,
  saveFaqItems,
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

export function ImagesTab() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-kiuli-charcoal/40">
      Image management coming in a future phase.
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
