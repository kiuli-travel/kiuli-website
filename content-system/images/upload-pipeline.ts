import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { labelMediaRecord } from './labeler'
import type { UploadMetadata, UploadResult } from './types'
import { isPropertyType, PROPERTY_GUARD_MESSAGE } from './types'

/**
 * Upload a generated image to Payload (and S3 via the storage plugin).
 * Creates a first-class Media record indistinguishable from scraped images.
 */
export async function uploadGeneratedImage(
  imageBase64: string,
  metadata: UploadMetadata,
): Promise<UploadResult> {
  // Property guard
  if (isPropertyType(metadata.type)) {
    throw new Error(PROPERTY_GUARD_MESSAGE)
  }

  const payload = await getPayload({ config: configPromise })

  // Decode base64 to buffer
  const buffer = Buffer.from(imageBase64, 'base64')

  // Generate filename and dedup key
  const timestamp = Date.now()
  const filename = `kiuli-gen-${timestamp}-${metadata.type}.png`
  const dedupKey = `generated:${timestamp}`

  // Build alt text from metadata
  const altParts: string[] = []
  if (metadata.species?.length) altParts.push(metadata.species.join(', '))
  if (metadata.destination) altParts.push(metadata.destination)
  if (metadata.country) altParts.push(metadata.country)
  altParts.push(metadata.type)
  const alt = altParts.join(' — ') || `Generated ${metadata.type} image`

  // Create Media record via Payload file upload
  // The S3 storage plugin intercepts and uploads to S3
  const file = {
    data: buffer,
    name: filename,
    mimetype: 'image/png',
    size: buffer.length,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await payload.create({
    collection: 'media',
    data: {
      alt,
      sourceS3Key: dedupKey,
      processingStatus: 'complete',
      labelingStatus: 'pending',
      country: metadata.country || undefined,
      imageType: metadata.type === 'wildlife' ? 'wildlife' : 'landscape',
      animals: metadata.species || [],
      generationPrompt: metadata.prompt || undefined,
      generationModel: metadata.model || undefined,
      generatedAt: new Date().toISOString(),
    } as any,
    file,
  })

  const mediaId = created.id as number

  // Construct imgix URL from the S3 key that Payload/S3 plugin generated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdDoc = created as any
  const imgixUrl = createdDoc.imgixUrl ||
    `https://kiuli.imgix.net/${createdDoc.filename}?auto=format,compress&q=80`

  // Trigger labeling in background (don't block the upload response)
  labelMediaRecord(mediaId, {
    country: metadata.country,
    destination: metadata.destination,
    species: metadata.species,
  }).catch((err) => {
    console.error(`[upload-pipeline] Labeling failed for media ${mediaId}:`, err.message)
  })

  return {
    mediaId,
    imgixUrl,
  }
}
