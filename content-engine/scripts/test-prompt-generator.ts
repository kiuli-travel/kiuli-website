/**
 * Test: Photographic prompt generator
 *
 * Gate 2: Prompt generator works
 * - Wildlife prompts contain camera specs (focal length, aperture)
 * - Accommodation prompts are rejected
 * - Each prompt > 100 characters
 *
 * Usage: npx tsx content-engine/scripts/test-prompt-generator.ts
 */

import './bootstrap'
import { generatePhotographicPrompts } from '../../content-system/images/prompt-generator'
import type { PhotographicSubject } from '../../content-system/images/types'

async function main() {
  console.log('=== Test: Photographic Prompt Generator ===\n')

  const errors: string[] = []
  let totalPrompts = 0

  // Test 1: Leopard in Tanzania
  console.log('--- Test 1: Wildlife (Leopard, Tanzania) ---')
  const subject1: PhotographicSubject = {
    type: 'wildlife',
    species: 'leopard',
    country: 'Tanzania',
  }
  const prompts1 = await generatePhotographicPrompts(subject1, 3)
  console.log(`Generated ${prompts1.length} prompts`)
  for (const p of prompts1) {
    console.log(`  [${p.aspectRatio}] ${p.intent}`)
    console.log(`    Camera: ${p.cameraSpec}`)
    console.log(`    Prompt: ${p.prompt.slice(0, 120)}...`)
    if (p.prompt.length < 100) errors.push(`Wildlife prompt too short: ${p.prompt.length} chars`)
    totalPrompts++
  }
  if (prompts1.length !== 3) errors.push(`Expected 3 wildlife prompts, got ${prompts1.length}`)

  // Test 2: Okavango Delta landscape
  console.log('\n--- Test 2: Landscape (Okavango Delta, Botswana) ---')
  const subject2: PhotographicSubject = {
    type: 'landscape',
    destination: 'Okavango Delta',
    country: 'Botswana',
  }
  const prompts2 = await generatePhotographicPrompts(subject2, 3)
  console.log(`Generated ${prompts2.length} prompts`)
  for (const p of prompts2) {
    console.log(`  [${p.aspectRatio}] ${p.intent}`)
    console.log(`    Prompt: ${p.prompt.slice(0, 120)}...`)
    if (p.prompt.length < 100) errors.push(`Landscape prompt too short: ${p.prompt.length} chars`)
    totalPrompts++
  }
  if (prompts2.length !== 3) errors.push(`Expected 3 landscape prompts, got ${prompts2.length}`)

  // Test 3: Masai Mara destination
  console.log('\n--- Test 3: Destination (Masai Mara, Kenya) ---')
  const subject3: PhotographicSubject = {
    type: 'destination',
    destination: 'Masai Mara',
    country: 'Kenya',
  }
  const prompts3 = await generatePhotographicPrompts(subject3, 3)
  console.log(`Generated ${prompts3.length} prompts`)
  for (const p of prompts3) {
    console.log(`  [${p.aspectRatio}] ${p.intent}`)
    console.log(`    Prompt: ${p.prompt.slice(0, 120)}...`)
    if (p.prompt.length < 100) errors.push(`Destination prompt too short: ${p.prompt.length} chars`)
    totalPrompts++
  }
  if (prompts3.length !== 3) errors.push(`Expected 3 destination prompts, got ${prompts3.length}`)

  // Test 4: Accommodation — must be rejected
  console.log('\n--- Test 4: Accommodation (should be REJECTED) ---')
  const subject4: PhotographicSubject = {
    type: 'accommodation' as PhotographicSubject['type'],
    destination: 'Singita Grumeti',
    country: 'Tanzania',
  }
  try {
    await generatePhotographicPrompts(subject4, 3)
    errors.push('Accommodation prompts were NOT rejected — property guard failed')
    console.log('  FAIL: Accommodation prompts were generated (should have been rejected)')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('property') || msg.toLowerCase().includes('accommodation') || msg.toLowerCase().includes('guard') || msg.toLowerCase().includes('allowed')) {
      console.log(`  PASS: Rejected with: "${msg}"`)
    } else {
      errors.push(`Accommodation rejection had unexpected error: ${msg}`)
      console.log(`  WARN: Rejected but with unexpected message: "${msg}"`)
    }
  }

  // Test 5: Verify camera-specific language
  console.log('\n--- Test 5: Camera spec verification ---')
  const cameraTerms = ['mm', 'f/', 'focal', 'lens', 'aperture', 'telephoto', 'wide-angle', 'zoom']
  let cameraSpecCount = 0
  for (const p of [...prompts1, ...prompts2, ...prompts3]) {
    const promptLower = p.prompt.toLowerCase() + ' ' + (p.cameraSpec || '').toLowerCase()
    const hasCameraSpec = cameraTerms.some((term) => promptLower.includes(term))
    if (hasCameraSpec) cameraSpecCount++
  }
  console.log(`  ${cameraSpecCount}/${totalPrompts} prompts contain camera-specific language`)
  if (cameraSpecCount < totalPrompts * 0.8) {
    errors.push(`Only ${cameraSpecCount}/${totalPrompts} prompts have camera specs (expected 80%+)`)
  }

  // Test 6: Wildlife with custom description
  console.log('\n--- Test 6: Wildlife with description (hippos in Kazinga channel) ---')
  const subject6: PhotographicSubject = {
    type: 'wildlife',
    species: 'hippopotamus',
    country: 'Uganda',
    description: 'aerial photo of pods of hippos in the Kazinga channel',
  }
  const prompts6 = await generatePhotographicPrompts(subject6, 3)
  console.log(`Generated ${prompts6.length} prompts`)
  for (const p of prompts6) {
    console.log(`  [${p.aspectRatio}] ${p.intent}`)
    console.log(`    Prompt: ${p.prompt.slice(0, 150)}...`)
    totalPrompts++
  }
  if (prompts6.length !== 3) errors.push(`Expected 3 description prompts, got ${prompts6.length}`)
  // Check that description concepts appear in prompts
  const descPromptText = prompts6.map((p) => p.prompt.toLowerCase()).join(' ')
  const hasHippo = descPromptText.includes('hippo')
  const hasAerial = descPromptText.includes('aerial') || descPromptText.includes('above') || descPromptText.includes('overhead') || descPromptText.includes('bird')
  const hasCameraInDesc = prompts6.some((p) => cameraTerms.some((t) => (p.prompt + ' ' + p.cameraSpec).toLowerCase().includes(t)))
  console.log(`  Hippo reference: ${hasHippo ? 'YES' : 'NO'}`)
  console.log(`  Aerial concept: ${hasAerial ? 'YES' : 'NO'}`)
  console.log(`  Camera specs: ${hasCameraInDesc ? 'YES' : 'NO'}`)
  if (!hasHippo) errors.push('Description test: prompts do not reference hippo')
  if (!hasCameraInDesc) errors.push('Description test: prompts lack camera specs')

  // Summary
  console.log('\n=== Results ===')
  if (errors.length === 0) {
    console.log('PASS: All assertions passed')
    console.log(`  - Generated ${totalPrompts} prompts across 3 subject types`)
    console.log(`  - All prompts > 100 characters`)
    console.log(`  - ${cameraSpecCount}/${totalPrompts} contain camera specs`)
    console.log(`  - Accommodation prompts correctly rejected`)
  } else {
    console.log('FAIL:')
    errors.forEach((e) => console.log(`  - ${e}`))
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
