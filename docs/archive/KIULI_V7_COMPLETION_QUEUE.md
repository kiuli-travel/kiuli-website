# KIULI V7 COMPLETION — VERIFIED MICRO-TASK QUEUE

**Purpose:** Complete V7 implementation for front-end readiness  
**Working Directory:** `/Users/grahamwallington/Projects/kiuli-website`  
**Execution:** Sequential, single task at a time  
**Status:** Ready for Claude CLI

---

## SUCCESS CRITERIA (from V7 Spec)

1. All text fields follow `*Itrvl` / `*Enhanced` / `*Reviewed` pattern
2. iTrvl fields read-only in admin UI
3. Enhanced fields editable
4. Publish blocked until all items reviewed
5. Front-end receives resolved single fields
6. Voice configuration editable in admin
7. All data gaps fixed

---

## PHASE 1: VERIFICATION — What Exists vs What's Missing

### V1.1: Verify Schema Fields Exist

**Task:** Check database has all V7 fields

**Commands:**
```bash
curl -s "https://admin.kiuli.com/api/itineraries/14" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('ROOT FIELDS:')
print('  titleItrvl:', 'EXISTS' if 'titleItrvl' in d else 'MISSING')
print('  titleEnhanced:', 'EXISTS' if 'titleEnhanced' in d else 'MISSING')
print('  titleReviewed:', 'EXISTS' if 'titleReviewed' in d else 'MISSING')
print('  metaTitleItrvl:', 'EXISTS' if 'metaTitleItrvl' in d else 'MISSING')
print('  metaDescriptionItrvl:', 'EXISTS' if 'metaDescriptionItrvl' in d else 'MISSING')
print('  whyKiuliItrvl:', 'EXISTS' if 'whyKiuliItrvl' in d else 'MISSING')
print()
print('OVERVIEW FIELDS:')
if 'overview' in d:
  print('  summaryItrvl:', 'EXISTS' if 'summaryItrvl' in d['overview'] else 'MISSING')
  print('  summaryEnhanced:', 'EXISTS' if 'summaryEnhanced' in d['overview'] else 'MISSING')
print()
print('INVESTMENT FIELDS:')
if 'investmentLevel' in d:
  print('  includesItrvl:', 'EXISTS' if 'includesItrvl' in d['investmentLevel'] else 'MISSING')
  print('  includesEnhanced:', 'EXISTS' if 'includesEnhanced' in d['investmentLevel'] else 'MISSING')
print()
print('DAY FIELDS:')
if d.get('days') and len(d['days']) > 0:
  day = d['days'][0]
  print('  titleItrvl:', 'EXISTS' if 'titleItrvl' in day else 'MISSING')
  print('  titleEnhanced:', 'EXISTS' if 'titleEnhanced' in day else 'MISSING')
  if day.get('segments') and len(day['segments']) > 0:
    seg = day['segments'][0]
    print('  segment descriptionItrvl:', 'EXISTS' if 'descriptionItrvl' in seg else 'MISSING')
    print('  segment descriptionEnhanced:', 'EXISTS' if 'descriptionEnhanced' in seg else 'MISSING')
print()
print('FAQ FIELDS:')
if d.get('faqItems') and len(d['faqItems']) > 0:
  faq = d['faqItems'][0]
  print('  questionItrvl:', 'EXISTS' if 'questionItrvl' in faq else 'MISSING')
  print('  answerItrvl:', 'EXISTS' if 'answerItrvl' in faq else 'MISSING')
"
```

**Evidence Required:**
```
ROOT FIELDS:
  titleItrvl: EXISTS / MISSING
  titleEnhanced: EXISTS / MISSING
  titleReviewed: EXISTS / MISSING
  [all other fields...]

GATE: All fields must show "EXISTS"
```

**If MISSING:** Report which fields, stop queue, return to strategic planning

---

### V1.2: Verify Collections Exist

**Task:** Check VoiceConfiguration, Destinations, TripTypes collections

