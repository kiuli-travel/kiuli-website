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

function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice(7)
  return token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY
}

interface ImageStatus {
  sourceS3Key: string
  status: string
  mediaId?: string | null
  error?: string | null
}

export async function POST(request: NextRequest) {
  // Validate authentication
  if (!validateApiKey(request)) {
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

    const imageStatuses = (job.imageStatuses as ImageStatus[]) || []
    const imageIndex = imageStatuses.findIndex((img) => img.sourceS3Key === sourceS3Key)

    if (imageIndex === -1) {
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

      imageStatuses[imageIndex] = {
        ...imageStatuses[imageIndex],
        status: 'completed',
        mediaId: String(media.id),
        error: null,
      }
    } else if (action === 'skip') {
      imageStatuses[imageIndex] = {
        ...imageStatuses[imageIndex],
        status: 'skipped',
        error: null,
      }
    } else if (action === 'remove') {
      // Remove from tracking entirely
      imageStatuses.splice(imageIndex, 1)
    }

    // Recalculate counts
    const processed = imageStatuses.filter((img) => img.status === 'completed').length
    const skipped = imageStatuses.filter((img) => img.status === 'skipped').length
    const failed = imageStatuses.filter((img) => img.status === 'failed').length

    // Update job
    await payload.update({
      collection: 'itinerary-jobs',
      id: jobId,
      data: {
        imageStatuses,
        processedImages: processed,
        skippedImages: skipped,
        failedImages: failed,
        totalImages: imageStatuses.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as Record<string, any>,
    })

    // Check if all images are now resolved (no more failed)
    const allResolved = failed === 0

    return NextResponse.json({
      success: true,
      action,
      sourceS3Key,
      imageStatuses: {
        total: imageStatuses.length,
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

    const imageStatuses = (job.imageStatuses as ImageStatus[]) || []
    const imageIndex = imageStatuses.findIndex((img) => img.sourceS3Key === sourceS3Key)

    if (imageIndex === -1) {
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

    // Update image status
    imageStatuses[imageIndex] = {
      ...imageStatuses[imageIndex],
      status: 'completed',
      mediaId: String(media.id),
      error: null,
    }

    // Recalculate counts
    const processed = imageStatuses.filter((img) => img.status === 'completed').length
    const skipped = imageStatuses.filter((img) => img.status === 'skipped').length
    const failed = imageStatuses.filter((img) => img.status === 'failed').length

    // Update job
    await payload.update({
      collection: 'itinerary-jobs',
      id: jobId,
      data: {
        imageStatuses,
        processedImages: processed,
        skippedImages: skipped,
        failedImages: failed,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as Record<string, any>,
    })

    const allResolved = failed === 0

    return NextResponse.json({
      success: true,
      action: 'upload',
      sourceS3Key,
      mediaId: media.id,
      s3Url,
      imageStatuses: {
        total: imageStatuses.length,
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
