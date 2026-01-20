import { getPayload } from 'payload';
import config from '@payload-config';

// Types
interface VoiceConfig {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  maxWords: number | null;
  temperature: number;
  examples?: Array<{ before: string; after: string }>;
  antiPatterns?: Array<{ pattern: string; reason: string }>;
}

interface EnhanceResult {
  enhanced: string;
  tokensUsed: number;
  configUsed: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

/**
 * Fetch voice configuration from Payload CMS
 */
async function getVoiceConfig(configName: string): Promise<VoiceConfig> {
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: configName } },
    limit: 1,
  });

  if (!result.docs[0]) {
    throw new Error(`Voice configuration '${configName}' not found`);
  }

  return result.docs[0] as unknown as VoiceConfig;
}

/**
 * Build the system prompt from voice config
 */
function buildSystemPrompt(voiceConfig: VoiceConfig): string {
  let systemPrompt = voiceConfig.systemPrompt;

  // Add anti-patterns if defined
  if (voiceConfig.antiPatterns?.length) {
    systemPrompt += '\n\nAVOID THESE PATTERNS:\n';
    voiceConfig.antiPatterns.forEach(ap => {
      systemPrompt += `- "${ap.pattern}" — ${ap.reason}\n`;
    });
  }

  // Add examples if defined
  if (voiceConfig.examples?.length) {
    systemPrompt += '\n\nEXAMPLES:\n';
    voiceConfig.examples.forEach((ex, i) => {
      systemPrompt += `\nExample ${i + 1}:\n`;
      systemPrompt += `BEFORE: ${ex.before}\n`;
      systemPrompt += `AFTER: ${ex.after}\n`;
    });
  }

  return systemPrompt;
}

/**
 * Build the user prompt from template and context
 */
function buildUserPrompt(
  template: string,
  content: string,
  context: Record<string, string>,
  maxWords: number | null
): string {
  let userPrompt = template;

  // Replace context placeholders
  for (const [key, value] of Object.entries(context)) {
    userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }

  // Replace content placeholder
  userPrompt = userPrompt.replace(/{{content}}/g, content);

  // Replace maxWords placeholder
  if (maxWords) {
    userPrompt = userPrompt.replace(/{{maxWords}}/g, String(maxWords));
  }

  return userPrompt;
}

/**
 * Main enhancement function using OpenRouter
 */
export async function enhanceContent(
  content: string,
  configName: string,
  context: Record<string, string> = {}
): Promise<EnhanceResult> {
  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set');
  }

  // 1. Fetch voice configuration
  const voiceConfig = await getVoiceConfig(configName);

  // 2. Build prompts
  const systemPrompt = buildSystemPrompt(voiceConfig);
  const userPrompt = buildUserPrompt(
    voiceConfig.userPromptTemplate,
    content,
    context,
    voiceConfig.maxWords
  );

  // 3. Call OpenRouter API with Claude
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kiuli.com',
      'X-Title': 'Kiuli Enhancement Service',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: voiceConfig.maxWords ? voiceConfig.maxWords * 4 : 1000,
      temperature: voiceConfig.temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;

  const enhanced = data.choices[0]?.message?.content?.trim();
  if (!enhanced) {
    throw new Error('No content in OpenRouter response');
  }

  const tokensUsed = data.usage?.total_tokens || 0;

  return {
    enhanced,
    tokensUsed,
    configUsed: configName,
  };
}

/**
 * Extract plain text from Payload RichText format
 */
export function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return '';

  const root = (richText as { root?: unknown }).root;
  if (!root || typeof root !== 'object') return '';

  function extractText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';

    const n = node as { type?: string; text?: string; children?: unknown[] };

    if (n.type === 'text' && typeof n.text === 'string') {
      return n.text;
    }

    if (Array.isArray(n.children)) {
      return n.children.map(extractText).join(' ');
    }

    return '';
  }

  return extractText(root).trim();
}
