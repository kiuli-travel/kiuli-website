// src/lib/traffic-source.ts — Shared traffic source detection
// Specification: PHASE_7_OUTCOMES.md section 3.1

const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo', 'ecosia', 'baidu', 'yandex']
const AI_PLATFORMS = ['chatgpt', 'perplexity', 'claude', 'gemini', 'copilot', 'searchgpt', 'ai']
const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'x', 'pinterest', 'tiktok', 'youtube']
const EMAIL_SOURCES = ['email', 'newsletter', 'mailchimp']
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid']

const REFERRER_SEARCH_ENGINES = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'ecosia.org', 'baidu.com', 'yandex.com']
const REFERRER_AI_PLATFORMS = ['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com']
const REFERRER_SOCIAL = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'pinterest.com', 'tiktok.com', 'youtube.com', 't.co']

export function detectTrafficSource(params: {
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  referrer?: string | null
}): string {
  const { gclid, gbraid, wbraid, utmSource, utmMedium, referrer } = params

  // Priority 1: Google Ads click IDs
  if (gclid || gbraid || wbraid) return 'google_ads'

  if (utmSource) {
    const source = utmSource.toLowerCase()
    const medium = utmMedium?.toLowerCase() || ''

    // Priority 2: Paid (non-Google) — utmSource present + paid medium
    if (PAID_MEDIUMS.includes(medium)) return 'paid_other'

    // Priority 3: Organic search engines
    if (SEARCH_ENGINES.includes(source)) return 'organic_search'

    // Priority 4: AI search platforms
    if (AI_PLATFORMS.includes(source)) return 'ai_search'

    // Priority 5: Social platforms
    if (SOCIAL_PLATFORMS.includes(source)) return 'social'

    // Priority 6: Email sources
    if (EMAIL_SOURCES.includes(source)) return 'email'

    // Priority 7: Partner referral
    if (source === 'partner') return 'partner_referral'

    // Priority 8: UTM source present but unrecognized
    return 'other'
  }

  // No utmSource — check referrer hostname
  if (referrer) {
    try {
      const hostname = new URL(referrer).hostname

      // Priority 9: Referrer is a search engine
      if (REFERRER_SEARCH_ENGINES.some((domain) => hostname.includes(domain))) return 'organic_search'

      // Priority 10: Referrer is an AI platform
      if (REFERRER_AI_PLATFORMS.some((domain) => hostname.includes(domain))) return 'ai_search'

      // Priority 11: Referrer is a social platform
      if (REFERRER_SOCIAL.some((domain) => hostname.includes(domain))) return 'social'

      // Priority 12: Referrer is present but unknown
      return 'referral'
    } catch {
      // Invalid referrer URL — treat as no referrer
    }
  }

  // Priority 13: No utmSource, no referrer
  return 'direct'
}
