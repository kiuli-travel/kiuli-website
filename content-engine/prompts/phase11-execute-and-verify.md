# Phase 11 — Execute Migration, Seed, and Verify

## Context

Phase 11 (BrandVoice Global + Drafting Pipeline) code is fully committed and builds clean. The migration has NOT been run. The seed script has NOT been run. You need to execute both, then verify everything works with ungameable tests.

## What Was Built

**Phase 11a** — BrandVoice global (4-layer architecture), voice loader with caching, conversation handler update_voice action, enhancer migration to loadVoiceForSection.

**Phase 11b** — Drafting pipeline: article-drafter, destination-page-drafter, property-page-drafter, segment-enhancer, social-summariser, dispatch router, /api/content/draft route, triggerDraft server action.

**Migration file:** `src/migrations/20260216_add_brand_voice_global.ts` — creates 12 tables + 4 enum types.

**Seed file:** `scripts/seed-brand-voice.ts` — populates all 4 layers with initial Kiuli voice data, migrates legacy voice-configuration records.

---

## Step 1: Run the Migration

```bash
npx payload migrate
```

Verify the migration completed without errors. Then confirm with:

```bash
npx payload migrate:status
```

The `20260216_add_brand_voice_global` row must show `Yes` in the Ran column.

---

## Step 2: Verify Migration Created All Tables

Query the database directly using psql or equivalent. Every one of these 11 tables must exist:

1. `brand_voice`
2. `brand_voice_principles`
3. `brand_voice_banned_phrases`
4. `brand_voice_anti_patterns`
5. `brand_voice_gold_standard`
6. `brand_voice_content_type_guidance`
7. `brand_voice_section_guidance`
8. `brand_voice_section_guidance_do_list`
9. `brand_voice_section_guidance_dont_list`
10. `brand_voice_section_guidance_examples`
11. `brand_voice_evolution_log`

**Ungameable test:** Run this SQL and confirm the count is exactly 11:

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'brand_voice%';
```

Verify all 4 enum types exist:

```sql
SELECT typname FROM pg_type WHERE typname LIKE 'enum_brand_voice%' ORDER BY typname;
```

Expected exactly 4 rows:
- `enum_brand_voice_content_type_guidance_content_type`
- `enum_brand_voice_evolution_log_source`
- `enum_brand_voice_gold_standard_content_type`
- `enum_brand_voice_section_guidance_content_type`

---

## Step 3: Verify Table Schemas

Main table columns:

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'brand_voice' ORDER BY ordinal_position;
```

Expected: `id`, `voice_summary`, `audience`, `positioning`, `updated_at`, `created_at`.

Child table (principles):

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'brand_voice_principles' ORDER BY ordinal_position;
```

Expected: `_order`, `_parent_id`, `id`, `principle`, `explanation`, `example`.

Nested child (do_list — parent_id must be varchar referencing section_guidance.id):

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'brand_voice_section_guidance_do_list' ORDER BY ordinal_position;
```

Expected: `_order`, `_parent_id` (character varying), `id`, `item`.

---

## Step 4: Run the Seed Script

```bash
npx tsx scripts/seed-brand-voice.ts
```

Must complete without errors.

---

## Step 5: Verify Seed Data

Run every one of these queries. Every expected value must match exactly.

```sql
-- 1 row, all non-null
SELECT id, voice_summary IS NOT NULL AS has_summary, audience IS NOT NULL AS has_audience, positioning IS NOT NULL AS has_positioning FROM brand_voice;
```

```sql
-- Must return 7
SELECT COUNT(*) FROM brand_voice_principles;
```

```sql
-- Must return 11
SELECT COUNT(*) FROM brand_voice_banned_phrases;
```

```sql
-- Must return 5
SELECT COUNT(*) FROM brand_voice_anti_patterns;
```

```sql
-- Must return 2
SELECT COUNT(*) FROM brand_voice_gold_standard;
```

```sql
-- Must return 6
SELECT COUNT(*) FROM brand_voice_content_type_guidance;
```

```sql
-- Must return 17
SELECT COUNT(*) FROM brand_voice_section_guidance;
```

```sql
-- Must return 1
SELECT COUNT(*) FROM brand_voice_evolution_log;
```

```sql
-- Must be > 0
SELECT COUNT(*) FROM brand_voice_section_guidance_do_list;
```

```sql
-- Must be > 0
SELECT COUNT(*) FROM brand_voice_section_guidance_dont_list;
```

```sql
-- Must return exactly 1 row
SELECT phrase FROM brand_voice_banned_phrases WHERE phrase = 'nestled';
```

```sql
-- Must return 6 distinct content types
SELECT content_type, label FROM brand_voice_content_type_guidance ORDER BY content_type;
```

```sql
-- Must return 6 rows: day_title, faq_answer, investment_includes, overview, segment_description, why_kiuli
SELECT content_type, section_key FROM brand_voice_section_guidance WHERE content_type = 'itinerary_enhancement' ORDER BY section_key;
```

---

## Step 6: Test BrandVoice Global via Payload API

