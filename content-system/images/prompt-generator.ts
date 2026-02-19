import { callModel } from '../openrouter-client'
import type { PhotographicSubject, PhotographicPrompt, GeneratableImageType } from './types'
import { PROPERTY_GUARD_MESSAGE } from './types'

const ALLOWED_TYPES: Set<string> = new Set<string>(['wildlife', 'landscape', 'destination', 'country'])

const SYSTEM_PROMPT = `You are an expert wildlife and nature photographer who has spent 20 years shooting across East and Southern Africa. You think in terms of camera behaviour — lenses, apertures, shutter speeds, lighting physics, and film stocks — not scene descriptions.

When given a subject, you produce photographic prompts that tell an AI diffusion model exactly HOW a real photographer would capture the image. Each prompt must read like a technical shot description from a professional photographer's field notebook.

REQUIRED ELEMENTS in every prompt:
- Lens focal length and type (telephoto, wide-angle, macro, tilt-shift)
- Aperture and depth of field effect
- Shutter speed when relevant (frozen action vs motion blur)
- Lighting direction, quality, and time of day
- Film stock or colour science reference (Fujifilm Velvia 50, Kodak Portra 400, etc.)
- Camera position and perspective (eye-level from vehicle, low angle from hide, aerial, etc.)
- Environmental context (dust, haze, water spray, vegetation, atmosphere)
- Behavioural authenticity (natural animal poses, not anthropomorphised)
- Composition guidance (rule of thirds, leading lines, negative space)

NEVER include:
- Text, watermarks, borders, frames
- Human artifacts (buildings in wildlife shots unless contextually appropriate)
- Obviously AI artifacts (extra limbs, impossible anatomy)
- Anthropomorphised animals
- "Photo of" or "Image of" prefixes
- Generic descriptions without camera specifics

FOR WILDLIFE: Use telephoto lenses (200-600mm), wide apertures (f/2.8-f/5.6), fast shutter speeds. Consider animal behaviour — resting, hunting, drinking, grooming, running. Eye contact vs looking away. Group dynamics vs solitary subjects.

FOR LANDSCAPES: Use wide-angle lenses (14-35mm), smaller apertures (f/8-f/16) for depth. Consider atmospheric conditions — morning mist, dust clouds, thunderstorm light, star trails. Include scale references.

FOR DESTINATIONS: Blend landscape and cultural elements. Consider the iconic visual identity of the place. Use establishing shots that capture the essence.

FOR COUNTRIES: Capture the diversity — wildlife, landscapes, culture, light quality unique to the region.

Respond with a JSON array of prompt objects. Each object must have:
- prompt: The full photographic prompt (150-250 words)
- intent: One sentence describing what this image will show
- aspectRatio: Recommended ratio ("16:9" for landscapes/panoramic, "3:2" for standard, "4:5" for portraits, "1:1" for square)
- cameraSpec: Brief camera setup summary (e.g., "600mm telephoto, f/4, 1/2000s")

Return ONLY the JSON array, no other text.`

export async function generatePhotographicPrompts(
  subject: PhotographicSubject,
  count: number = 3,
): Promise<PhotographicPrompt[]> {
  // Property guard — hard gate
  if (!ALLOWED_TYPES.has(subject.type)) {
    throw new Error(PROPERTY_GUARD_MESSAGE)
  }

  const userPrompt = buildUserPrompt(subject, count)

  const result = await callModel('drafting', [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], {
    maxTokens: 4096,
    temperature: 0.8,
  })

  let parsed: PhotographicPrompt[]
  try {
    let text = result.content.trim()
    // Strip markdown fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Failed to parse prompt generator response: ${result.content.substring(0, 200)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Prompt generator did not return an array')
  }

  // Validate each prompt
  return parsed.slice(0, count).map((p) => ({
    prompt: String(p.prompt || ''),
    intent: String(p.intent || ''),
    aspectRatio: String(p.aspectRatio || '16:9'),
    cameraSpec: String(p.cameraSpec || ''),
  }))
}

function buildUserPrompt(subject: PhotographicSubject, count: number): string {
  const parts: string[] = []

  parts.push(`Generate ${count} photographic prompts for:`)
  parts.push(`Type: ${subject.type}`)

  if (subject.species) parts.push(`Species: ${subject.species}`)
  if (subject.destination) parts.push(`Destination: ${subject.destination}`)
  if (subject.country) parts.push(`Country: ${subject.country}`)
  if (subject.mood) parts.push(`Mood: ${subject.mood}`)
  if (subject.timeOfDay) parts.push(`Time of day: ${subject.timeOfDay}`)

  if (subject.description) {
    parts.push(`\nThe user wants: ${subject.description}`)
    parts.push('Incorporate this specific scene into your photographic prompts while adding camera specifications, lighting, and technical details.')
  }

  if (subject.type === 'wildlife' && subject.species) {
    parts.push(`\nConsider the natural behaviour and habitat of ${subject.species} in ${subject.country || 'Africa'}. Vary the prompts across different behaviours, lighting conditions, and compositions.`)
  }

  if (subject.type === 'landscape' && subject.destination) {
    parts.push(`\nCapture the iconic geography of ${subject.destination}. Vary across different vantage points, weather conditions, and times of day.`)
  }

  return parts.join('\n')
}