**Commands:**
```bash
echo "=== VOICE CONFIGURATION ==="
curl -s "https://admin.kiuli.com/api/voice-configuration" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', 'EXISTS' if 'docs' in d else 'MISSING'); print('Count:', d.get('totalDocs', 0))"

echo ""
echo "=== DESTINATIONS ==="
curl -s "https://admin.kiuli.com/api/destinations" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', 'EXISTS' if 'docs' in d else 'MISSING'); print('Count:', d.get('totalDocs', 0))"

echo ""
echo "=== TRIP TYPES ==="
curl -s "https://admin.kiuli.com/api/trip-types" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', 'EXISTS' if 'docs' in d else 'MISSING'); print('Count:', d.get('totalDocs', 0))"
```

**Evidence Required:**
```
VoiceConfiguration: EXISTS, Count: [number]
Destinations: EXISTS, Count: [number]
TripTypes: EXISTS, Count: [number]

GATE: All three must show "EXISTS"
```

---

### V1.3: Verify Transform Populates V7 Fields

**Task:** Check transform.js has V7 logic

**Commands:**
```bash
# Check if V7 fields are in transform output
cat lambda/pipeline-worker/phases/transform.js | grep "titleItrvl" && echo "✓ V7 pattern found" || echo "✗ V7 pattern missing"

# Check for data gap fixes
echo ""
echo "=== DATA GAP FIXES ==="
grep -q "generateDayTitle\|Stay.*inclusions\|Transfer.*to\|investmentLevel.*includes" lambda/pipeline-worker/phases/transform.js && echo "✓ Data gap logic present" || echo "✗ Data gap logic missing"
```

**Evidence Required:**
```
✓ V7 pattern found / ✗ V7 pattern missing
✓ Data gap logic present / ✗ Data gap logic missing

GATE: Both must show "✓"
```

---

### V1.4: Verify Enhancement API Exists

**Task:** Check /api/enhance endpoint

**Commands:**
```bash
# Check if file exists
if [ -f "src/app/(payload)/api/enhance/route.ts" ]; then
  echo "File: EXISTS"
  echo "Content preview:"
  head -30 src/app/\(payload\)/api/enhance/route.ts
else
  echo "File: MISSING"
fi
```

**Evidence Required:**
```
File: EXISTS / MISSING

GATE: Must show "EXISTS"
```

**If MISSING:** Add to implementation queue

---

### V1.5: Verify Field Resolution Hook

**Task:** Check beforeRead or afterRead hook exists

**Commands:**
```bash
# Check for resolveFields hook
if [ -f "src/collections/Itineraries/hooks/resolveFields.ts" ]; then
  echo "Hook file: EXISTS"
  head -20 src/collections/Itineraries/hooks/resolveFields.ts
else
  echo "Hook file: MISSING"
fi

# Check if hook is registered in collection
grep -r "resolveFields\|beforeRead\|afterRead" src/collections/Itineraries/index.ts | head -5
```

**Evidence Required:**
```
Hook file: EXISTS / MISSING
Hook registered: YES / NO

GATE: Both must be YES
```

---

### V1.6: Verify Admin UI Components

**Task:** Check FieldPairEditor and enhance buttons exist

**Commands:**
```bash
echo "=== FIELD PAIR EDITOR ==="
if [ -f "src/components/admin/FieldPairEditor.tsx" ]; then
  echo "FieldPairEditor: EXISTS"
else
  echo "FieldPairEditor: MISSING"
fi

echo ""
echo "=== ENHANCE BUTTON COMPONENTS ==="
find src/components -name "*Enhance*" -o -name "*enhance*" 2>/dev/null || echo "No enhance components found"

echo ""
echo "=== CUSTOM FIELD COMPONENTS ==="
find src/collections/Itineraries -name "*.tsx" 2>/dev/null | head -10 || echo "No custom field components"
```

**Evidence Required:**
```
FieldPairEditor: EXISTS / MISSING
Enhance components: [list or "none"]
Custom fields: [list or "none"]

GATE: FieldPairEditor must exist
```

**If MISSING:** Add to implementation queue

---

### V1.7: Verify Publish Blocking Logic

**Task:** Check if publish validation exists

**Commands:**
```bash
# Search for publish validation
grep -r "titleReviewed\|canPublish\|publishBlocker" src/collections/Itineraries/ || echo "No publish validation found"

# Check for beforeChange hook
grep -A 10 "beforeChange" src/collections/Itineraries/index.ts | head -15
```

