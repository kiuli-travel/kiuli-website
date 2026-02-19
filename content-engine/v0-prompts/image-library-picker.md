# v0 Prompt: Kiuli Embedded Image Library Picker

## Brand System

- **Kiuli Teal**: #486A6A
- **Clay**: #DA7A5A
- **Charcoal**: #404040
- **Gray**: #DADADA
- **Ivory**: #F5F3EB
- **Heading font**: General Sans (semibold, tracking tight)
- **Body font**: Satoshi (regular)
- **Aesthetic**: Understated luxury — clean, matte, sophisticated. Not flashy.

## Component

Design a compact image picker component that embeds into other admin interfaces. This is used in the Content Workspace's "Images" tab and in itinerary editing. Same Kiuli brand.

### Current Selection (top section)

If a hero image is selected:
- Large preview (full width of container, max 400px height, object-cover).
- Image alt text below preview.
- imgix URL shown (truncated, click to copy).
- "Remove Hero Image" text button — clay color, with × icon.
- Subtle green border on the preview indicating "selected".

If no hero image selected:
- Dashed border placeholder (200px height, gray dashes).
- Text: "No hero image selected".
- "Select from library below or generate a new image."

### Filter Bar (horizontal, compact)

Single row of compact controls:
- **Country** dropdown (compact, 140px).
- **Type** dropdown (compact, 120px).
- **Species** text input with autocomplete (160px).
- **Search** text input, placeholder "Search..." (flex-1, takes remaining space).
- **Hero Only** toggle — small pill toggle.

Active filters shown as tiny pills below the filter bar if any are set.

### Image Grid

- 3 columns, smaller cards than the full library browser.
- Cards: 120px × 90px thumbnails (imgix `?w=240&h=180&fit=crop&auto=format`).
- On hover: subtle scale(1.02) transform, shadow increase.
- On hover overlay: alt text (white, 11px), country pill (small).
- Click: selects the image as hero. Shows brief confirmation toast.
- Current hero image card has a teal border ring (2px).
- Paginated: "Load more" button below grid. Shows "X of Y images".

### Action Bar (below grid)

Two buttons side by side:
- "Open Full Library" — outlined button, links to `/admin/image-library`. Opens in new tab.
- "Generate New" — clay background button with sparkle icon. Opens generation panel as a modal overlay within the workspace.

### Generation Modal (compact version)

When "Generate New" is clicked, a modal appears (not slide-over, since we're already in a panel).
- Simplified version of the generation panel.
- Subject type selection (Wildlife / Landscape / Destination / Country).
- Species/destination/country inputs based on type.
- "Generate Prompts" button → shows 3 prompts.
- "Generate Image" per prompt → preview.
- "Approve & Save" → saves and auto-selects as hero.

### Props Interface

```typescript
interface ImageLibraryPickerProps {
  projectId: number
  selectedHeroId?: number | null
  selectedHeroUrl?: string | null
  selectedHeroAlt?: string | null
  defaultCountry?: string
  defaultSpecies?: string[]
  defaultImageType?: string
  onHeroChanged: () => void  // callback to refresh parent
}
```

This is a controlled component. Selection triggers a server action (`selectHeroImage`) and then calls `onHeroChanged` to let the parent refresh.

### Sample Data

Show the picker with:
- Hero selected: "Leopard in acacia tree at sunset" (Tanzania, Wildlife).
- Grid showing 9 images: mix of wildlife, landscapes, and accommodation from Tanzania and Kenya.
- Filter bar with Country = "Tanzania" pre-selected.

### Technical Notes

- Built with React + Tailwind CSS.
- Images from `kiuli.imgix.net` CDN.
- Server actions for search, select, remove, generate.
- Debounced search input (300ms).
- Grid loads 12 images initially, then 12 more on "Load more".
