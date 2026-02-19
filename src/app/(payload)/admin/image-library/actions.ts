'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { searchLibrary } from '../../../../../content-system/images/library-search'
import { generatePhotographicPrompts } from '../../../../../content-system/images/prompt-generator'
import { generateAndSave } from '../../../../../content-system/images/image-generator'
import { labelMediaRecord } from '../../../../../content-system/images/labeler'
import type { LibrarySearchOptions, PhotographicSubject, LibrarySearchResult, PhotographicPrompt } from '../../../../../content-system/images/types'
import { isPropertyType, PROPERTY_GUARD_MESSAGE } from '../../../../../content-system/images/types'

async function authenticate() {
  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  return { payload, user }
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchImages(
  options: LibrarySearchOptions,
): Promise<{ result: LibrarySearchResult } | { error: string }> {
  const { user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    const result = await searchLibrary(options)
    return { result }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Hero Image Selection (project-scoped) ────────────────────────────────────

export async function selectHeroImage(
  projectId: number,
  mediaId: number,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Verify both exist
    await payload.findByID({ collection: 'content-projects', id: projectId, depth: 0 })
    await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { heroImage: mediaId },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removeHeroImage(
  projectId: number,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { heroImage: null },
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Prompt Generation ────────────────────────────────────────────────────────

export async function generateImagePrompts(
  subject: PhotographicSubject,
  count?: number,
): Promise<{ prompts: PhotographicPrompt[] } | { error: string }> {
  const { user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  if (isPropertyType(subject.type)) {
    return { error: PROPERTY_GUARD_MESSAGE }
  }

  try {
    const prompts = await generatePhotographicPrompts(subject, count)
    return { prompts }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Image Generation ─────────────────────────────────────────────────────────

export async function generateAndSaveImage(
  prompt: string,
  metadata: {
    type: 'wildlife' | 'landscape' | 'destination' | 'country'
    species?: string[]
    country?: string
    destination?: string
    aspectRatio?: string
  },
): Promise<{ mediaId: number; imgixUrl: string; model: string } | { error: string }> {
  const { user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  if (isPropertyType(metadata.type)) {
    return { error: PROPERTY_GUARD_MESSAGE }
  }

  try {
    const result = await generateAndSave(prompt, metadata)
    return result
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Metadata Update ──────────────────────────────────────────────────────────

export async function updateImageMetadata(
  mediaId: number,
  fields: Record<string, unknown>,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  const allowedFields = new Set([
    'alt', 'altText', 'country', 'imageType', 'scene',
    'mood', 'timeOfDay', 'setting', 'composition',
    'suitableFor', 'animals', 'tags', 'quality', 'isHero',
  ])

  const safeData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.has(key)) safeData[key] = value
  }

  if (Object.keys(safeData).length === 0) {
    return { error: 'No valid fields to update' }
  }

  try {
    await payload.update({ collection: 'media', id: mediaId, data: safeData })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Re-label ─────────────────────────────────────────────────────────────────

export async function relabelImage(
  mediaId: number,
  context?: { country?: string; destination?: string; species?: string[] },
): Promise<{ success: true } | { error: string }> {
  const { user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    await labelMediaRecord(mediaId, context)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