**Evidence Required:**
```
Publish validation: FOUND / NOT FOUND
Hook location: [file path or "none"]

GATE: Must be FOUND
```

**If NOT FOUND:** Add to implementation queue

---

### V1.8: Test Enhancement in Admin UI

**Task:** Manual verification of enhancement workflow

**Commands:**
```bash
echo "MANUAL TEST REQUIRED:"
echo "1. Go to https://admin.kiuli.com/admin/collections/itineraries/14"
echo "2. Check for 'Enhance' button on titleItrvl field"
echo "3. Click 'Enhance' button"
echo "4. Record result"
echo ""
echo "Report: BUTTON_EXISTS / BUTTON_MISSING / BUTTON_ERROR"
```

**Evidence Required:**
```
Admin UI Test Result: [BUTTON_EXISTS / BUTTON_MISSING / BUTTON_ERROR]

If BUTTON_ERROR, paste error message.

GATE: Must be BUTTON_EXISTS and working
```

---

## VERIFICATION GATE CHECKPOINT

**Stop here and report:**

```
V7 VERIFICATION SUMMARY
=======================
V1.1 Schema Fields: PASS / FAIL (list missing)
V1.2 Collections: PASS / FAIL (list missing)
V1.3 Transform V7: PASS / FAIL
V1.4 Enhancement API: PASS / FAIL
V1.5 Field Resolution: PASS / FAIL
V1.6 Admin UI Components: PASS / FAIL
V1.7 Publish Blocking: PASS / FAIL
V1.8 Manual UI Test: PASS / FAIL

MISSING COMPONENTS:
- [list everything that failed]

GATE STATUS: PASS (proceed to Phase 2) / FAIL (implement missing)
```

**If any FAIL:** Proceed to Phase 2 (Implementation)  
**If all PASS:** V7 is complete, create completion report

---

## PHASE 2: IMPLEMENTATION — Build Missing Components

### I2.1: Create Enhancement API (if missing)

**Task:** Implement /api/enhance endpoint

**File:** `src/app/(payload)/api/enhance/route.ts`

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const { itineraryId, fieldPath, voiceConfig } = await request.json()

    // Validate inputs
    if (!itineraryId || !fieldPath || !voiceConfig) {
      return NextResponse.json(
        { error: 'Missing required fields: itineraryId, fieldPath, voiceConfig' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Get itinerary
    const itinerary = await payload.findByID({
      collection: 'itineraries',
      id: itineraryId,
      depth: 0,
    })

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // Get voice configuration
    const voiceConfigs = await payload.find({
      collection: 'voice-configuration',
      where: { name: { equals: voiceConfig } },
      limit: 1,
    })

    if (!voiceConfigs.docs.length) {
      return NextResponse.json(
        { error: `Voice configuration '${voiceConfig}' not found` },
        { status: 404 }
      )
    }

    const voice = voiceConfigs.docs[0]

    // Extract original content from fieldPath
    const originalContent = getFieldValue(itinerary, fieldPath + 'Itrvl')
    
    if (!originalContent) {
      return NextResponse.json(
        { error: 'No original content to enhance' },
        { status: 400 }
      )
    }

    // Call Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = `${voice.systemPrompt}\n\n${voice.userPromptTemplate.replace('{{content}}', extractText(originalContent))}`

    const result = await model.generateContent(prompt)
    const enhanced = result.response.text()

    // Update itinerary with enhanced content
    const updateData = {}
    setFieldValue(updateData, fieldPath + 'Enhanced', toRichText(enhanced))

    await payload.update({
      collection: 'itineraries',
      id: itineraryId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      enhanced: toRichText(enhanced),
    })

  } catch (error: any) {
    console.error('Enhancement error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Helper to get nested field value
function getFieldValue(obj: any, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj)
}

// Helper to set nested field value
function setFieldValue(obj: any, path: string, value: any): void {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {}
    return curr[key]
  }, obj)
  target[lastKey] = value
}

// Extract plain text from RichText
function extractText(richText: any): string {
  if (typeof richText === 'string') return richText
  if (!richText?.root?.children) return ''
  
  return richText.root.children
    .map((child: any) => 
      child.children?.map((c: any) => c.text || '').join('') || ''
    )
    .join('\n')
}

// Convert text to RichText
function toRichText(text: string): any {
  return {
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          text,
        }],
      }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
