/**
 * Test: Image generation via OpenRouter FLUX.2 Max
 *
 * Gate 2: Image generation works end-to-end
 * - Generates an image using FLUX.2 Max via OpenRouter
 * - Image is valid (sharp can read dimensions)
 * - File size > 100KB (it's a real image, not a placeholder)
 *
 * Usage: npx tsx content-engine/scripts/test-image-generation.ts
 */

import './bootstrap'
import path from 'path'
import { callImageGeneration } from '../../content-system/openrouter-client'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

async function main() {
  console.log('=== Test: Image Generation via OpenRouter ===\n')

  const prompt =
    'A leopard resting on a weathered acacia branch in the Serengeti at golden hour. ' +
    'Shot with a Canon EF 400mm f/2.8L telephoto lens. Warm backlighting creates a rim ' +
    'light effect around the spotted coat. Shallow depth of field with creamy bokeh ' +
    'dissolving the savanna background. National Geographic quality wildlife photography.'

  console.log('Prompt:', prompt.slice(0, 100) + '...')
  console.log('Calling callImageGeneration...\n')

  const startTime = Date.now()
  const result = await callImageGeneration(prompt)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`Generation completed in ${elapsed}s`)
  console.log(`Model used: ${result.model}`)
  console.log(`Base64 data length: ${result.imageBase64.length} chars`)
  console.log(`Prompt used: ${result.prompt.slice(0, 80)}...`)

  // Decode and validate with sharp
  const imageBuffer = Buffer.from(result.imageBase64, 'base64')
  console.log(`\nDecoded buffer size: ${(imageBuffer.length / 1024).toFixed(1)} KB`)

  const metadata = await sharp(imageBuffer).metadata()
  console.log(`Image format: ${metadata.format}`)
  console.log(`Dimensions: ${metadata.width} x ${metadata.height}`)
  console.log(`Channels: ${metadata.channels}`)

  // Write to temp file for inspection
  const tmpDir = path.join(process.cwd(), 'content-engine', 'scripts', 'tmp')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const ext = metadata.format === 'png' ? 'png' : 'jpg'
  const tmpFile = path.join(tmpDir, `test-generated-image.${ext}`)
  fs.writeFileSync(tmpFile, imageBuffer)
  console.log(`\nSaved to: ${tmpFile}`)

  // Assertions
  const errors: string[] = []

  if (imageBuffer.length < 100 * 1024) {
    errors.push(`File size ${(imageBuffer.length / 1024).toFixed(1)} KB is below 100KB minimum`)
  }

  if (!metadata.width || !metadata.height) {
    errors.push('Sharp could not read image dimensions')
  }

  if (metadata.width && metadata.width < 256) {
    errors.push(`Image width ${metadata.width} is suspiciously small`)
  }

  if (metadata.height && metadata.height < 256) {
    errors.push(`Image height ${metadata.height} is suspiciously small`)
  }

  console.log('\n=== Results ===')
  if (errors.length === 0) {
    console.log('PASS: All assertions passed')
    console.log(`  - Image is valid (${metadata.format}, ${metadata.width}x${metadata.height})`)
    console.log(`  - File size: ${(imageBuffer.length / 1024).toFixed(1)} KB (> 100KB)`)
    console.log(`  - Model: ${result.model}`)
    console.log(`  - Generation time: ${elapsed}s`)
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
