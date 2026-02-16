import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import { loadCoreVoice } from '../voice/loader'
import { buildVoicePrompt } from '../voice/prompt-builder'

export async function generateSocialSummaries(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // 1. Fetch project
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // 2. Extract body text
  const bodyText = project.body
    ? extractTextFromLexical(project.body)
    : ''

  if (!bodyText || bodyText.length < 100) {
    console.warn(`[social-summariser] Project ${projectId} has insufficient body text, skipping`)
    return
  }

  try {
    // 3. Load core voice
    const core = await loadCoreVoice()
    const voicePrompt = buildVoicePrompt({ core })

    const title = project.title as string
    const metaDescription = (project.metaDescription as string) || ''

    // 4. Generate LinkedIn summary
    const linkedinResult = await callModel('drafting', [
      {
        role: 'system',
        content: `You are writing a LinkedIn post for Kiuli, a luxury African safari company.\n\n${voicePrompt}\n\nLinkedIn posts should be professional, insightful, and position Kiuli as a thought leader in luxury safari travel. Include a hook in the first line. No hashtags. No emojis.`,
      },
      {
        role: 'user',
        content: `Write a LinkedIn post promoting this article.

TITLE: ${title}
SUMMARY: ${metaDescription}

ARTICLE EXCERPT (first 2000 chars):
${bodyText.substring(0, 2000)}

REQUIREMENTS:
- 150-200 words
- Professional and insightful tone
- Open with an attention-grabbing first line
- Include one key insight from the article
- End with a soft call to action (read more, link to article)
- No hashtags, no emojis

Return ONLY the post text.`,
      },
    ], {
      maxTokens: 512,
      temperature: 0.6,
    })

    // 5. Generate Facebook summary
    const facebookResult = await callModel('drafting', [
      {
        role: 'system',
        content: `You are writing a Facebook post for Kiuli, a luxury African safari company.\n\n${voicePrompt}\n\nFacebook posts should be warmer and more conversational than LinkedIn, but still authoritative. No emojis.`,
      },
      {
        role: 'user',
        content: `Write a Facebook post promoting this article.

TITLE: ${title}
SUMMARY: ${metaDescription}

ARTICLE EXCERPT (first 2000 chars):
${bodyText.substring(0, 2000)}

REQUIREMENTS:
- 100-150 words
- Warm, conversational, engagement-oriented
- Share one compelling detail or insight
- End with something that invites discussion or clicks
- No emojis

Return ONLY the post text.`,
      },
    ], {
      maxTokens: 512,
      temperature: 0.6,
    })

    // 6. Generate Facebook pinned comment
    const pinnedResult = await callModel('drafting', [
      {
        role: 'system',
        content: `You write concise calls to action for Kiuli's Facebook posts. Warm but direct.`,
      },
      {
        role: 'user',
        content: `Write a pinned comment for the Facebook post about: ${title}

REQUIREMENTS:
- 1-2 sentences
- Soft call to action (planning a safari, talk to our designers, etc.)
- Warm and inviting, not salesy
- No emojis

Return ONLY the comment text.`,
      },
    ], {
      maxTokens: 128,
      temperature: 0.5,
    })

    // 7. Write to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        linkedinSummary: linkedinResult.content.trim(),
        facebookSummary: facebookResult.content.trim(),
        facebookPinnedComment: pinnedResult.content.trim(),
      },
    })

    console.log(`[social-summariser] Generated social summaries for project ${projectId}`)
  } catch (err) {
    // Social summaries are non-critical — log but don't fail the project
    console.error(`[social-summariser] Failed for project ${projectId}:`, err)
  }
}