```

**Verification:**
```bash
# Test endpoint
curl -X POST "https://admin.kiuli.com/api/enhance" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  -H "Content-Type: application/json" \
  -d '{
    "itineraryId": "14",
    "fieldPath": "title",
    "voiceConfig": "itinerary-title"
  }'

# Should return: {"success": true, "enhanced": {...}}
```

**Evidence Required:**
```
File created: YES / NO
Endpoint responds: YES / NO
Enhancement works: YES / NO

GATE: All must be YES
```

**Commit:**
```bash
git add src/app/\(payload\)/api/enhance/
git commit -m "feat: implement /api/enhance endpoint for V7"
git push origin main
```

---

### I2.2: Create FieldPairEditor Component (if missing)

**Task:** Build reusable component for V7 field pairs

**File:** `src/components/admin/FieldPairEditor.tsx`

**Implementation:**
```typescript
'use client'

import React, { useState } from 'react'
import { Button } from '@payloadcms/ui'
import { useFormFields, useForm } from '@payloadcms/ui'

interface FieldPairEditorProps {
  itrvlFieldPath: string
  enhancedFieldPath: string
  reviewedFieldPath: string
  voiceConfig: string
  label: string
}

export const FieldPairEditor: React.FC<FieldPairEditorProps> = ({
  itrvlFieldPath,
  enhancedFieldPath,
  reviewedFieldPath,
  voiceConfig,
  label,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { getDataByPath, dispatchFields } = useForm()
  const itrvlValue = getDataByPath(itrvlFieldPath)
  const enhancedValue = getDataByPath(enhancedFieldPath)
  const reviewedValue = getDataByPath(reviewedFieldPath)

  const handleCopy = () => {
    dispatchFields({
      type: 'UPDATE',
      path: enhancedFieldPath,
      value: itrvlValue,
    })
  }

  const handleEnhance = async () => {
    setLoading(true)
    setError(null)

    try {
      const docId = getDataByPath('id')
      
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('payload-token')}`,
        },
        body: JSON.stringify({
          itineraryId: docId,
          fieldPath: enhancedFieldPath.replace('Enhanced', ''),
          voiceConfig,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Enhancement failed')
      }

      const data = await res.json()
      
      dispatchFields({
        type: 'UPDATE',
        path: enhancedFieldPath,
        value: data.enhanced,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #e5e5e5', borderRadius: '4px' }}>
      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
        {label}
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Button
          onClick={handleCopy}
          disabled={!itrvlValue || loading}
          size="small"
        >
          Copy to Enhanced
        </Button>
        
        <Button
          onClick={handleEnhance}
          disabled={!itrvlValue || loading}
          size="small"
          buttonStyle="primary"
        >
          {loading ? 'Enhancing...' : 'AI Enhance'}
        </Button>
      </div>

      {error && (
        <div style={{ color: 'red', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Error: {error}
        </div>
      )}
      
      <div style={{ fontSize: '0.875rem', color: '#666' }}>
        Original has content: {itrvlValue ? '✓' : '✗'} | 
        Enhanced: {enhancedValue ? '✓' : '✗'} | 
        Reviewed: {reviewedValue ? '✓' : '✗'}
      </div>
    </div>
  )
}
```

**Verification:**
```bash
# File exists
ls -la src/components/admin/FieldPairEditor.tsx

# Syntax check
npx tsc --noEmit src/components/admin/FieldPairEditor.tsx
```

**Evidence Required:**
```
File created: YES / NO
TypeScript valid: YES / NO

GATE: Both must be YES
```

**Commit:**
```bash
git add src/components/admin/FieldPairEditor.tsx
git commit -m "feat: create FieldPairEditor component for V7"
git push origin main
```

---

### I2.3: Add Custom Field to Title

**Task:** Replace title field with FieldPairEditor

**File:** `src/collections/Itineraries/fields/titleField.tsx`

**Implementation:**
```typescript
import type { Field } from 'payload'
import { FieldPairEditor } from '@/components/admin/FieldPairEditor'

export const titleField: Field = {
  type: 'ui',
  name: 'titleEditor',
  admin: {
    components: {
      Field: () => (
        <FieldPairEditor
          itrvlFieldPath="titleItrvl"
          enhancedFieldPath="titleEnhanced"
          reviewedFieldPath="titleReviewed"
          voiceConfig="itinerary-title"
          label="Title"
        />
      ),
    },
  },
}
```

**Then update:** `src/collections/Itineraries/index.ts`

**Add to fields array:**
```typescript
import { titleField } from './fields/titleField'

fields: [
  titleField,
  {
    name: 'titleItrvl',
    type: 'text',
    admin: { readOnly: true, hidden: true },
  },
  {
    name: 'titleEnhanced',
    type: 'text',
    admin: { hidden: true },
  },
  {
    name: 'titleReviewed',
    type: 'checkbox',
    admin: { hidden: true },
  },
  // ... rest of fields
]
```

**Verification:**
```bash
# Build and check
npm run build

# Manual test: Go to admin, check title field has enhance button
```

**Evidence Required:**
```
Build successful: YES / NO
Manual test: ENHANCE_BUTTON_VISIBLE / NOT_VISIBLE

GATE: Both must be YES
```

**Commit:**
```bash
git add src/collections/Itineraries/fields/titleField.tsx
git add src/collections/Itineraries/index.ts
git commit -m "feat: add FieldPairEditor to title field"
git push origin main
```

---

### I2.4: Add Publish Blocking Logic (if missing)

**Task:** Prevent publish until all reviewed

**File:** `src/collections/Itineraries/hooks/beforeChange.ts`

**Implementation:**
```typescript
import type { CollectionBeforeChangeHook } from 'payload'

export const beforeChangeHook: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  // Only validate on publish
  if (data._status === 'published' && operation === 'update') {
    const blockers: string[] = []

    // Check required reviews
    if (!data.titleReviewed) blockers.push('Title not reviewed')
    if (!data.metaTitleReviewed) blockers.push('Meta title not reviewed')
    if (!data.metaDescriptionReviewed) blockers.push('Meta description not reviewed')
    
    if (data.overview && !data.overview.summaryReviewed) {
      blockers.push('Overview summary not reviewed')
    }
    
    if (data.investmentLevel && !data.investmentLevel.includesReviewed) {
      blockers.push('Investment includes not reviewed')
    }

    // Check days
    data.days?.forEach((day: any, i: number) => {
      if (!day.titleReviewed) {
        blockers.push(`Day ${i + 1} title not reviewed`)
      }
      
      day.segments?.forEach((seg: any, j: number) => {
        if (!seg.descriptionReviewed) {
          blockers.push(`Day ${i + 1} segment ${j + 1} not reviewed`)
        }
      })
    })

    // Check FAQs
    data.faqItems?.forEach((faq: any, i: number) => {
      if (!faq.questionReviewed || !faq.answerReviewed) {
        blockers.push(`FAQ ${i + 1} not reviewed`)
      }
    })

    if (blockers.length > 0) {
      throw new Error(
        `Cannot publish: ${blockers.join(', ')}`
      )
    }
  }

  return data
}
```

**Register in:** `src/collections/Itineraries/index.ts`

```typescript
import { beforeChangeHook } from './hooks/beforeChange'

export const Itineraries: CollectionConfig = {
  // ...
  hooks: {
    beforeChange: [beforeChangeHook],
  },
}
```

**Verification:**
```bash
# Build
npm run build

# Manual test: Try to publish unreviewed itinerary
# Should get error message
```

**Evidence Required:**
```
Build successful: YES / NO
Publish blocked: YES / NO
Error message shown: YES / NO

GATE: All must be YES
```

**Commit:**
```bash
git add src/collections/Itineraries/hooks/beforeChange.ts
git add src/collections/Itineraries/index.ts
git commit -m "feat: add publish blocking for unreviewed content"
git push origin main
```

---

## PHASE 3: FINAL VERIFICATION

### F3.1: Test Complete Enhancement Workflow

**Task:** End-to-end test of V7 workflow

**Steps:**
1. Go to admin.kiuli.com/admin/collections/itineraries/14
2. Click "AI Enhance" on title field
3. Verify enhanced content appears
4. Check "Reviewed" checkbox
5. Try to publish (should block on other unreviewed fields)
6. Review all required fields
7. Publish successfully

**Evidence Required:**
```
Enhancement works: YES / NO
Reviewed checkbox works: YES / NO
Publish blocking works: YES / NO
Publish succeeds after review: YES / NO

GATE: All must be YES
```

---

### F3.2: Test Front-End Field Resolution

**Task:** Verify front-end receives clean fields

**Commands:**
```bash
# Get itinerary via API (simulates front-end request)
curl -s "https://admin.kiuli.com/api/itineraries/14" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)

print('FIELD RESOLUTION TEST:')
print('  title field exists:', 'title' in d)
print('  titleItrvl hidden:', 'titleItrvl' not in d)
print('  titleEnhanced hidden:', 'titleEnhanced' not in d)
print()
print('  title value:', d.get('title', 'MISSING'))
print()
print('  overview.summary exists:', 'summary' in d.get('overview', {}))
print('  days[0].title exists:', 'title' in d.get('days', [{}])[0] if d.get('days') else False)
"
```

**Evidence Required:**
```
title field exists: True / False
titleItrvl hidden: True / False
titleEnhanced hidden: True / False

GATE: All must match expected (True, True, True)
```

---

### F3.3: Fresh Scrape Test

**Task:** Create new itinerary and verify V7 structure

**Commands:**
```bash
# Trigger new scrape
curl -X POST "https://admin.kiuli.com/api/scrape-itinerary" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  -H "Content-Type: application/json" \
  -d '{
    "itrvlUrl": "https://itrvl.com/client/portal/Ir0nIrtJMhtj3RUzrj8Qyqw7XTIyA4NGk22g52ZHTmhD6IcgxNcRUNwhXTKXbgKa/680df70720a6c6005b2bfc34"
  }'

# Poll job status
JOB_ID="[from above]"
curl "https://admin.kiuli.com/api/job-status/$JOB_ID"

# When complete, verify new itinerary
ITINERARY_ID="[from job]"
curl "https://admin.kiuli.com/api/itineraries/$ITINERARY_ID" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('=== V7 VERIFICATION ===')
print('titleItrvl populated:', bool(d.get('titleItrvl')))
print('titleEnhanced is null:', d.get('titleEnhanced') is None)
print('titleReviewed is false:', d.get('titleReviewed') == False)
print('Days have titles:', all(day.get('titleItrvl') for day in d.get('days', [])))
print('Segments have descriptions:', all(seg.get('descriptionItrvl') for day in d.get('days', []) for seg in day.get('segments', [])))
print('FAQs populated:', len(d.get('faqItems', [])) > 0)
"
```

**Evidence Required:**
```
Scrape completes: YES / NO
titleItrvl populated: True / False
titleEnhanced is null: True / False
titleReviewed is false: True / False
Days have titles: True / False
FAQs populated: True / False

GATE: All must be True
```

---

## COMPLETION CHECKPOINT

After all tasks complete:

```
V7 IMPLEMENTATION — COMPLETE

VERIFICATION PHASE (V1.1-V1.8):
- Schema fields: PASS
- Collections: PASS
- Transform V7: PASS
- Enhancement API: PASS
- Field resolution: PASS
- Admin UI: PASS
- Publish blocking: PASS
- Manual UI test: PASS

IMPLEMENTATION PHASE (I2.1-I2.4):
[List only tasks that were needed]

FINAL VERIFICATION (F3.1-F3.3):
- Enhancement workflow: PASS
- Field resolution: PASS
- Fresh scrape: PASS

STATUS: V7 COMPLETE — READY FOR FRONT-END DEVELOPMENT

EVIDENCE:
- All enhance buttons working
- Publish blocking functional
- Fresh scrape creates V7-compliant itineraries
- Front-end receives clean resolved fields

Next: Front-end development can begin
```

---

## EXECUTION NOTES

- Execute ONE task at a time
- Each task has clear evidence requirements
- Gates must PASS before continuing
- No assumptions or guessing
- Report actual command outputs
- Commit after each implementation task

**Ready for Claude CLI autonomous execution.**