The global has `read: () => true`, so no auth needed. Start the dev server if not running.

```bash
curl -s "http://localhost:3000/api/globals/brand-voice" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const d = JSON.parse(Buffer.concat(chunks).toString());
  const r = {
    hasSummary: (d.voiceSummary || '').length > 0,
    principleCount: (d.principles || []).length,
    bannedCount: (d.bannedPhrases || []).length,
    antiPatternCount: (d.antiPatterns || []).length,
    goldCount: (d.goldStandard || []).length,
    typeGuidanceCount: (d.contentTypeGuidance || []).length,
    sectionGuidanceCount: (d.sectionGuidance || []).length,
    evolutionCount: (d.evolutionLog || []).length
  };
  const expected = { hasSummary: true, principleCount: 7, bannedCount: 11, antiPatternCount: 5, goldCount: 2, typeGuidanceCount: 6, sectionGuidanceCount: 17, evolutionCount: 1 };
  let pass = true;
  for (const [k, v] of Object.entries(expected)) {
    const ok = r[k] === v;
    if (!ok) pass = false;
    console.log((ok ? 'PASS' : 'FAIL') + ': ' + k + ' = ' + r[k] + ' (expected ' + v + ')');
  }
  console.log('\nOVERALL: ' + (pass ? 'PASS' : 'FAIL'));
  process.exit(pass ? 0 : 1);
});
"
```

---

## Step 7: Test Voice Loader Code Paths

Create `scripts/test-voice-loader.ts` with the content below, run it, then delete it after it passes.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadCoreVoice, loadVoiceForContentType, loadFullVoice, loadVoiceForSection } from '../content-system/voice/loader'

async function test() {
  await getPayload({ config: configPromise })

  console.log('=== Test 1: loadCoreVoice ===')
  const core = await loadCoreVoice()
  const t1 = [
    ['summary non-empty', core.summary.length > 0],
    ['7 principles', core.principles.length === 7],
    ['11 banned phrases', core.bannedPhrases.length === 11],
    ['5 anti-patterns', core.antiPatterns.length === 5],
    ['2 gold standard', core.goldStandard.length === 2],
    ['audience non-empty', core.audience.length > 0],
    ['positioning non-empty', core.positioning.length > 0],
    ['first principle has name', core.principles[0].principle.length > 0],
    ['first principle has explanation', core.principles[0].explanation.length > 0],
    ['nestled in banned', core.bannedPhrases.some(b => b.phrase === 'nestled')],
  ] as const
  for (const [label, ok] of t1) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 2: loadVoiceForContentType (destination_page) ===')
  const dv = await loadVoiceForContentType('destination_page')
  const t2 = [
    ['core loaded', dv.core.summary.length > 0],
    ['contentType found', dv.contentType !== undefined],
    ['correct type', dv.contentType?.contentType === 'destination_page'],
    ['objective non-empty', (dv.contentType?.objective || '').length > 0],
    ['temperature > 0', (dv.contentType?.temperature || 0) > 0],
  ] as const
  for (const [label, ok] of t2) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 3: loadVoiceForContentType (nonexistent) ===')
  const nv = await loadVoiceForContentType('fake_type')
  const t3 = [
    ['core still loads', nv.core.summary.length > 0],
    ['contentType undefined', nv.contentType === undefined],
  ] as const
  for (const [label, ok] of t3) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 4: loadFullVoice (destination_page) ===')
  const full = await loadFullVoice('destination_page')
  const sectionKeys = (full.sections || []).map(s => s.sectionKey).sort()
  const expectedKeys = ['faq', 'getting_there', 'health_safety', 'investment_expectation', 'key_experiences', 'overview', 'top_lodges', 'when_to_visit', 'why_choose']
  const overviewSection = (full.sections || []).find(s => s.sectionKey === 'overview')
  const t4 = [
    ['core loaded', full.core.summary.length > 0],
    ['contentType loaded', full.contentType !== undefined],
    ['9 sections', (full.sections || []).length === 9],
    ['section keys match', JSON.stringify(sectionKeys) === JSON.stringify(expectedKeys)],
    ['overview doList populated', (overviewSection?.doList || []).length > 0],
    ['overview dontList populated', (overviewSection?.dontList || []).length > 0],
    ['overview objective non-empty', (overviewSection?.objective || '').length > 0],
  ] as const
  for (const [label, ok] of t4) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 5: loadFullVoice (itinerary_enhancement) ===')
  const itinFull = await loadFullVoice('itinerary_enhancement')
  const itinKeys = (itinFull.sections || []).map(s => s.sectionKey).sort()
  const expectedItinKeys = ['day_title', 'faq_answer', 'investment_includes', 'overview', 'segment_description', 'why_kiuli']
  const t5 = [
    ['6 sections', (itinFull.sections || []).length === 6],
    ['keys match', JSON.stringify(itinKeys) === JSON.stringify(expectedItinKeys)],
  ] as const
  for (const [label, ok] of t5) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 6: loadVoiceForSection (segment_description) ===')
  const sv = await loadVoiceForSection('itinerary_enhancement', 'segment_description')
  const t6 = [
    ['core loaded', sv.core.summary.length > 0],
    ['1 section returned', (sv.sections || []).length === 1],
    ['correct section', sv.sections?.[0]?.sectionKey === 'segment_description'],
    ['promptTemplate non-empty', (sv.sections?.[0]?.promptTemplate || '').length > 0],
  ] as const
  for (const [label, ok] of t6) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 7: loadVoiceForSection (nonexistent) ===')
  const ns = await loadVoiceForSection('destination_page', 'nonexistent_section')
  const t7 = [
    ['empty sections', (ns.sections || []).length === 0],
  ] as const
  for (const [label, ok] of t7) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('=== Test 8: loadFullVoice (property_page) ===')
  const pf = await loadFullVoice('property_page')
  const t8 = [
    ['2 sections', (pf.sections || []).length === 2],
  ] as const
  for (const [label, ok] of t8) { console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) throw new Error(`FAIL: ${label}`) }

  console.log('\n========================================')
  console.log('ALL VOICE LOADER TESTS PASSED')
  console.log('========================================')
  process.exit(0)
}

