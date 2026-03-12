"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"

// Layout
import ItineraryEditorLayout from "@/components/admin/editorial/ItineraryEditorLayout"
import ItineraryEditorHeader from "@/components/admin/editorial/ItineraryEditorHeader"
import EditorSidebar from "@/components/admin/editorial/EditorSidebar"

// Content sections
import CoreFieldsAccordion from "@/components/admin/editorial/CoreFieldsAccordion"
import InvestmentAccordion from "@/components/admin/editorial/InvestmentAccordion"
import type { InvestmentTier } from "@/components/admin/editorial/InvestmentAccordion"
import HeroPanel from "@/components/admin/editorial/HeroPanel"
import DayAccordion from "@/components/admin/editorial/DayAccordion"
import SegmentCard from "@/components/admin/editorial/SegmentCard"
import FAQAccordion from "@/components/admin/editorial/FAQAccordion"
import type { FAQItem } from "@/components/admin/editorial/FAQCard"
import BlockersPanel from "@/components/admin/editorial/BlockersPanel"
import type { Blocker } from "@/components/admin/editorial/BlockersPanel"
import type { StripImage } from "@/components/admin/editorial/ImageStrip"
import { ImageSelectionModal } from "@/components/admin/ImageSelectionModal"

// ─── Generic Helpers ────────────────────────────────────────────────

type Doc = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function num(v: unknown): number {
  return typeof v === "number" ? v : 0
}
function bool(v: unknown): boolean {
  return v === true
}

/** Convert a populated relationship (object with id) back to just the id. */
function toId(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (typeof v === "string" || typeof v === "number") return v
  if (typeof v === "object" && (v as Doc).id !== undefined) return (v as Doc).id
  return v
}
function toIds(v: unknown): unknown {
  if (!Array.isArray(v)) return v
  return v.map(toId)
}

// ─── Rich Text Helpers ──────────────────────────────────────────────

function richTextToString(value: unknown): string {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return ""
  const obj = value as Doc
  const root = obj.root as Doc | undefined
  if (!root?.children || !Array.isArray(root.children)) return ""
  return (root.children as Doc[])
    .map((block) => extractBlockText(block))
    .filter(Boolean)
    .join("\n")
}

function extractBlockText(node: Doc): string {
  if (node.type === "text" && typeof node.text === "string") return node.text
  if (Array.isArray(node.children)) {
    return (node.children as Doc[]).map((child) => extractBlockText(child)).join("")
  }
  return ""
}

function stringToRichText(text: string): Doc {
  const paragraphs = text.split("\n").filter((line) => line.trim().length > 0)
  if (paragraphs.length === 0) paragraphs.push("")
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      children: paragraphs.map((p) => ({
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        children: [{ type: "text", text: p, format: 0, version: 1 }],
        direction: "ltr",
      })),
      direction: "ltr",
    },
  }
}

// ─── Investment Tier Mapping ────────────────────────────────────────

function priceToTier(fromPrice: number | null | undefined): InvestmentTier {
  if (!fromPrice) return null
  if (fromPrice >= 75000) return "ultra"
  if (fromPrice >= 40000) return "premium"
  if (fromPrice >= 20000) return "classic"
  if (fromPrice >= 10000) return "essential"
  return null
}

function tierToPrice(tier: InvestmentTier): number | null {
  switch (tier) {
    case "essential": return 10000
    case "classic": return 20000
    case "premium": return 40000
    case "ultra": return 75000
    default: return null
  }
}

// ─── Voice Config Mapping ───────────────────────────────────────────

function fieldPathToVoiceConfig(fieldPath: string): string {
  if (fieldPath === "title") return "itinerary-title"
  if (fieldPath === "metaTitle") return "meta-title"
  if (fieldPath === "metaDescription") return "meta-description"
  if (fieldPath === "overview.summary") return "overview-summary"
  if (fieldPath === "investmentLevel.includes") return "investment-includes"
  if (fieldPath === "whyKiuli") return "why-kiuli"
  if (fieldPath.startsWith("faqItems.")) return "faq-answer"
  if (fieldPath.startsWith("days.") && fieldPath.endsWith(".title")) return "day-title"
  if (fieldPath === "investmentLevel.callout") return "investment-includes"
  return "segment-description"
}

// ─── Local State Types ──────────────────────────────────────────────

interface SegmentEditState {
  id: string
  blockType: "stay" | "activity" | "transfer"
  name: string
  descriptionItrvl: string
  descriptionEnhanced: string
  titleItrvl: string
  titleEnhanced: string
  inclusionsItrvl: string
  inclusionsEnhanced: string
  images: StripImage[]
  imagesReviewed: boolean
  isReviewed: boolean
}

interface DayEditState {
  id: string
  dayNumber: number
  titleItrvl: string
  titleEnhanced: string
  titleReviewed: boolean
  segments: SegmentEditState[]
}

// ─── Extraction from API Response ───────────────────────────────────

