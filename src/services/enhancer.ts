import { GoogleGenerativeAI } from '@google/generative-ai';
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
 * Main enhancement function
 *
 * @param content - The original content to enhance
 * @param configName - The voice configuration name (e.g., "segment-description")
 * @param context - Additional context for the prompt (e.g., { segmentType: "stay", location: "Masai Mara" })
 */
export async function enhanceContent(
  content: string,
  configName: string,
  context: Record<string, string> = {}
): Promise<EnhanceResult> {
  // Validate API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
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

  // 3. Initialize Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  // 4. Call Gemini AI
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: voiceConfig.temperature,
      maxOutputTokens: voiceConfig.maxWords ? voiceConfig.maxWords * 4 : 1000,
    },
  });

  const response = result.response;
  const enhanced = response.text().trim();

  // Calculate approximate tokens used (rough estimate)
  const tokensUsed = Math.ceil((userPrompt.length + enhanced.length) / 4);

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