test().catch(err => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
```

Run: `npx tsx scripts/test-voice-loader.ts`

---

## Step 8: Test Prompt Builder

Create `scripts/test-prompt-builder.ts` with the content below, run it, then delete it after it passes.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadFullVoice } from '../content-system/voice/loader'
import { buildVoicePrompt } from '../content-system/voice/prompt-builder'

async function test() {
  await getPayload({ config: configPromise })

  console.log('=== Test: buildVoicePrompt ===')
  const voice = await loadFullVoice('destination_page')
  const prompt = buildVoicePrompt(voice)

  const checks = [
    ['is string', typeof prompt === 'string'],
    ['> 100 chars', prompt.length > 100],
    ['contains voice content', prompt.includes('quiet confidence') || prompt.includes('Kiuli')],
    ['mentions banned phrases', prompt.includes('nestled') || prompt.includes('banned') || prompt.includes('Banned')],
    ['mentions content type', prompt.includes('destination_page') || prompt.includes('Destination')],
  ] as const

  for (const [label, ok] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) throw new Error(`FAIL: ${label}`)
  }

  console.log(`\nPrompt length: ${prompt.length} chars`)
  console.log('First 500 chars:')
  console.log(prompt.substring(0, 500))
  console.log('...\n')
  console.log('PASS: buildVoicePrompt generates non-trivial prompt with voice content')
  process.exit(0)
}

test().catch(err => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
```

Run: `npx tsx scripts/test-prompt-builder.ts`

---

## Step 9: Test Draft Endpoint Auth

With the dev server running:

```bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/content/draft" -H "Content-Type: application/json" -d '{"projectId": 999}')
echo "Draft endpoint without auth: $STATUS (expected 401)"
if [ "$STATUS" = "401" ]; then echo "PASS"; else echo "FAIL"; fi
```

---

## Step 10: Cleanup

Delete the test scripts:

```bash
rm -f scripts/test-voice-loader.ts scripts/test-prompt-builder.ts
```

---

## Step 11: Final Verification Summary

Output this exact format with actual values:

```
PHASE 11 VERIFICATION COMPLETE
================================

MIGRATION
- Ran: YES/NO
- Tables created: X/11
- Enum types created: X/4

SEED DATA
- brand_voice row: EXISTS/MISSING
- Principles: X (expected 7)
- Banned phrases: X (expected 11)
- Anti-patterns: X (expected 5)
- Gold standard: X (expected 2)
- Content type guidance: X (expected 6)
- Section guidance: X (expected 17)
- Evolution log: X (expected 1)
- Do list items: X (expected > 0)
- Dont list items: X (expected > 0)

VOICE LOADER
- loadCoreVoice: PASS/FAIL
- loadVoiceForContentType: PASS/FAIL
- loadVoiceForContentType (unknown): PASS/FAIL
- loadFullVoice (destination_page, 9 sections): PASS/FAIL
- loadFullVoice (itinerary_enhancement, 6 sections): PASS/FAIL
- loadFullVoice (property_page, 2 sections): PASS/FAIL
- loadVoiceForSection (specific): PASS/FAIL
- loadVoiceForSection (nonexistent): PASS/FAIL

PROMPT BUILDER
- Generates non-trivial prompt: PASS/FAIL
- Contains voice content: PASS/FAIL

API
- BrandVoice global readable: PASS/FAIL
- Draft endpoint auth check (401): PASS/FAIL

OVERALL: PASS/FAIL
```

---

## Rules

- Do NOT skip any test. Every test listed above must be executed.
- Do NOT report PASS unless the actual output matches expected values.
- If any test fails, STOP and report the failure with full error output before continuing.
- Do NOT modify any source code unless a test failure reveals a bug that you can fix AND you explain what the bug is and why the fix is correct.
- If the migration fails, do NOT run raw SQL as a workaround. Report the migration error.
- Clean up test scripts after all tests pass.
