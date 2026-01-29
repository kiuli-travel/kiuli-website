# Admin Components Reference

Documentation for custom Payload CMS admin components in Kiuli.

## Overview

Kiuli extends Payload CMS with custom admin components for:
- Image and video selection
- AI content enhancement (V7 pattern)
- Notifications
- Visual organization

**Location:** `src/components/admin/`

---

## Field Components

### ImageSelectorField

**File:** `ImageSelectorField.tsx`

Single image selector for relationship fields with collapsible UI.

**Features:**
- Collapsed state showing current selection thumbnail (80x80px)
- Expandable modal with image grid (100x100px thumbnails)
- Search by filename or alt text
- Pagination with "Load More" button (30 images per page)
- imgix URL optimization with crop/fit parameters
- Clear and Cancel actions

**Usage in Collection:**
```typescript
{
  name: 'heroImage',
  type: 'relationship',
  relationTo: 'media',
  admin: {
    components: {
      Field: '/components/admin/ImageSelectorField',
    },
  },
}
```

**Used In:**
- `itineraries.heroImage` - Primary hero image selector

---

### VideoSelectorField

**File:** `VideoSelectorField.tsx`

Single video selector for relationship fields with playable preview.

**Features:**
- Collapsed state showing video thumbnail (120x80px)
- Expandable picker with video grid (16:9 aspect ratio)
- Inline video player with controls
- Search by filename or alt text
- Watch Video / Hide Video toggle
- Filters videos by `mediaType=video`
- 20 videos per page

**Usage in Collection:**
```typescript
{
  name: 'heroVideo',
  type: 'relationship',
  relationTo: 'media',
  filterOptions: { mediaType: { equals: 'video' } },
  admin: {
    components: {
      Field: '/components/admin/VideoSelectorField',
    },
  },
}
```

**Used In:**
- `itineraries.heroVideo` - Background video for itinerary header

---

### FieldPairEditor

**File:** `FieldPairEditor.tsx`

Core component for the V7 two-field pattern (Original + Enhanced + Reviewed).

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `itrvlPath` | string | Path to iTrvl original field (read-only) |
| `enhancedPath` | string | Path to enhanced field (editable) |
| `reviewedPath` | string | Path to reviewed checkbox |
| `voiceConfig` | string | AI voice/style identifier |
| `label` | string | Section label |
| `isRichText` | boolean | Whether field uses RichText format |
| `context` | Record<string, string> | Additional context for AI enhancement |

