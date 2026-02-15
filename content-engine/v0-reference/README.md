# V0 Reference Files — Content Workspace

These files are the approved v0 design output for the Phase 10 Content Workspace UI.

## Files

- `workspace-types.ts` — Adapted types with corrected stage values (singular), helper functions
- `project-workspace.tsx` — Main split layout with draggable divider
- `workspace-header.tsx` — Header bar with badges, advance button, dropdown (NOTE: uses shadcn — replace with plain HTML/Tailwind)
- `conversation-panel.tsx` — VISUAL DESIGN ONLY. Merge with Phase 9 server action logic from `src/components/content-system/ConversationPanel.tsx`
- `content-tabs.tsx` — All 7 tab components. Available in full at the repo path below.

## Content Tabs

The content-tabs.tsx file (885 lines) is too large for this reference directory. The CLI should read it from the v0 zip or from the Phase 10 prompt which describes the exact behavior of each tab. The key visual patterns are:

- Labels: `text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal/50`
- Inputs: `rounded border border-kiuli-gray bg-white px-3 py-2 text-sm ... focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal`
- Buttons (primary): `rounded bg-kiuli-clay px-4 py-2 text-xs font-medium text-white`
- Buttons (secondary): `rounded bg-kiuli-teal px-4 py-2 text-xs font-medium text-white`
- Section cards: `rounded border border-kiuli-gray/60 bg-white` with header border-b
- Badges: `rounded-full px-2 py-0.5 text-[10px] font-medium capitalize`
- Content areas: `rounded border border-kiuli-gray/60 bg-kiuli-ivory/50 p-4`

## Critical Notes for CLI

1. **shadcn/ui**: The v0 header uses `DropdownMenu` and `Tooltip` from shadcn. These must be replaced with plain HTML/Tailwind — Payload admin doesn't have shadcn.
2. **Conversation Panel**: The v0 version is a mock. Use the Phase 9 `ConversationPanel.tsx` (inline styles) as the working base, then replace styling with v0's Tailwind classes.
3. **Tailwind in Payload Admin**: VERIFY first that Tailwind utilities work inside Payload admin views. If they don't, fall back to inline styles or custom.scss. The Phase 7 dashboard used custom.scss.
4. **Stage values**: v0 used plural ('ideas', 'briefs', 'drafts'). Real DB uses singular ('idea', 'brief', 'draft'). The `workspace-types.ts` file has the correct values.
5. **lucide-react**: Check if available in the Payload project deps. v0 uses: ArrowLeft, Loader2, MoreVertical, Send, ExternalLink, Trash2, GripVertical, Plus, Image, Sparkles, Target.