function extractSegment(seg: Doc): SegmentEditState {
  const blockType = str(seg.blockType) as "stay" | "activity" | "transfer"
  let name = ""
  let titleItrvl = ""
  let titleEnhanced = ""
  let inclusionsItrvl = ""
  let inclusionsEnhanced = ""

  if (blockType === "stay") {
    name = str(seg.accommodationName) || str(seg.accommodationNameEnhanced) || str(seg.accommodationNameItrvl)
    titleItrvl = str(seg.accommodationNameItrvl)
    titleEnhanced = str(seg.accommodationNameEnhanced)
    inclusionsItrvl = richTextToString(seg.inclusionsItrvl)
    inclusionsEnhanced = richTextToString(seg.inclusionsEnhanced)
  } else {
    name = str(seg.title) || str(seg.titleEnhanced) || str(seg.titleItrvl)
    titleItrvl = str(seg.titleItrvl)
    titleEnhanced = str(seg.titleEnhanced)
  }

  const rawImages = Array.isArray(seg.images) ? seg.images : []
  const images: StripImage[] = rawImages
    .filter((img): img is Doc => img !== null && typeof img === "object")
    .map((img) => ({
      id: String(img.id || ""),
      url: str(img.imgixUrl) || str(img.url),
      alt: str(img.alt) || str(img.filename) || "",
    }))

  return {
    id: str(seg.id),
    blockType,
    name,
    descriptionItrvl: richTextToString(seg.descriptionItrvl),
    descriptionEnhanced: richTextToString(seg.descriptionEnhanced),
    titleItrvl,
    titleEnhanced,
    inclusionsItrvl,
    inclusionsEnhanced,
    images,
    imagesReviewed: bool(seg.imagesReviewed),
    isReviewed: bool(seg.reviewed),
  }
}

function extractDay(day: Doc, index: number): DayEditState {
  const segments = Array.isArray(day.segments) ? day.segments : []
  return {
    id: str(day.id) || String(index),
    dayNumber: num(day.dayNumber) || index + 1,
    titleItrvl: str(day.titleItrvl),
    titleEnhanced: str(day.titleEnhanced),
    titleReviewed: bool(day.titleReviewed),
    segments: segments
      .filter((s): s is Doc => s !== null && typeof s === "object")
      .map(extractSegment),
  }
}

function extractFaqItem(faq: Doc): FAQItem {
  return {
    id: str(faq.id),
    questionItrvl: str(faq.questionItrvl) || str(faq.question),
    questionEnhanced: str(faq.questionEnhanced),
    answerItrvl: richTextToString(faq.answerItrvl) || richTextToString(faq.answer),
    answerEnhanced: richTextToString(faq.answerEnhanced),
    isReviewed: bool(faq.reviewed),
  }
}

function extractTripTypeNames(tripTypes: unknown): string[] {
  if (!Array.isArray(tripTypes)) return []
  return tripTypes
    .filter((tt): tt is Doc => tt !== null && typeof tt === "object")
    .map((tt) => str(tt.title))
    .filter(Boolean)
}

function mediaUrl(v: unknown): string | null {
  if (!v || typeof v !== "object") return null
  return str((v as Doc).url) || null
}
function mediaAlt(v: unknown): string {
  if (!v || typeof v !== "object") return ""
  const obj = v as Doc
  return str(obj.alt) || str(obj.filename) || ""
}

// ─── Main Page Component ────────────────────────────────────────────

