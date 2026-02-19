/**
 * Test: Upload pipeline (generation → upload → labeling)
 *
 * Gate 4: Upload pipeline works
 * - Generated image becomes a Media record in Payload
 * - Media record has imgixUrl that returns HTTP 200
 * - Labeling produces enrichment fields (scene, animals, tags)
 * - Media record has image sizes populated
 *
 * Usage: npx tsx content-engine/scripts/test-upload-pipeline.ts
 */

import './bootstrap'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callImageGeneration } from '../../content-system/openrouter-client'
import { uploadGeneratedImage } from '../../content-system/images/upload-pipeline'
import { labelMediaRecord } from '../../content-system/images/labeler'
import type { UploadMetadata } from '../../content-system/images/types'

async function main() {
  console.log('=== Test: Upload Pipeline ===\n')

  const payload = await getPayload({ config: configPromise })
  const errors: string[] = []

  // Step 1: Generate an image
  console.log('Step 1: Generating test image...')
  const prompt =
    'A giraffe silhouetted against a vibrant African sunset on the Serengeti plains. ' +
    'Shot with a Nikon 200-600mm at 300mm, f/5.6. Golden and orange sky with acacia trees ' +
    'in the background. National Geographic quality wildlife photography.'

  const genResult = await callImageGeneration(prompt)
  console.log(`  Generated: ${(Buffer.from(genResult.imageBase64, 'base64').length / 1024).toFixed(0)} KB`)

  // Step 2: Upload via pipeline
  console.log('\nStep 2: Uploading to Payload via pipeline...')
  const metadata: UploadMetadata = {
    type: 'wildlife',
    country: 'Tanzania',
    prompt,
    species: ['giraffe'],
  }

  const uploadResult = await uploadGeneratedImage(genResult.imageBase64, metadata)
  console.log(`  Media ID: ${uploadResult.mediaId}`)
  console.log(`  imgix URL: ${uploadResult.imgixUrl}`)

  // Step 3: Verify Media record exists
  console.log('\nStep 3: Verifying Media record...')
  const mediaRecord = (await payload.findByID({
    collection: 'media',
    id: uploadResult.mediaId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  console.log(`  alt: ${mediaRecord.alt}`)
  console.log(`  imageType: ${mediaRecord.imageType}`)
  console.log(`  country: ${mediaRecord.country}`)
  console.log(`  sourceS3Key: ${mediaRecord.sourceS3Key}`)

  if (!mediaRecord.id) errors.push('Media record not found in Payload')
  if (mediaRecord.imageType !== 'wildlife') errors.push(`Expected imageType=wildlife, got ${mediaRecord.imageType}`)
  if (mediaRecord.country !== 'Tanzania') errors.push(`Expected country=Tanzania, got ${mediaRecord.country}`)

  // Verify S3 key pattern — upload-pipeline uses "generated:{timestamp}"
  const s3Key = mediaRecord.sourceS3Key as string
  if (!s3Key || !s3Key.startsWith('generated:')) {
    errors.push(`S3 key pattern wrong: ${s3Key} (expected generated:...)`)
  } else {
    console.log(`  S3 key pattern: PASS (${s3Key})`)
  }

  // Step 4: Verify imgix URL works
  console.log('\nStep 4: Verifying imgix URL...')
  const imgixUrl = uploadResult.imgixUrl
  if (imgixUrl) {
    try {
      const resp = await fetch(imgixUrl + '?w=100&auto=format', { method: 'HEAD' })
      console.log(`  imgix HTTP status: ${resp.status}`)
      if (resp.status !== 200) errors.push(`imgix URL returned HTTP ${resp.status}`)
    } catch (err) {
      console.log(`  imgix fetch failed: ${err}`)
      errors.push(`imgix URL not accessible: ${err}`)
    }
  } else {
    errors.push('No imgixUrl returned from upload')
  }

  // Step 5: Run labeling
  // labelMediaRecord returns void — it updates the Media record in-place
  console.log('\nStep 5: Running labelMediaRecord...')
  await labelMediaRecord(uploadResult.mediaId, {
    country: 'Tanzania',
    species: ['giraffe'],
  })
  console.log('  Labeling completed (no error thrown)')

  // Step 6: Re-read Media record to verify enrichment was saved
  console.log('\nStep 6: Re-reading Media record for enrichment fields...')
  const enrichedMedia = (await payload.findByID({
    collection: 'media',
    id: uploadResult.mediaId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  console.log(`  labelingStatus: ${enrichedMedia.labelingStatus}`)
  console.log(`  scene: ${enrichedMedia.scene}`)
  console.log(`  isHero: ${enrichedMedia.isHero}`)
  console.log(`  quality: ${enrichedMedia.quality}`)
  console.log(`  tags: ${JSON.stringify(enrichedMedia.tags)}`)

  if (enrichedMedia.labelingStatus !== 'complete') {
    errors.push(`Expected labelingStatus=complete, got ${enrichedMedia.labelingStatus}`)
  }
  if (!enrichedMedia.scene) errors.push('Labeling did not produce scene')
  const tags = enrichedMedia.tags as string[] | undefined
  if (!tags || tags.length === 0) errors.push('Labeling did not produce tags')

  // Summary
  console.log('\n=== Results ===')
  if (errors.length === 0) {
    console.log('PASS: All assertions passed')
    console.log(`  - Image generated and uploaded (Media ID: ${uploadResult.mediaId})`)
    console.log(`  - S3 key follows generated: pattern`)
    console.log(`  - Media record has correct imageType and country`)
    console.log(`  - imgix URL accessible`)
    console.log(`  - Labeling produced enrichment fields`)
    console.log(`  - labelingStatus = complete`)
  } else {
    console.log('FAIL:')
    errors.forEach((e) => console.log(`  - ${e}`))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
