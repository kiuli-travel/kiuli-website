import { callImageGeneration } from '../openrouter-client'
import { generatePhotographicPrompts } from './prompt-generator'
import { uploadGeneratedImage } from './upload-pipeline'
import type { PhotographicSubject, PhotographicPrompt, UploadResult, ImageGenerationResult } from './types'
import { isPropertyType, PROPERTY_GUARD_MESSAGE } from './types'

/**
 * Generate photographic prompts for a subject.
 */
export async function generatePrompts(
  subject: PhotographicSubject,
  count?: number,
): Promise<PhotographicPrompt[]> {
  if (isPropertyType(subject.type)) {
    throw new Error(PROPERTY_GUARD_MESSAGE)
  }
  return generatePhotographicPrompts(subject, count)
}

/**
 * Generate an image from a photographic prompt.
 */
export async function generateImage(
  prompt: string,
  options?: { aspectRatio?: string; imageSize?: string },
): Promise<ImageGenerationResult> {
  return callImageGeneration(prompt, {
    aspectRatio: options?.aspectRatio,
    imageSize: options?.imageSize,
  })
}

/**
 * Generate an image and save it to the library.
 * Returns the new Media record ID and imgix URL.
 */
export async function generateAndSave(
  prompt: string,
  metadata: {
    type: 'wildlife' | 'landscape' | 'destination' | 'country'
    species?: string[]
    country?: string
    destination?: string
    aspectRatio?: string
  },
): Promise<UploadResult & { model: string }> {
  if (isPropertyType(metadata.type)) {
    throw new Error(PROPERTY_GUARD_MESSAGE)
  }

  // Generate the image
  const result = await callImageGeneration(prompt, {
    aspectRatio: metadata.aspectRatio,
  })

  // Upload to library
  const upload = await uploadGeneratedImage(result.imageBase64, {
    type: metadata.type,
    species: metadata.species,
    country: metadata.country,
    destination: metadata.destination,
    prompt,
    aspectRatio: metadata.aspectRatio,
    model: result.model,
  })

  return {
    ...upload,
    model: result.model,
  }
}