export default function ItineraryEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  // ── Raw doc (for safe save merging) ──
  const [rawDoc, setRawDoc] = useState<Doc | null>(null)

  // ── Autosave refs ──
  const isDirtyRef = useRef(false)
  const justLoadedRef = useRef(true)

  // ── Loading ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null)

  // ── Trip type lookup ──
  const [tripTypeNameToId, setTripTypeNameToId] = useState<Map<string, string | number>>(new Map())

  // ── Accordion state ──
  const [coreFieldsOpen, setCoreFieldsOpen] = useState(true)
  const [investmentOpen, setInvestmentOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({})

  // ── Enhancing state ──
  const [enhancingField, setEnhancingField] = useState<string | null>(null)
  const [isEnhancingAll, setIsEnhancingAll] = useState(false)

  // ── Core fields ──
  const [titleItrvl, setTitleItrvl] = useState("")
  const [titleEnhanced, setTitleEnhanced] = useState("")
  const [titleReviewed, setTitleReviewed] = useState(false)
  const [slug, setSlug] = useState("")
  const [metaTitleItrvl, setMetaTitleItrvl] = useState("")
  const [metaTitleEnhanced, setMetaTitleEnhanced] = useState("")
  const [metaTitleReviewed, setMetaTitleReviewed] = useState(false)
  const [metaDescItrvl, setMetaDescItrvl] = useState("")
  const [metaDescEnhanced, setMetaDescEnhanced] = useState("")
  const [metaDescReviewed, setMetaDescReviewed] = useState(false)
  const [selectedTripTypes, setSelectedTripTypes] = useState<string[]>([])
  const [answerCapsule, setAnswerCapsule] = useState("")
  const [answerCapsuleReviewed, setAnswerCapsuleReviewed] = useState(false)
  const [focusKeyword, setFocusKeyword] = useState("")
  const [focusKeywordReviewed, setFocusKeywordReviewed] = useState(false)

  // ── Investment ──
  const [selectedTier, setSelectedTier] = useState<InvestmentTier>(null)
  const [inclusionsItrvl, setInclusionsItrvl] = useState("")
  const [inclusionsEnhanced, setInclusionsEnhanced] = useState("")
  const [inclusionsReviewed, setInclusionsReviewed] = useState(false)
  const [calloutItrvl, setCalloutItrvl] = useState("")
  const [calloutEnhanced, setCalloutEnhanced] = useState("")
  const [calloutReviewed, setCalloutReviewed] = useState(false)

  // ── Hero ──
  const [heroImageId, setHeroImageId] = useState<number | null>(null)
  const [heroVideoId, setHeroVideoId] = useState<number | null>(null)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [heroImageAlt, setHeroImageAlt] = useState("")
  const [isImageLocked, setIsImageLocked] = useState(false)
  const [isImageReviewed, setIsImageReviewed] = useState(false)
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(null)
  const [heroVideoName, setHeroVideoName] = useState("")
  const [isVideoLocked, setIsVideoLocked] = useState(false)
  const [isVideoReviewed, setIsVideoReviewed] = useState(false)
  const [showHeroVideo, setShowHeroVideo] = useState(false)

  // ── Days ──
  const [days, setDays] = useState<DayEditState[]>([])

  // ── FAQs ──
  const [faqItems, setFaqItems] = useState<FAQItem[]>([])

  // ── Image modal ──
  const [imageModalOpen, setImageModalOpen] = useState(false)

  // ── iTrvl source ──
  const [itrvlUrl, setItrvlUrl] = useState<string | null>(null)

  // ── Status ──
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [publishBlockers, setPublishBlockers] = useState<Blocker[]>([])

  // ── Fetch on mount ──
  useEffect(() => {
    async function load() {
      try {
        const [itinRes, tripTypesRes] = await Promise.all([
          fetch(`/api/itineraries/${id}?depth=2&draft=true`, { credentials: "include" }),
          fetch("/api/trip-types?limit=100&depth=0", { credentials: "include" }),
        ])

        if (itinRes.status === 401 || itinRes.status === 403) {
          router.replace(`/admin?redirect=/admin/itinerary-editor/${id}`)
          return
        }
        if (!itinRes.ok) throw new Error(`Failed to load itinerary: ${itinRes.status}`)
        const doc = (await itinRes.json()) as Doc
        setRawDoc(doc)

        if (tripTypesRes.ok) {
          const ttData = (await tripTypesRes.json()) as { docs: Doc[] }
          const map = new Map<string, string | number>()
          for (const tt of ttData.docs) {
            const title = str(tt.title)
            const ttId = tt.id as string | number
            if (title && ttId) map.set(title, ttId)
          }
          setTripTypeNameToId(map)
        }

        // ── Populate state from doc ──
        setTitleItrvl(str(doc.titleItrvl))
        setTitleEnhanced(str(doc.titleEnhanced))
        setTitleReviewed(bool(doc.titleReviewed))
        setSlug(str(doc.slug))
        setMetaTitleItrvl(str(doc.metaTitleItrvl))
        setMetaTitleEnhanced(str(doc.metaTitleEnhanced))
        setMetaTitleReviewed(bool(doc.metaTitleReviewed))
        setMetaDescItrvl(str(doc.metaDescriptionItrvl))
        setMetaDescEnhanced(str(doc.metaDescriptionEnhanced))
        setMetaDescReviewed(bool(doc.metaDescriptionReviewed))
        setSelectedTripTypes(extractTripTypeNames(doc.tripTypes))
        setAnswerCapsule(str(doc.answerCapsule))
        setFocusKeyword(str(doc.focusKeyword))

        const inv = (doc.investmentLevel || {}) as Doc
        setSelectedTier(priceToTier(inv.fromPrice as number | null))
        setInclusionsItrvl(richTextToString(inv.includesItrvl))
        setInclusionsEnhanced(richTextToString(inv.includesEnhanced))
        setInclusionsReviewed(bool(inv.includesReviewed))
        setCalloutItrvl(str(inv.calloutItrvl) || str(inv.callout) || "")

        const heroImgObj = doc.heroImage && typeof doc.heroImage === 'object' ? doc.heroImage as Doc : null
        setHeroImageUrl(heroImgObj ? (str(heroImgObj.imgixUrl) || str(heroImgObj.url) || null) : null)
        setHeroImageAlt(mediaAlt(doc.heroImage))
        const rawHeroId = doc.heroImage
        if (rawHeroId && typeof rawHeroId === 'object' && (rawHeroId as any).id) {
          setHeroImageId(Number((rawHeroId as any).id))
        } else if (typeof rawHeroId === 'number') {
          setHeroImageId(rawHeroId)
        }
        setIsImageLocked(bool(doc.heroImageLocked))
        setIsImageReviewed(bool(doc.heroImageReviewed))
        const rawVideoId = doc.heroVideo
        if (rawVideoId && typeof rawVideoId === 'object' && (rawVideoId as any).id) {
          setHeroVideoId(Number((rawVideoId as any).id))
        } else if (typeof rawVideoId === 'number') {
          setHeroVideoId(rawVideoId)
        }
        setHeroVideoUrl(mediaUrl(doc.heroVideo))
        setHeroVideoName(mediaAlt(doc.heroVideo))
        setIsVideoLocked(bool(doc.heroVideoLocked))
        setIsVideoReviewed(bool(doc.heroVideoReviewed))
        setShowHeroVideo(bool(doc.showHeroVideo))

        const source = (doc.source || {}) as Doc
        setItrvlUrl(str(source.itrvlUrl) || null)

        const rawDays = Array.isArray(doc.days) ? doc.days : []
        setDays(
          rawDays
            .filter((d): d is Doc => d !== null && typeof d === "object")
            .map((d, i) => extractDay(d, i))
        )

        const rawFaqs = Array.isArray(doc.faqItems) ? doc.faqItems : []
        setFaqItems(
          rawFaqs
            .filter((f): f is Doc => f !== null && typeof f === "object")
            .map(extractFaqItem)
        )

        const docStatus = str(doc._status)
        setStatus(docStatus === "published" ? "published" : "draft")

        const rawBlockers = Array.isArray(doc.publishBlockers) ? doc.publishBlockers : []
        setPublishBlockers(
          rawBlockers
            .filter((b): b is Doc => b !== null && typeof b === "object")
            .map((b) => ({
              id: str(b.id) || String(Math.random()),
              message: str(b.reason),
              onFix: () => {},
            }))
        )

        setLoading(false)
        setTimeout(() => { justLoadedRef.current = false }, 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
        setLoading(false)
      }
    }
    load()
  }, [id])

  // ── Markdown stripping ──
  function stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, '')      // remove heading markers
      .replace(/\*\*(.+?)\*\*/g, '$1')  // remove bold
      .replace(/\*(.+?)\*/g, '$1')      // remove italic
      .replace(/`(.+?)`/g, '$1')        // remove inline code
      .replace(/^\s*[-*+]\s+/gm, '')    // remove list markers
      .trim()
  }

  // ── Enhance handler ──
  const handleEnhance = useCallback(
    async (fieldPath: string) => {
      setEnhancingField(fieldPath)
      try {
        const res = await fetch("/api/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ itineraryId: id, fieldPath, voiceConfig: fieldPathToVoiceConfig(fieldPath) }),
        })
        const data = (await res.json()) as { success: boolean; enhanced: unknown; error?: string }
        if (!data.success) throw new Error(data.error || "Enhancement failed")

        const rawEnhanced = typeof data.enhanced === "string" ? data.enhanced : richTextToString(data.enhanced)
        const enhanced = stripMarkdown(rawEnhanced)

        if (fieldPath === "title") setTitleEnhanced(enhanced)
        else if (fieldPath === "metaTitle") setMetaTitleEnhanced(enhanced)
        else if (fieldPath === "metaDescription") setMetaDescEnhanced(enhanced)
        else if (fieldPath === "investmentLevel.includes") setInclusionsEnhanced(enhanced)
        else if (fieldPath === "investmentLevel.callout") setCalloutEnhanced(enhanced)
        else if (fieldPath.startsWith("days.")) {
          const parts = fieldPath.split(".")
          const dayIdx = parseInt(parts[1], 10)
          if (parts[2] === "title") {
            setDays((prev) =>
              prev.map((d, i) => (i === dayIdx ? { ...d, titleEnhanced: enhanced } : d))
            )
          } else if (parts[2] === "segments") {
            const segIdx = parseInt(parts[3], 10)
            const field = parts[4]
            setDays((prev) =>
              prev.map((d, di) =>
                di !== dayIdx
                  ? d
                  : {
                      ...d,
                      segments: d.segments.map((s, si) =>
                        si !== segIdx
                          ? s
                          : {
                              ...s,
                              ...(field === "description"
                                ? { descriptionEnhanced: enhanced }
                                : field === "title" || field === "accommodationName"
                                  ? { titleEnhanced: enhanced }
                                  : field === "inclusions"
                                    ? { inclusionsEnhanced: enhanced }
                                    : {}),
                            }
                      ),
                    }
              )
            )
          }
        } else if (fieldPath.startsWith("faqItems.")) {
          const parts = fieldPath.split(".")
          const faqIdx = parseInt(parts[1], 10)
          const field = parts[2]
          setFaqItems((prev) =>
            prev.map((f, i) =>
              i !== faqIdx
                ? f
                : { ...f, ...(field === "answer" ? { answerEnhanced: enhanced } : { questionEnhanced: enhanced }) }
            )
          )
        }
      } catch (err) {
        console.error("Enhance failed:", err)
      } finally {
        setEnhancingField(null)
      }
    },
    [id]
  )

  // ── Save handler ──
  const handleSave = useCallback(async (publishStatus?: "draft" | "published") => {
    if (!rawDoc) return

    // Build trip type IDs from selected names
    const ttIds: (string | number)[] = []
    for (const name of selectedTripTypes) {
      const ttId = tripTypeNameToId.get(name)
      if (ttId) ttIds.push(ttId)
    }

    // Build days array by merging editorial changes into rawDoc days
    const rawDays = Array.isArray(rawDoc.days) ? (rawDoc.days as Doc[]) : []
    const mergedDays = rawDays.map((rawDay, di) => {
      const editDay = days[di]
      if (!editDay) return { ...rawDay, segments: toIds((rawDay.segments as Doc[] | undefined) ?? []) }

      const rawSegments = Array.isArray(rawDay.segments) ? (rawDay.segments as Doc[]) : []
      return {
        ...rawDay,
        titleEnhanced: editDay.titleEnhanced,
        titleReviewed: editDay.titleReviewed,
        segments: rawSegments.map((rawSeg, si) => {
          const editSeg = editDay.segments[si]
          if (!editSeg) return { ...rawSeg, images: toIds(rawSeg.images), property: toId(rawSeg.property) }

          return {
            ...rawSeg,
            images: toIds(rawSeg.images),
            property: toId(rawSeg.property),
            reviewed: editSeg.isReviewed,
            imagesReviewed: editSeg.imagesReviewed,
            descriptionEnhanced: stringToRichText(editSeg.descriptionEnhanced),
            ...(editSeg.blockType === "stay"
              ? {
                  accommodationNameEnhanced: editSeg.titleEnhanced,
                  inclusionsEnhanced: stringToRichText(editSeg.inclusionsEnhanced),
                }
              : {
                  titleEnhanced: editSeg.titleEnhanced,
                }),
          }
        }),
      }
    })

    // Build faq items by merging
    const rawFaqs = Array.isArray(rawDoc.faqItems) ? (rawDoc.faqItems as Doc[]) : []
    const mergedFaqs = rawFaqs.map((rawFaq, fi) => {
      const editFaq = faqItems[fi]
      if (!editFaq) return rawFaq
      return {
        ...rawFaq,
        questionEnhanced: editFaq.questionEnhanced,
        answerEnhanced: stringToRichText(editFaq.answerEnhanced),
        reviewed: editFaq.isReviewed,
      }
    })
    // Append any newly added FAQ items
    for (let fi = rawFaqs.length; fi < faqItems.length; fi++) {
      const editFaq = faqItems[fi]
      mergedFaqs.push({
        questionEnhanced: editFaq.questionEnhanced,
        answerEnhanced: stringToRichText(editFaq.answerEnhanced),
        reviewed: editFaq.isReviewed,
      })
    }

    const savePayload: Doc = {
      titleEnhanced,
      titleReviewed,
      metaTitleEnhanced,
      metaTitleReviewed,
      metaDescriptionEnhanced: metaDescEnhanced,
      metaDescriptionReviewed: metaDescReviewed,
      answerCapsule,
      answerCapsuleReviewed,
      focusKeyword,
      focusKeywordReviewed,
      tripTypes: ttIds,
      heroImage: heroImageId,
      heroImageLocked: isImageLocked,
      heroImageReviewed: isImageReviewed,
      heroVideo: heroVideoId,
      heroVideoLocked: isVideoLocked,
      heroVideoReviewed: isVideoReviewed,
      showHeroVideo,
      investmentLevel: {
        ...((rawDoc.investmentLevel || {}) as Doc),
        fromPrice: tierToPrice(selectedTier),
        includesEnhanced: stringToRichText(inclusionsEnhanced),
        includesReviewed: inclusionsReviewed,
        calloutEnhanced,
        calloutReviewed,
      },
      ...(publishStatus ? { _status: publishStatus } : {}),
      relatedItineraries: toIds(rawDoc.relatedItineraries),
      destinations: toIds(rawDoc.destinations),
      days: mergedDays,
      faqItems: mergedFaqs,
    }

    const res = await fetch(`/api/itineraries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(savePayload),
    })
    if (!res.ok) throw new Error(`Save failed: ${res.status}`)
    setLastAutoSaved(new Date())
  }, [
    id, rawDoc, titleEnhanced, titleReviewed, metaTitleEnhanced, metaTitleReviewed,
    metaDescEnhanced, metaDescReviewed, selectedTripTypes, tripTypeNameToId,
    answerCapsule, answerCapsuleReviewed, focusKeyword, focusKeywordReviewed,
    selectedTier, inclusionsEnhanced, inclusionsReviewed,
    isImageLocked, isImageReviewed, isVideoReviewed, showHeroVideo,
    days, faqItems,
  ])

  // ── Publish handler ──
  const handlePublish = useCallback(async () => {
    try {
      await handleSave("published")
      setStatus("published")
    } catch (err) {
      console.error("Publish failed:", err)
    }
  }, [handleSave])

  // ── Enhance All ──
  const handleEnhanceAll = useCallback(async () => {
    setIsEnhancingAll(true)
    try {
      await handleEnhance("title")
      await handleEnhance("metaTitle")
      await handleEnhance("metaDescription")
      for (let di = 0; di < days.length; di++) {
        await handleEnhance(`days.${di}.title`)
        for (let si = 0; si < days[di].segments.length; si++) {
          await handleEnhance(`days.${di}.segments.${si}.description`)
        }
      }
    } catch (err) {
      console.error("Enhance all failed:", err)
    } finally {
      setIsEnhancingAll(false)
    }
  }, [handleEnhance, days])

  // ── Segment update helper ──
  const updateSegment = useCallback(
    (dayIndex: number, segIndex: number, updates: Partial<SegmentEditState>) => {
      setDays((prev) =>
        prev.map((d, di) =>
          di !== dayIndex
            ? d
            : { ...d, segments: d.segments.map((s, si) => (si !== segIndex ? s : { ...s, ...updates })) }
        )
      )
    },
    []
  )

  // ── FAQ update helper ──
  const updateFaqItem = useCallback(
    (itemId: string, field: keyof FAQItem, value: string | boolean) => {
      setFaqItems((prev) => prev.map((f) => (f.id === itemId ? { ...f, [field]: value } : f)))
    },
    []
  )

  // ── Computed values ──
  const coreReviewedCount = [
    titleReviewed,
    metaTitleReviewed,
    metaDescReviewed,
    selectedTripTypes.length > 0,
    answerCapsuleReviewed,
    focusKeywordReviewed,
  ].filter(Boolean).length

  const itineraryReviewedCount = days.reduce(
    (acc, d) => acc + (d.titleReviewed ? 1 : 0) + d.segments.filter((s) => s.isReviewed).length,
    0
  )
  const itineraryTotalCount = days.reduce((acc, d) => acc + 1 + d.segments.length, 0)
  const faqReviewedCount = faqItems.filter((f) => f.isReviewed).length

  const totalReviewed =
    coreReviewedCount +
    (isImageReviewed ? 1 : 0) +
    (inclusionsReviewed ? 1 : 0) +
    itineraryReviewedCount +
    faqReviewedCount

  const totalItems = 6 + 1 + 1 + itineraryTotalCount + faqItems.length
  const progressPercent = totalItems > 0 ? Math.round((totalReviewed / totalItems) * 100) : 0
  const canPublish = publishBlockers.length === 0 && totalReviewed === totalItems && totalItems > 0

  const displayTitle = titleEnhanced || titleItrvl || "Untitled Itinerary"

  // ── Sidebar data ──
  const navSections = [
    { id: "blockers", label: "Publish Blockers", reviewed: 0, total: 0, isBlocker: true, blockerCount: publishBlockers.length },
    { id: "hero", label: "Hero Image & Video", reviewed: isImageReviewed ? 1 : 0, total: 1 },
    { id: "core", label: "Core Fields", reviewed: coreReviewedCount, total: 6 },
    { id: "investment", label: "Investment Level", reviewed: inclusionsReviewed ? 1 : 0, total: 1 },
    {
      id: "itinerary",
      label: "Itinerary",
      reviewed: itineraryReviewedCount,
      total: itineraryTotalCount,
      subItems: days.map((d) => ({
        id: `day-${d.dayNumber}`,
        label: `Day ${d.dayNumber}`,
        reviewed: (d.titleReviewed ? 1 : 0) + d.segments.filter((s) => s.isReviewed).length,
        total: 1 + d.segments.length,
      })),
    },
    { id: "faq", label: "FAQs", reviewed: faqReviewedCount, total: faqItems.length },
  ]

  const checklistSections = [
    { id: "hero", label: "Hero", reviewed: isImageReviewed ? 1 : 0, total: 1 },
    { id: "core", label: "Core Fields", reviewed: coreReviewedCount, total: 6 },
    { id: "investment", label: "Investment", reviewed: inclusionsReviewed ? 1 : 0, total: 1 },
    { id: "itinerary", label: "Itinerary", reviewed: itineraryReviewedCount, total: itineraryTotalCount },
    { id: "faq", label: "FAQs", reviewed: faqReviewedCount, total: faqItems.length },
  ]

  const handleNavigate = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // ── Client-side blocker recalculation ──
  useEffect(() => {
    if (loading) return
    const clientIds = new Set(["no-trip-types", "no-tier"])
    setPublishBlockers((prev) => {
      const serverBlockers = prev.filter((b) => !clientIds.has(b.id))
      const next = [...serverBlockers]
      if (selectedTripTypes.length === 0) {
        next.push({
          id: "no-trip-types",
          message: "At least one trip type must be selected",
          onFix: () => { setCoreFieldsOpen(true); handleNavigate("core") },
        })
      }
      if (!selectedTier) {
        next.push({
          id: "no-tier",
          message: "Investment tier must be selected",
          onFix: () => { setInvestmentOpen(true); handleNavigate("investment") },
        })
      }
      return next
    })
  }, [selectedTripTypes, selectedTier, loading, handleNavigate])

  // ── Dirty tracking for autosave ──
  useEffect(() => {
    if (justLoadedRef.current) return
    isDirtyRef.current = true
  }, [
    titleEnhanced, titleReviewed, metaTitleEnhanced, metaTitleReviewed,
    metaDescEnhanced, metaDescReviewed, selectedTripTypes, answerCapsule,
    answerCapsuleReviewed, focusKeyword, focusKeywordReviewed, selectedTier,
    inclusionsEnhanced, inclusionsReviewed, calloutEnhanced, calloutReviewed,
    heroImageId, heroVideoId, isImageLocked, isImageReviewed, isVideoLocked, isVideoReviewed, showHeroVideo,
    days, faqItems,
  ])

  // ── Autosave interval (60 s) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current && !justLoadedRef.current) {
        isDirtyRef.current = false
        handleSave().catch(console.error)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [handleSave])

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: "#F5F3EB" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-kiuli-gray"
            style={{ borderTopColor: "#486A6A" }}
          />
          <span className="text-sm text-kiuli-charcoal">Loading itinerary...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: "#F5F3EB" }}>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-[#FECACA] bg-[#FEE2E2] p-6">
          <span className="text-sm font-medium text-[#DC2626]">Error loading itinerary</span>
          <span className="text-xs text-[#991B1B]">{error}</span>
          <button
            onClick={() => router.push("/admin/collections/itineraries")}
            className="mt-2 rounded-md px-4 py-1.5 text-xs font-medium text-white"
            style={{ background: "#486A6A" }}
          >
            Back to Itineraries
          </button>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <ItineraryEditorLayout
      progressPercent={progressPercent}
      header={
        <ItineraryEditorHeader
          itineraryTitle={displayTitle}
          status={status}
          totalReviewed={totalReviewed}
          totalItems={totalItems}
          canPublish={canPublish}
          lastAutoSaved={lastAutoSaved}
          onNavigateToItineraries={() => router.push("/admin/itinerary-editor")}
          onEnhanceAll={handleEnhanceAll}
          onRescrape={() => router.push("/admin/scrape")}
          onSave={handleSave}
          onPublish={handlePublish}
          isEnhancingAll={isEnhancingAll}
          itrvlUrl={itrvlUrl}
        />
      }
      sidebar={
        <EditorSidebar
          navSections={navSections}
          checklistSections={checklistSections}
          onNavigate={handleNavigate}
          onPublish={handlePublish}
          canPublish={canPublish}
        />
      }
      mainContent={
        <>
          {/* Blockers */}
          <div id="blockers">
            <BlockersPanel blockers={publishBlockers} />
          </div>

          {/* Hero */}
          <div id="hero">
            <HeroPanel
              heroImageUrl={heroImageUrl}
              heroImageAlt={heroImageAlt}
              isImageLocked={isImageLocked}
              isImageReviewed={isImageReviewed}
              onSelectImage={() => setImageModalOpen(true)}
              onClearImage={() => {
                setHeroImageUrl(null)
                setHeroImageAlt("")
              }}
              onImageLockedChange={setIsImageLocked}
              onImageReviewedChange={setIsImageReviewed}
              heroVideoUrl={heroVideoUrl}
              heroVideoName={heroVideoName}
              isVideoReviewed={isVideoReviewed}
              showHeroVideo={showHeroVideo}
              onVideoReviewedChange={setIsVideoReviewed}
              onShowHeroVideoChange={setShowHeroVideo}
            />
            <ImageSelectionModal
              isOpen={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
              currentlySelected={heroImageId ? [heroImageId] : []}
              onSelect={async (mediaIds) => {
                if (mediaIds.length === 0) return
                const res = await fetch(`/api/media/${mediaIds[0]}`, { credentials: 'include' })
                if (!res.ok) return
                const media = await res.json()
                setHeroImageUrl(typeof media.imgixUrl === 'string' ? media.imgixUrl : typeof media.url === 'string' ? media.url : null)
                setHeroImageAlt(typeof media.alt === 'string' ? media.alt : typeof media.filename === 'string' ? media.filename : '')
                setHeroImageId(mediaIds[0])
                setImageModalOpen(false)
              }}
            />
          </div>

          {/* Core Fields */}
          <div id="core">
            <CoreFieldsAccordion
              isOpen={coreFieldsOpen}
              onToggle={() => setCoreFieldsOpen((v) => !v)}
              titleItrvl={titleItrvl}
              titleEnhanced={titleEnhanced}
              titleReviewed={titleReviewed}
              slug={slug}
              onTitleChange={setTitleEnhanced}
              onTitleEnhance={() => handleEnhance("title")}
              onTitleReviewedChange={setTitleReviewed}
              isTitleEnhancing={enhancingField === "title"}
              metaTitleItrvl={metaTitleItrvl}
              metaTitleEnhanced={metaTitleEnhanced}
              metaTitleReviewed={metaTitleReviewed}
              onMetaTitleChange={setMetaTitleEnhanced}
              onMetaTitleEnhance={() => handleEnhance("metaTitle")}
              onMetaTitleReviewedChange={setMetaTitleReviewed}
              isMetaTitleEnhancing={enhancingField === "metaTitle"}
              metaDescriptionItrvl={metaDescItrvl}
              metaDescriptionEnhanced={metaDescEnhanced}
              metaDescriptionReviewed={metaDescReviewed}
              onMetaDescriptionChange={setMetaDescEnhanced}
              onMetaDescriptionEnhance={() => handleEnhance("metaDescription")}
              onMetaDescriptionReviewedChange={setMetaDescReviewed}
              isMetaDescriptionEnhancing={enhancingField === "metaDescription"}
              selectedTripTypes={selectedTripTypes}
              onTripTypesChange={setSelectedTripTypes}
              answerCapsule={answerCapsule}
              answerCapsuleReviewed={answerCapsuleReviewed}
              onAnswerCapsuleChange={setAnswerCapsule}
              onAnswerCapsuleReviewedChange={setAnswerCapsuleReviewed}
              focusKeyword={focusKeyword}
              focusKeywordReviewed={focusKeywordReviewed}
              onFocusKeywordChange={setFocusKeyword}
              onFocusKeywordReviewedChange={setFocusKeywordReviewed}
            />
          </div>

          {/* Investment */}
          <div id="investment">
            <InvestmentAccordion
              isOpen={investmentOpen}
              onToggle={() => setInvestmentOpen((v) => !v)}
              selectedTier={selectedTier}
              onTierChange={setSelectedTier}
              calloutItrvl={calloutItrvl}
              calloutEnhanced={calloutEnhanced}
              calloutReviewed={calloutReviewed}
              onCalloutChange={setCalloutEnhanced}
              onCalloutEnhance={() => handleEnhance("investmentLevel.callout")}
              onCalloutReviewedChange={setCalloutReviewed}
              inclusionsItrvl={inclusionsItrvl}
              inclusionsEnhanced={inclusionsEnhanced}
              inclusionsReviewed={inclusionsReviewed}
              onInclusionsChange={setInclusionsEnhanced}
              onInclusionsEnhance={() => handleEnhance("investmentLevel.includes")}
              onInclusionsReviewedChange={setInclusionsReviewed}
              isInclusionsEnhancing={enhancingField === "investmentLevel.includes"}
              investmentReviewed={inclusionsReviewed}
              onInvestmentReviewedChange={setInclusionsReviewed}
            />
          </div>

          {/* Days */}
          <div id="itinerary">
            {days.map((day, dayIndex) => (
              <div key={day.id} id={`day-${day.dayNumber}`} className="mt-3 first:mt-0">
                <DayAccordion
                  dayNumber={day.dayNumber}
                  dayTitleItrvl={day.titleItrvl}
                  dayTitleEnhanced={day.titleEnhanced}
                  dayTitleReviewed={day.titleReviewed}
                  segments={day.segments.map((s) => ({
                    id: s.id,
                    type: s.blockType,
                    name: s.name,
                    isReviewed: s.isReviewed,
                    hasEnhancedContent: s.descriptionEnhanced.trim().length > 0 || s.titleEnhanced.trim().length > 0,
                  }))}
                  isOpen={!!openDays[dayIndex]}
                  onToggle={() => setOpenDays((prev) => ({ ...prev, [dayIndex]: !prev[dayIndex] }))}
                  onDayTitleChange={(v) =>
                    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, titleEnhanced: v } : d)))
                  }
                  onDayTitleEnhance={() => handleEnhance(`days.${dayIndex}.title`)}
                  onDayTitleReviewedChange={(v) =>
                    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, titleReviewed: v } : d)))
                  }
                  onEnhanceAll={async () => {
                    for (let si = 0; si < day.segments.length; si++) {
                      await handleEnhance(`days.${dayIndex}.segments.${si}.description`)
                    }
                  }}
                  onMarkAllReviewed={() => {
                    setDays((prev) =>
                      prev.map((d, i) =>
                        i !== dayIndex
                          ? d
                          : {
                              ...d,
                              titleReviewed: true,
                              segments: d.segments.map((s) => ({ ...s, isReviewed: true })),
                            }
                      )
                    )
                  }}
                  isDayTitleEnhancing={enhancingField === `days.${dayIndex}.title`}
                >
                  {day.segments.map((seg, segIndex) => (
                    <SegmentCard
                      key={seg.id}
                      type={seg.blockType}
                      segmentName={seg.name}
                      descriptionItrvl={seg.descriptionItrvl}
                      descriptionEnhanced={seg.descriptionEnhanced}
                      onDescriptionChange={(v) => updateSegment(dayIndex, segIndex, { descriptionEnhanced: v })}
                      onDescriptionEnhance={() =>
                        handleEnhance(`days.${dayIndex}.segments.${segIndex}.description`)
                      }
                      isDescriptionEnhancing={
                        enhancingField === `days.${dayIndex}.segments.${segIndex}.description`
                      }
                      titleItrvl={seg.blockType !== "transfer" ? seg.titleItrvl : undefined}
                      titleEnhanced={seg.blockType !== "transfer" ? seg.titleEnhanced : undefined}
                      onTitleChange={
                        seg.blockType !== "transfer"
                          ? (v) => updateSegment(dayIndex, segIndex, { titleEnhanced: v })
                          : undefined
                      }
                      onTitleEnhance={
                        seg.blockType !== "transfer"
                          ? () =>
                              handleEnhance(
                                `days.${dayIndex}.segments.${segIndex}.${
                                  seg.blockType === "stay" ? "accommodationName" : "title"
                                }`
                              )
                          : undefined
                      }
                      isTitleEnhancing={
                        enhancingField ===
                        `days.${dayIndex}.segments.${segIndex}.${
                          seg.blockType === "stay" ? "accommodationName" : "title"
                        }`
                      }
                      inclusionsItrvl={seg.blockType === "stay" ? seg.inclusionsItrvl : undefined}
                      inclusionsEnhanced={seg.blockType === "stay" ? seg.inclusionsEnhanced : undefined}
                      onInclusionsChange={
                        seg.blockType === "stay"
                          ? (v) => updateSegment(dayIndex, segIndex, { inclusionsEnhanced: v })
                          : undefined
                      }
                      onInclusionsEnhance={
                        seg.blockType === "stay"
                          ? () => handleEnhance(`days.${dayIndex}.segments.${segIndex}.inclusions`)
                          : undefined
                      }
                      isInclusionsEnhancing={
                        enhancingField === `days.${dayIndex}.segments.${segIndex}.inclusions`
                      }
                      images={seg.blockType !== "transfer" ? seg.images : undefined}
                      imagesReviewed={seg.blockType !== "transfer" ? seg.imagesReviewed : undefined}
                      onImagesReviewedChange={
                        seg.blockType !== "transfer"
                          ? (v) => updateSegment(dayIndex, segIndex, { imagesReviewed: v })
                          : undefined
                      }
                      onAddImage={seg.blockType !== "transfer" ? () => {} : undefined}
                      onRemoveImage={
                        seg.blockType !== "transfer"
                          ? (imgId) =>
                              updateSegment(dayIndex, segIndex, {
                                images: seg.images.filter((img) => img.id !== imgId),
                              })
                          : undefined
                      }
                      isReviewed={seg.isReviewed}
                      onReviewedChange={(v) => updateSegment(dayIndex, segIndex, { isReviewed: v })}
                    />
                  ))}
                </DayAccordion>
              </div>
            ))}
          </div>

          {/* FAQs */}
          <div id="faq">
            <FAQAccordion
              isOpen={faqOpen}
              onToggle={() => setFaqOpen((v) => !v)}
              items={faqItems}
              onItemChange={updateFaqItem}
              onEnhanceAnswer={(faqId) => {
                const faqIndex = faqItems.findIndex((f) => f.id === faqId)
                if (faqIndex >= 0) return handleEnhance(`faqItems.${faqIndex}.answer`)
                return Promise.resolve()
              }}
              onEnhanceAll={async () => {
                for (let fi = 0; fi < faqItems.length; fi++) {
                  await handleEnhance(`faqItems.${fi}.answer`)
                }
              }}
              onAddItem={() => {
                setFaqItems((prev) => [
                  ...prev,
                  {
                    id: `new-${Date.now()}`,
                    questionItrvl: "",
                    questionEnhanced: "",
                    answerItrvl: "",
                    answerEnhanced: "",
                    isReviewed: false,
                  },
                ])
              }}
              onDeleteItem={(itemId) => {
                setFaqItems((prev) => prev.filter((f) => f.id !== itemId))
              }}
              onReorder={(from, to) => {
                setFaqItems((prev) => {
                  const next = [...prev]
                  const [item] = next.splice(from, 1)
                  next.splice(to, 0, item)
                  return next
                })
              }}
              enhancingId={
                enhancingField?.startsWith("faqItems.")
                  ? faqItems[parseInt(enhancingField.split(".")[1], 10)]?.id ?? null
                  : null
              }
              isEnhancingAll={isEnhancingAll}
            />
          </div>
        </>
      }
    />
  )
}
