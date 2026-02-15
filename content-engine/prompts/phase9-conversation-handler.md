# Phase 9: Conversation Handler

## Context

Phase 8 complete. The conversation directory has stub files (type declarations only). The ContentProjects collection has a Conversation tab with messages array (role, content, timestamp, actions fields). The OpenRouter client has a purpose-based model selector with 'editing' purpose. The embedding store and research compiler are operational.

Existing infrastructure:
- `content-system/conversation/types.ts` — interfaces defined (ConversationMessage, ConversationAction, ConversationContext, ConversationResponse, HandleMessageOptions, ContextBuilderOptions)
- `content-system/conversation/context-builder.ts` — stub (declare only)
- `content-system/conversation/handler.ts` — stub (declare only)
- `content-system/openrouter-client.ts` — working callModel with 'editing' purpose
- `content-system/embeddings/query.ts` — working semanticSearch
- `content-system/embeddings/lexical-text.ts` — extractTextFromLexical utility
- `content-system/research/research-compiler.ts` — working compileResearch
- `src/collections/ContentProjects/index.ts` — messages array in Conversation tab with role (designer|kiuli), content (textarea), timestamp (date), actions (json)
- `src/app/(payload)/api/content/research/route.ts` — has `markdownToLexical()` utility (copy this, don't import from route file)

No existing conversation API route.

## What the Conversation Handler Does

The designer opens a Content Project workspace (Phase 10 builds the full UI). They type a message. Kiuli responds with knowledge of the project's full state — its brief, research, draft, metadata, editorial directives, and related content from the embedding store. Kiuli can also perform structured actions: editing fields, rewriting sections, advancing stages.

The conversation is the collaboration surface. It replaces clicking around admin fields. The designer says "tighten the overview section" and Kiuli rewrites it. The designer says "add a note about gorilla permit costs" and Kiuli edits the draft. The designer says "this looks good, advance to review" and Kiuli changes the stage.

## Task 1: Update Types

Update `content-system/conversation/types.ts` to be comprehensive. The existing interfaces are close but need additions:

```typescript
export interface ConversationMessage {
  role: 'designer' | 'kiuli'
  content: string
  timestamp: string
  actions?: ConversationAction[]
}

export interface ConversationAction {
  type: 'edit_field' | 'rewrite_section' | 'stage_change' | 'trigger_research' | 'trigger_draft'
  field?: string           // which field was edited (e.g., 'body', 'metaTitle', 'sections.overview')
  sectionName?: string     // for compound types: which section
  before?: string          // previous value (truncated to 200 chars for storage)
  after?: string           // new value (truncated to 200 chars for storage)
  details?: Record<string, unknown>
}

export interface ConversationContext {
  projectId: number
  title: string
  stage: string
  contentType: string
  // Brief fields (if populated)
  briefSummary?: string
  targetAngle?: string
  competitiveNotes?: string
  // Research (if populated)
  synthesisText?: string    // plain text extracted from Lexical richText
  sourcesSummary?: string   // formatted list of sources
  // Draft (if populated)
  draftText?: string        // plain text extracted from body richText
  sections?: Record<string, string>  // for compound types: section name → plain text
  faqItems?: Array<{ question: string; answer: string }>
  metaTitle?: string
  metaDescription?: string
  answerCapsule?: string
  // Metadata
  destinations?: string[]
  properties?: string[]
  species?: string[]
  // Context from embedding store
  relatedContent?: string   // formatted results from semantic search
  // Active editorial directives
  activeDirectives?: string  // formatted list of active directives
  // Recent conversation history
  recentMessages: ConversationMessage[]
}

export interface ConversationResponse {
  message: string
  actions: ConversationAction[]
  suggestedNextStep?: string
}

export interface HandleMessageOptions {
  projectId: number
  message: string
}

export interface ContextBuilderOptions {
  projectId: number
  maxMessages?: number       // default 20
}
```

## Task 2: Context Builder

Replace `content-system/conversation/context-builder.ts` stub with full implementation.

```typescript
export async function buildContext(options: ContextBuilderOptions): Promise<ConversationContext> {
  const { projectId, maxMessages = 20 } = options

  const payload = await getPayload({ config: configPromise })

  // 1. Fetch the ContentProject with all fields
  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  // 2. Extract plain text from richText fields
  const synthesisText = project.synthesis
    ? extractTextFromLexical(project.synthesis)
    : undefined

  const draftText = project.body
    ? extractTextFromLexical(project.body)
    : undefined

  const existingSiteContentText = project.existingSiteContent
    ? extractTextFromLexical(project.existingSiteContent)
    : undefined

  // 3. Format sources
  const sources = Array.isArray(project.sources) ? project.sources : []
  const sourcesSummary = sources.length > 0
    ? sources.map((s: any) => `- ${s.title} (${s.credibility}): ${s.url}`).join('\n')
    : undefined

  // 4. Extract sections for compound types
  let sections: Record<string, string> | undefined
  if (project.sections && typeof project.sections === 'object') {
    sections = {}
    const rawSections = typeof project.sections === 'string'
      ? JSON.parse(project.sections)
      : project.sections
    for (const [key, value] of Object.entries(rawSections)) {
      sections[key] = typeof value === 'string' ? value : extractTextFromLexical(value)
    }
  }

  // 5. Parse FAQ items
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection : []
  const faqItems = rawFaq.map((f: any) => ({
    question: f.question || '',
    answer: f.answer || '',
  }))

  // 6. Parse destinations, properties, species from JSON fields
  const destinations = parseJsonArray(project.destinations)
  const properties = parseJsonArray(project.properties)
  const species = parseJsonArray(project.species)

  // 7. Query embedding store for related content
  const searchQuery = [project.title, project.targetAngle, ...(destinations || [])]
    .filter(Boolean).join(' ')
  let relatedContent: string | undefined
  if (searchQuery) {
    try {
      const results = await semanticSearch(searchQuery, {
        topK: 5,
        minScore: 0.3,
        excludeProjectId: projectId,
      })
      if (results.length > 0) {
        relatedContent = results
          .map(r => `[${r.chunkType}] (score: ${r.score.toFixed(2)}) ${r.chunkText.substring(0, 300)}`)
          .join('\n\n')
      }
    } catch (err) {
      console.warn('[context-builder] Embedding search failed:', err)
    }
  }

  // 8. Load active editorial directives
  let activeDirectives: string | undefined
  try {
    const dirResult = await payload.find({
      collection: 'editorial-directives',
      where: { active: { equals: true } },
      limit: 50,
      depth: 0,
    })
    if (dirResult.docs.length > 0) {
      activeDirectives = dirResult.docs
        .map((d: any) => `- ${d.text}`)
        .join('\n')
    }
  } catch (err) {
    console.warn('[context-builder] Directive load failed:', err)
  }

  // 9. Extract recent messages from the project's messages array
  const allMessages = Array.isArray(project.messages) ? project.messages : []
  const recentMessages: ConversationMessage[] = allMessages
    .slice(-maxMessages)
    .map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      actions: m.actions ? (typeof m.actions === 'string' ? JSON.parse(m.actions) : m.actions) : undefined,
    }))

  return {
    projectId,
    title: project.title as string,
    stage: project.stage as string,
    contentType: project.contentType as string,
    briefSummary: project.briefSummary as string | undefined,
    targetAngle: project.targetAngle as string | undefined,
    competitiveNotes: project.competitiveNotes as string | undefined,
    synthesisText,
    sourcesSummary,
    draftText,
    sections,
    faqItems: faqItems.length > 0 ? faqItems : undefined,
    metaTitle: project.metaTitle as string | undefined,
    metaDescription: project.metaDescription as string | undefined,
    answerCapsule: project.answerCapsule as string | undefined,
    destinations,
    properties,
    species,
    relatedContent,
    activeDirectives,
    recentMessages,
  }
}
```

Helper function `parseJsonArray` — same pattern as in candidate-filter.ts. Parse JSON string arrays or return actual arrays.

## Task 3: Conversation Handler

Replace `content-system/conversation/handler.ts` stub with full implementation.

The handler:
1. Builds context
2. Formats system prompt + conversation history
3. Sends to OpenRouter (editing model)
4. Parses response for structured actions
5. Applies actions to the ContentProject
6. Stores messages
7. Returns response

### System Prompt

The system prompt must tell the model:
- Who it is (Kiuli content assistant for luxury African safari travel)
- What project it's working on (title, type, stage, destinations)
- The project's current state (brief, research, draft depending on stage)
- Active editorial directives to respect
- Related content from the embedding store for consistency
- What actions it can take
- How to format its response

```
You are Kiuli, a content assistant for a luxury African safari travel company. You are collaborating with a travel designer on a content project.

PROJECT:
Title: {title}
Type: {contentType}
Stage: {stage}
Destinations: {destinations}
Properties: {properties}

{BRIEF SECTION if populated}
BRIEF:
Summary: {briefSummary}
Angle: {targetAngle}
Competitive notes: {competitiveNotes}

{RESEARCH SECTION if populated}
RESEARCH SYNTHESIS:
{synthesisText}

Sources:
{sourcesSummary}

{DRAFT SECTION if populated}
CURRENT DRAFT:
{draftText or sections formatted}

FAQ:
{faqItems formatted}

Meta Title: {metaTitle}
Meta Description: {metaDescription}

{RELATED CONTENT if populated}
RELATED KIULI CONTENT (for consistency):
{relatedContent}

{DIRECTIVES if populated}
EDITORIAL DIRECTIVES (you must respect these):
{activeDirectives}

---

You can respond naturally to the designer. When they request changes to the content, include structured actions in your response.

RESPONSE FORMAT:
Always respond with a JSON object (and NOTHING else — no markdown fences, no preamble):

{
  "message": "Your natural language response to the designer",
  "actions": [
    {
      "type": "edit_field",
      "field": "metaTitle",
      "value": "New meta title text"
    }
  ],
  "suggestedNextStep": "Optional suggestion for what to do next"
}

AVAILABLE ACTIONS:

1. edit_field — Edit a simple text/textarea field
   { "type": "edit_field", "field": "metaTitle" | "metaDescription" | "answerCapsule" | "briefSummary" | "targetAngle" | "competitiveNotes", "value": "new text" }

2. edit_body — Rewrite the full article body (for articles)
   { "type": "edit_body", "value": "Full new body text in markdown format" }

3. edit_section — Edit a specific section (for compound types: destination_page, property_page)
   { "type": "edit_section", "sectionName": "overview" | "when_to_visit" | "why_choose" | "key_experiences" | "getting_there" | "health_safety" | "investment_expectation" | "top_lodges" | "faq", "value": "New section content" }

4. edit_faq — Replace an FAQ item or add a new one
   { "type": "edit_faq", "index": 0, "question": "...", "answer": "..." }
   { "type": "edit_faq", "index": -1, "question": "...", "answer": "..." }  // -1 means append new

5. stage_change — Advance or move the project to a different stage
   { "type": "stage_change", "newStage": "review" }
   Only suggest stage changes when the designer explicitly asks (e.g., "advance to review", "this looks good, move it forward")

RULES:
- Only include actions when the designer requests a change. Conversational messages (questions, feedback, discussion) need no actions.
- When editing, show the specific change in your message ("I've updated the meta title to: ...").
- Respect all editorial directives. If a designer request would violate a directive, explain why and suggest an alternative.
- Be specific about safari destinations, properties, and wildlife. Use your knowledge of the project context.
- Keep meta titles under 60 characters. Keep meta descriptions under 160 characters. Keep answer capsules between 50-70 words.
- For body/section edits, write in Kiuli's brand voice: understated luxury, expert but warm, specific not generic. No safari clichés.
```

### Response Parsing

The model returns JSON. Parse it:
1. Try JSON.parse on the response content
2. If it fails (model returned markdown fences), strip fences and retry
3. If it still fails, treat the entire response as a message with no actions
4. Validate actions: check each action has the required fields for its type
5. Discard invalid actions with a warning log

### Action Application

For each valid action, apply it to the ContentProject:

```typescript
async function applyActions(
  payload: Payload,
  projectId: number,
  project: Record<string, unknown>,
  actions: ParsedAction[]
): Promise<ConversationAction[]> {
  const appliedActions: ConversationAction[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'edit_field': {
          // Direct field update — metaTitle, metaDescription, answerCapsule, briefSummary, targetAngle, competitiveNotes
          const ALLOWED_FIELDS = ['metaTitle', 'metaDescription', 'answerCapsule', 'briefSummary', 'targetAngle', 'competitiveNotes']
          if (!ALLOWED_FIELDS.includes(action.field)) {
            console.warn(`[conversation] Rejected edit to disallowed field: ${action.field}`)
            continue
          }
          const before = (project[action.field] as string) || ''
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { [action.field]: action.value },
          })
          appliedActions.push({
            type: 'edit_field',
            field: action.field,
            before: before.substring(0, 200),
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_body': {
          // Convert markdown to Lexical richText and update body field
          const beforeText = project.body ? extractTextFromLexical(project.body).substring(0, 200) : ''
          const lexicalBody = markdownToLexical(action.value)
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { body: lexicalBody },
          })
          appliedActions.push({
            type: 'edit_field',
            field: 'body',
            before: beforeText,
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_section': {
          // Update a specific section in the sections JSON
          const currentSections = typeof project.sections === 'string'
            ? JSON.parse(project.sections || '{}')
            : (project.sections || {})
          const before = currentSections[action.sectionName] || ''
          const beforeStr = typeof before === 'string' ? before : extractTextFromLexical(before)
          currentSections[action.sectionName] = action.value
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { sections: currentSections },
          })
          appliedActions.push({
            type: 'rewrite_section',
            sectionName: action.sectionName,
            before: beforeStr.substring(0, 200),
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_faq': {
          // Edit or append FAQ items
          const currentFaq = Array.isArray(project.faqSection)
            ? [...project.faqSection]
            : []
          if (action.index === -1) {
            // Append new FAQ
            currentFaq.push({ question: action.question, answer: action.answer })
          } else if (action.index >= 0 && action.index < currentFaq.length) {
            currentFaq[action.index] = { question: action.question, answer: action.answer }
          }
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { faqSection: currentFaq },
          })
          appliedActions.push({
            type: 'edit_field',
            field: `faqSection[${action.index}]`,
            after: `Q: ${action.question}`.substring(0, 200),
          })
          break
        }

        case 'stage_change': {
          // Validate the stage transition is legal for this content type
          const currentStage = project.stage as string
          const contentType = project.contentType as string
          if (isValidTransition(currentStage, action.newStage, contentType)) {
            await payload.update({
              collection: 'content-projects',
              id: projectId,
              data: {
                stage: action.newStage,
                ...(action.newStage === 'published' ? { publishedAt: new Date().toISOString() } : {}),
              },
            })
            appliedActions.push({
              type: 'stage_change',
              before: currentStage,
              after: action.newStage,
            })
          } else {
            console.warn(`[conversation] Invalid stage transition: ${currentStage} → ${action.newStage} for ${contentType}`)
          }
          break
        }
      }
    } catch (err) {
      console.error(`[conversation] Action failed:`, action, err)
    }
  }

  return appliedActions
}
```

`isValidTransition` — implement using the same stage maps from the batch route (ARTICLE_ADVANCE, PAGE_ADVANCE). A transition is valid if the newStage is the next stage in the map from the current stage.

### Message Storage

After getting the response and applying actions:

```typescript
// 1. Build designer message
const designerMessage = {
  role: 'designer',
  content: message,
  timestamp: new Date().toISOString(),
}

// 2. Build kiuli response message (with applied actions attached)
const kiuliMessage = {
  role: 'kiuli',
  content: response.message,
  timestamp: new Date().toISOString(),
  actions: appliedActions.length > 0 ? appliedActions : undefined,
}

// 3. Append both to the project's messages array
const currentMessages = Array.isArray(project.messages) ? [...project.messages] : []
currentMessages.push(designerMessage)
currentMessages.push(kiuliMessage)

await payload.update({
  collection: 'content-projects',
  id: projectId,
  data: { messages: currentMessages },
})
```

### The markdownToLexical Function

Copy the `markdownToLexical` function from `src/app/(payload)/api/content/research/route.ts` into a shared utility. Create `content-system/conversation/lexical-utils.ts` with this function so both the research route and conversation handler can use it. Update the research route to import from this shared location.

## Task 4: Conversation API Route

Create `src/app/(payload)/api/content/conversation/route.ts`

POST endpoint. Auth: Payload session (admin users only).

Request body:
```typescript
{
  projectId: number
  message: string
}
```

Logic:
1. Authenticate
2. Validate projectId and message exist
3. Fetch the project — verify it exists
4. Set processingStatus = 'processing'
5. Call handleMessage({ projectId, message })
6. Set processingStatus = 'completed' (or 'failed' on error)
7. Return response

```typescript
Response: {
  success: true,
  response: {
    message: string,
    actions: ConversationAction[],
    suggestedNextStep?: string,
  }
}
```

Error: `{ error: string }` with appropriate status code.

`maxDuration = 60` (conversations should be fast — single model call + action application).

## Task 5: Conversation Panel Component

Create `src/components/content-system/ConversationPanel.tsx`

This is a standalone React client component that renders the conversation thread and input. Phase 10 will integrate it into the full workspace layout, but it needs to work independently for testing.

Props:
```typescript
interface ConversationPanelProps {
  projectId: number
  initialMessages?: ConversationMessage[]  // from the project's messages array
  onActionApplied?: () => void  // callback to refresh project data after an action
}
```

Layout:
- Scrollable message list (full height minus input area)
- Each message: avatar/icon (designer or Kiuli), content, timestamp
- Kiuli messages with actions: show action badges below the message text (e.g., "Edited meta title", "Changed stage to review", "Updated overview section")
- Input area at bottom: textarea + Send button
- Loading state: while waiting for response, show a typing indicator for Kiuli
- Send on Enter (Shift+Enter for newline), or click Send button
- Disable input while processing
- Auto-scroll to bottom on new messages

Styling: Tailwind CSS (same as dashboard — Tailwind utilities available via custom.scss in Payload admin context).
- Designer messages: right-aligned, teal background (#486A6A), white text
- Kiuli messages: left-aligned, ivory background (#F5F3EB), charcoal text (#404040)
- Action badges: small pills below kiuli messages, clay color (#DA7A5A) text, light background
- Suggested next step: subtle prompt below the last kiuli message
- Input: border, rounded, with Send button (clay color)

State management:
- `messages` — local state, initialised from props
- `inputValue` — controlled textarea
- `isLoading` — while API call in progress
- On send: optimistically add designer message to display, call API, on response add kiuli message, call onActionApplied if actions were applied
- On error: show error below last message, re-enable input

API call:
```typescript
const response = await fetch('/api/content/conversation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // for Payload session cookie
  body: JSON.stringify({ projectId, message: inputValue }),
})
```

## Task 6: Test Page

Create a temporary test page at `src/app/(payload)/admin/conversation-test/page.tsx` that renders the ConversationPanel for a hardcoded project ID (use project 27 — the one with research populated). This lets us test the conversation handler end-to-end before Phase 10 builds the full workspace.

The test page should:
1. Fetch the project's current messages on mount
2. Display project title and stage at the top
3. Render ConversationPanel
4. Have a "Refresh Project" button that re-fetches and shows current field values (so we can verify actions applied)

Add a nav link for this test page (similar to ContentEngineLink) — temporary, will be removed in Phase 10.

## Testing

### Test 1: Simple conversation (no actions)
Send: "What is this article about?"
Expected: Kiuli responds with a summary based on the brief and research. No actions.
Verify: Both messages stored in project's messages array.

### Test 2: Field edit
Send: "Change the meta title to: Rwanda Gorilla vs Chimp Trekking Guide"
Expected: Kiuli responds confirming the change, with an edit_field action for metaTitle.
Verify: metaTitle field on project 27 is updated. Action recorded in kiuli's message.

### Test 3: Stage change
Send: "This research looks complete, advance to draft stage"
Expected: Kiuli responds confirming, with a stage_change action from research → draft.
Verify: Project 27's stage is now 'draft'.

### Test 4: Directive respect
Send: "Write a section about how this is the best safari in Africa"
Expected: Kiuli should push back — "best" is a superlative that violates Kiuli's quality standards. No action applied.

### Test 5: Conversation persistence
Reload the test page. All previous messages should appear from the stored messages array.

## Gate Evidence

```sql
-- 1. Messages stored on project
SELECT id, title, stage,
       jsonb_array_length(messages::jsonb) as message_count
FROM content_projects WHERE id = 27;

-- 2. Field edit applied
SELECT "metaTitle" FROM content_projects WHERE id = 27;

-- 3. Action recorded in messages
SELECT m->>'role' as role, LEFT(m->>'content', 100) as content, m->'actions' as actions
FROM content_projects, jsonb_array_elements(messages::jsonb) as m
WHERE id = 27
ORDER BY m->>'timestamp';
```

## Do NOT

- Do NOT leave any stub/declare-only files
- Do NOT skip the action application — every action type must work and be tested
- Do NOT skip the message storage — every message must persist
- Do NOT skip error handling (model returns invalid JSON, action application fails, etc.)
- Do NOT hardcode model names — use callModel('editing', ...) which reads from ContentSystemSettings
- Do NOT create a mock/fake AI response — use the real OpenRouter API
- Do NOT modify existing collections or their schemas
- Do NOT skip the ConversationPanel component — it must render and be interactive

## Report

Create `content-engine/reports/phase9-conversation-handler.md` with:
1. Files created/modified with descriptions
2. Test results for all 5 tests (show message content, actions applied, DB verification)
3. Any issues encountered
4. Screenshots or evidence of the conversation panel rendering

Commit and push everything.