**Features:**
- Displays original text in read-only box
- "Copy to Enhanced" button for quick duplication
- "AI Enhance" button calls `/api/enhance` endpoint
- Editable textarea for enhanced content
- RichText extraction and conversion support
- Reviewed checkbox for tracking approval status
- Success/error messages with token count display

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Title                                                    │
├─────────────────────────────────────────────────────────┤
│ Original (iTrvl):                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Luxury Safari Adventure                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Enhanced:                              [✨ Enhance]     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Discover Africa's Hidden Wilderness                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ☑ Reviewed                                              │
└─────────────────────────────────────────────────────────┘
```

**Note:** This component is typically used via wrapper components (see below).

---

## V7 Field Editor Wrappers

These components wrap `FieldPairEditor` with preconfigured paths for specific segment types.

### ActivityFieldEditors

**File:** `ActivityFieldEditors.tsx`

**Exports:**

| Component | Voice Config | Field Type |
|-----------|--------------|------------|
| `ActivityTitleEditor` | `segment-activity-title` | Plain text |
| `ActivityDescriptionEditor` | `segment-description` | RichText |

**Context:** `{ segmentType: 'activity' }`

**Used In:** Activity segments in itinerary days

---

### StayFieldEditors

**File:** `StayFieldEditors.tsx`

**Exports:**

| Component | Voice Config | Field Type |
|-----------|--------------|------------|
| `AccommodationNameEditor` | `segment-accommodation-name` | Plain text |
| `StayDescriptionEditor` | `segment-description` | RichText |
| `InclusionsEditor` | `investment-includes` | RichText |

**Context:** `{ segmentType: 'stay' }`

**Used In:** Stay/accommodation segments in itinerary days

---

### TransferFieldEditors

**File:** `TransferFieldEditors.tsx`

**Exports:**

| Component | Voice Config | Field Type |
|-----------|--------------|------------|
| `TransferTitleEditor` | `day-title` | Plain text |
| `TransferDescriptionEditor` | `segment-description` | RichText |

**Context:** `{ segmentType: 'transfer' }`

**Used In:** Transfer segments in itinerary days

---

### FAQFieldEditors

**File:** `FAQFieldEditors.tsx`

**Exports:**

| Component | Voice Config | Field Type |
|-----------|--------------|------------|
| `FAQQuestionEditor` | `faq-answer` | Plain text |
| `FAQAnswerEditor` | `faq-answer` | RichText |

**Used In:** FAQ items in itinerary

---

## Image Management Components

### ImageSelectionModal

**File:** `ImageSelectionModal.tsx`

Multi-select modal for bulk image library selection with advanced filtering.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Control modal visibility |
| `onClose` | () => void | Close handler |
| `onSelect` | (imageIds: number[]) => void | Selection callback |
| `currentlySelected` | number[] | Currently selected IDs |

**Features:**
- Search across filename, alt, altText, sourceProperty (debounced 300ms)
- **Country Filter:** Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique
- **Image Type Filter:** wildlife, landscape, accommodation, activity, people, food, aerial, detail
- **Lodge/Property Filter:** Dynamic from media library
- Select All Visible / Clear Selection actions
- Shows newly selected (green) vs already selected (gray)
- Property labels on image thumbnails (120x120px)
- Pagination with 50 images per page

**Used In:** `ImageThumbnailsPreview` component

---

### ImageThumbnailsPreview

**File:** `ImageThumbnailsPreview.tsx`

Preview and manager for hasMany image relationships with modal picker.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `path` | string | UI field path (e.g., `days.0.segments.0.imagePreviewUI`) |

**Features:**
- Auto-derives images path from UI field path
- Displays thumbnail grid (60x60px) of selected images
- Remove button on each thumbnail
- Add Images button opens `ImageSelectionModal`
- Clear All button removes all selections
- Image count display

**Path Transformation:**
```
days.0.segments.0.imagePreviewUI → days.0.segments.0.images
```

**Used In:** Activity/stay segments to preview segment gallery images

---

### RootImagesGallery

**File:** `RootImagesGallery.tsx`

Read-only gallery preview of root-level images in itinerary.

**Features:**
- Displays preview of selected images (60x60px)
- Shows first 10 images in collapsed state
- "Show more" button reveals remaining images
- "+N" indicator for hidden images
- Total count display

**Used In:** `itineraries.images` field (display-only)

---

### VideosGallery

**File:** `VideosGallery.tsx`

Read-only gallery preview of all videos in itinerary.

**Features:**
- Displays all videos in itinerary
- Video header with filename
- Watch Video / Hide Player toggle
- Video player with controls
- Thumbnail with play button overlay (16:9 aspect ratio)
- Filters to only actual video files (MIME type video/*)

**Used In:** `itineraries.videos` field (display-only)

---

## Navigation Components

### NotificationBell

**File:** `NotificationBell.tsx`

Admin sidebar notification center with real-time polling.

**Features:**
- Bell icon with unread count badge
- Dropdown menu (max 400px height)
- 30-second polling interval
- Notification types with color coding:
  - `success` - Green
  - `error` - Red
  - `warning` - Yellow
  - `info` - Blue
- Mark single/all notifications as read
- Relative timestamps (Just now, Xm ago, Xh ago)
- Link to full notification collection
- Click-outside handler to close dropdown

**Used In:** Payload admin layout (navigation)

---

### ImportItineraryLink

**File:** `ImportItineraryLink.tsx`

Navigation button to import new itinerary from iTrvl.

**Features:**
- Links to `/admin/scrape` page
- Teal button (#486A6A) with hover effect
- Plus icon
- "Import Itinerary" text

**Used In:** Payload admin sidebar

---

## UI Components

### SectionHeader

**File:** `SectionHeader.tsx`

Prominent purple section header for admin UI organization.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Section title |
| `description` | string | Optional description text |
| `icon` | 'video' \| 'image' \| 'info' | Optional icon type |

**Pre-configured Export:**
- `HeroVideoSectionHeader` - For hero video section

**Visual Style:**
- Purple background (#6f42c1)
- White text
- SVG icons for video, image

**Used In:** `itineraries.heroVideoSectionUI` field

---

## Registration

All admin components must be registered in `importMap.js`. After adding or modifying components:

```bash
npx payload generate:importmap
git add src/app/\(payload\)/admin/importMap.js
git commit -m "fix: regenerate importMap"
```

---

## Component Summary

| Component | Type | Purpose |
|-----------|------|---------|
| **ImageSelectorField** | Field | Single image picker with search |
| **VideoSelectorField** | Field | Single video picker with preview |
| **FieldPairEditor** | Field | V7 AI enhancement editor |
| **ActivityFieldEditors** | Wrapper | Activity segment V7 editors |
| **StayFieldEditors** | Wrapper | Stay segment V7 editors |
| **TransferFieldEditors** | Wrapper | Transfer segment V7 editors |
| **FAQFieldEditors** | Wrapper | FAQ item V7 editors |
| **ImageSelectionModal** | Modal | Bulk image selection with filters |
| **ImageThumbnailsPreview** | Field | hasMany image preview + picker |
| **RootImagesGallery** | Field | Root images read-only gallery |
| **VideosGallery** | Field | Videos read-only gallery |
| **NotificationBell** | Sidebar | Real-time notification center |
| **ImportItineraryLink** | Sidebar | Link to scraper page |
| **SectionHeader** | UI | Visual section break |

---

## See Also

- [V7_TWO_FIELD_PATTERN.md](./V7_TWO_FIELD_PATTERN.md) - Content versioning pattern
- [COLLECTIONS.md](./COLLECTIONS.md) - Collection schema reference
- [FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md) - Customer-facing components
