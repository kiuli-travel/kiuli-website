import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

/**
 * Validate authentication via Payload session OR API key
 */
async function validateAuth(request: NextRequest): Promise<boolean> {
  // First check for Bearer token (Lambda/external calls)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY) {
      return true
    }
  }

  // Then check for Payload session (admin UI)
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) {
      return true
    }
  } catch {
    // Session check failed
  }

  return false
}

export async function POST(request: NextRequest) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  const contentType = request.headers.get('content-type') || ''

  // Handle multipart form data (file upload)
  if (contentType.includes('multipart/form-data')) {
    return handleFileUpload(request)
  }

  // Handle JSON (replace with existing media)
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { jobId, sourceS3Key, action, mediaId } = body

  if (!jobId || !sourceS3Key) {
    return NextResponse.json(
      { success: false, error: 'jobId and sourceS3Key are required' },
      { status: 400 }
    )
  }

  if (!action || !['replace', 'skip', 'remove'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'action must be one of: replace, skip, remove' },
      { status: 400 }
    )
  }

  if (action === 'replace' && !mediaId) {
    return NextResponse.json(
      { success: false, error: 'mediaId is required for replace action' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })

  try {
    // Verify job exists
    const job = await payload.findByID({
      collection: 'itinerary-jobs',
      id: jobId,
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Find the ImageStatus record in the separate collection
    const imageStatusResult = await payload.find({
      collection: 'image-statuses',
      where: {
        and: [
          { job: { equals: jobId } },
          { sourceS3Key: { equals: sourceS3Key } },
        ],
      },
      limit: 1,
    })

    const imageStatus = imageStatusResult.docs[0]

    if (!imageStatus) {
      return NextResponse.json(
        { success: false, error: 'Image not found in job' },
        { status: 404 }
      )
    }

    // Update image status based on action
    if (action === 'replace') {
      // Verify media exists
      const media = await payload.findByID({
        collection: 'media',
        id: mediaId,
      })

      if (!media) {
        return NextResponse.json(
          { success: false, error: 'Media record not found' },
          { status: 404 }
        )
      }

      await payload.update({
        collection: 'image-statuses',
        id: imageStatus.id,
        data: {
          status: 'complete',
          mediaId: String(media.id),
          error: null,
          completedAt: new Date().toISOString(),
        },
      })
    } else if (action === 'skip') {
      await payload.update({
        collection: 'image-statuses',
        id: imageStatus.id,
        data: {
          status: 'skipped',
          error: null,
          completedAt: new Date().toISOString(),
        },
      })
    } else if (action === 'remove') {
      // Delete the ImageStatus record
      await payload.delete({
        collection: 'image-statuses',
        id: imageStatus.id,
      })
    }

    // Recalculate counts from the collection
    const allStatusesResult = await payload.find({
      collection: 'image-statuses',
      where: { job: { equals: jobId } },
      limit: 1000,
    })
    const allStatuses = allStatusesResult.docs

    const processed = allStatuses.filter((img) => img.status === 'complete').length
    const skipped = allStatuses.filter((img) => img.status === 'skipped').length
    const failed = allStatuses.filter((img) => img.status === 'failed').length

    // Update job counters
    await payload.update({
      collection: 'itinerary-jobs',
      id: jobId,
      data: {
        processedImages: processed,
        skippedImages: skipped,
        failedImages: failed,
        totalImages: allStatuses.length,
      },
    })

    // Check if all images are now resolved (no more failed)
    const allResolved = failed === 0

    return NextResponse.json({
      success: true,
      action,
      sourceS3Key,
      imageStatuses: {
        total: allStatuses.length,
        processed,
        skipped,
        failed,
      },
      allResolved,
      message: allResolved
        ? 'All images resolved'
        : `${failed} image(s) still need resolution`,
    })
  } catch (error) {
    console.error('[resolve-image] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resolve image' },
      { status: 500 }
    )
  }
}

async function handleFileUpload(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const jobId = formData.get('jobId') as string | null
  const sourceS3Key = formData.get('sourceS3Key') as string | null

  if (!file || !jobId || !sourceS3Key) {
    return NextResponse.json(
      { success: false, error: 'file, jobId, and sourceS3Key are required' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })

  try {
    // Verify job exists
    const job = await payload.findByID({
      collection: 'itinerary-jobs',
      id: jobId,
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Find the ImageStatus record in the separate collection
    const imageStatusResult = await payload.find({
      collection: 'image-statuses',
      where: {
        and: [
          { job: { equals: jobId } },
          { sourceS3Key: { equals: sourceS3Key } },
        ],
      },
      limit: 1,
    })

    const imageStatus = imageStatusResult.docs[0]

    if (!imageStatus) {
      return NextResponse.json(
        { success: false, error: 'Image not found in job' },
        { status: 404 }
      )
    }

    // Upload file to S3
    const bucket = process.env.S3_BUCKET || 'kiuli-bucket'
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `media/resolved/${timestamp}-${safeFilename}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const s3Url = `https://${bucket}.s3.${process.env.S3_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`

    // Create media record in Payload
    const media = await payload.create({
      collection: 'media',
      data: {
        url: s3Url,
        filename: safeFilename,
        mimeType: file.type,
        filesize: file.size,
        alt: `Resolved image for ${sourceS3Key}`,
      },
    })

    // Update ImageStatus record in the collection
    await payload.update({
      collection: 'image-statuses',
      id: imageStatus.id,
      data: {
        status: 'complete',
        mediaId: String(media.id),
        error: null,
        completedAt: new Date().toISOString(),
      },
    })

    // Recalculate counts from the collection
    const allStatusesResult = await payload.find({
      collection: 'image-statuses',
      where: { job: { equals: jobId } },
      limit: 1000,
    })
    const allStatuses = allStatusesResult.docs

    const processed = allStatuses.filter((img) => img.status === 'complete').length
    const skipped = allStatuses.filter((img) => img.status === 'skipped').length
    const failed = allStatuses.filter((img) => img.status === 'failed').length

    // Update job counters
    await payload.update({
      collection: 'itinerary-jobs',
      id: jobId,
      data: {
        processedImages: processed,
        skippedImages: skipped,
        failedImages: failed,
      },
    })

    const allResolved = failed === 0

    return NextResponse.json({
      success: true,
      action: 'upload',
      sourceS3Key,
      mediaId: media.id,
      s3Url,
      imageStatuses: {
        total: allStatuses.length,
        processed,
        skipped,
        failed,
      },
      allResolved,
      message: allResolved
        ? 'All images resolved'
        : `${failed} image(s) still need resolution`,
    })
  } catch (error) {
    console.error('[resolve-image] Upload error:', error)
    return NextResponse.json(
      { success: false, error: `Upload failed: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
