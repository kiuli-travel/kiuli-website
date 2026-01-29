# Frontend Components Reference

Documentation for customer-facing React components in Kiuli.

## Overview

Kiuli's frontend uses React Server Components (RSC) where possible, with Client Components for interactivity. Components follow the Kiuli design system with consistent colors and typography.

**Location:** `src/components/`

---

## Design System

### Colors

| Name | Value | Usage |
|------|-------|-------|
| `kiuli-teal` | #486A6A | Primary accent, CTAs |
| `kiuli-charcoal` | #2D2D2D | Text, dark backgrounds |
| `kiuli-clay` | #A67B5B | Warm accent, borders |
| `kiuli-ivory` | #FAF8F5 | Light backgrounds |
| `kiuli-gray` | #6B7280 | Secondary text |

### Typography

- Headings: Serif font (elegant, luxury feel)
- Body: Sans-serif font (readable)
- Price displays: Light weight, large size

### Icons

All icons from [Lucide React](https://lucide.dev/icons).

---

## Itinerary Components

### ItineraryHero

**File:** `src/components/itinerary/ItineraryHero.tsx`
**Type:** Server Component

Full-width hero section displaying itinerary title with background video or image.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Hero section title |
| `heroImage` | { imgixUrl: string; alt: string } \| null | Background image |
| `heroVideo` | Media \| null | Optional video media object |
| `showHeroVideo` | boolean | Flag to display video instead of image |

**Features:**
- 70-80vh height
- Breadcrumb navigation ("SAFARIS > Title")
- Gradient overlay for text contrast
- Zoom effect on hover (scale-[1.02])
- Falls back to gradient when no media

**Usage:**
```tsx
<ItineraryHero
  title="Serengeti Safari Adventure"
  heroImage={{ imgixUrl: "...", alt: "Serengeti plains" }}
  heroVideo={videoMedia}
  showHeroVideo={true}
/>
```

---

### TripOverview

**File:** `src/components/itinerary/TripOverview.tsx`
**Type:** Server Component

Overview section with trip details in two-column layout.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Trip title |
| `destinations` | string[] | Destination names |
| `totalNights` | number | Number of nights |
| `travelers` | string | Traveler information |
| `startDate` | string | Start date |
| `endDate` | string | End date |
| `investmentLevel` | { fromPrice: number; currency: string } | Pricing |

**Features:**
- Icons for each detail (MapPin, Users, Calendar, Moon)
- Formatted price display
- Right column placeholder for future map integration
- Responsive grid layout

---

### JourneyNarrative

**File:** `src/components/itinerary/JourneyNarrative.tsx`
**Type:** Server Component

Main itinerary display that orchestrates the day-by-day journey.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `days` | Itinerary['days'] | Array of day objects with segments |

**Features:**
- Processes V7 two-field pattern (Enhanced vs Itrvl)
- Extracts "Insider's Tip:" from descriptions
- Groups consecutive transfers
- Handles three segment types: stay, activity, transfer
- Passes processed data to child components

**Segment Processing:**
```
days.segments → [StayCard | ActivityBlock | TransferRow]
```

---

### StayCard

**File:** `src/components/itinerary/StayCard.tsx`
**Type:** Client Component

Individual accommodation card with hero image and details.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `dayRange` | string | Day label (e.g., "Days 1 - 3") |
| `dateRange` | string | Date range string |
| `nights` | number | Number of nights |
| `propertyName` | string | Accommodation name |
| `location` | string | Location text |
| `descriptionContent` | React.ReactNode | Rich text description |
| `insiderTip` | string | Special tip text |
| `images` | Array<{ imgixUrl, alt }> | Property images |
| `roomType` | string | Room details |
| `inclusions` | string | What's included |

**Features:**
- Large hero image (first in array)
- Floating info card with property details
- Animated accordion for room/inclusions
- Insider's Tip callout box (teal-light background)
- Responsive layout

---

### ActivityBlock

**File:** `src/components/itinerary/ActivityBlock.tsx`
**Type:** Client Component

Activity section with image carousel.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Activity name |
| `description` | React.ReactNode | Rich text description |
| `images` | Array<{ imgixUrl, alt }> | Activity images |
| `dayNumber` | number | Optional day reference |

**Features:**
- Image carousel with prev/next buttons
- Dot indicators for navigation
- Smooth opacity transitions (500ms)
- Day label formatting
- Navigation auto-hides for single images

---

### TransferRow

**File:** `src/components/itinerary/TransferRow.tsx`
**Type:** Client Component

Expandable transport segment display.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `transportType` | 'flight' \| 'road' \| 'boat' \| 'entry' \| 'exit' \| 'point' | Transport method |
| `origin` | string | Starting location |
| `destination` | string | Ending location |
| `date` | string | ISO date string |
| `details` | React.ReactNode | Expandable details |
| `departureTime` | string | Departure time |
| `arrivalTime` | string | Arrival time |

**Features:**
- Icon per transport type (Plane, Car, Ship)
- Expandable accordion with animation
- Route display: "Origin → Destination"
- Formatted date display
- Plus/Minus expand indicators

**Transport Icons:**
| Type | Icon |
|------|------|
| flight, entry, exit | Plane |
| road, point | Car |
| boat | Ship |

---

### FAQSection

**File:** `src/components/itinerary/FAQSection.tsx`
**Type:** Client Component

Accordion-style FAQ display.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `faqs` | FAQItem[] | Array of FAQ items |

**FAQItem:**
```typescript
{
  question: string;
  answer: string | React.ReactNode;
}
```

**Features:**
- Single-open accordion (one item expanded at a time)
- Smooth height transitions (300ms)
- Rotating chevron icon
- Supports rich text answers
- Returns null if no FAQs

---

### InvestmentLevel

**File:** `src/components/itinerary/InvestmentLevel.tsx`
**Type:** Server Component

Pricing and CTA section.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `price` | number | Price amount |
| `currency` | string | Currency code (default: 'USD') |
| `includedItems` | string | What's included description |

**Features:**
- Large price display ("From $X,XXX")
- "per person" subheading
- Decorative "Investment Level" label
- Primary CTA: "Begin a Conversation"
- Secondary: Phone link
- Default inclusion text if none provided

---

### HeroVideoPlayer

**File:** `src/components/itinerary/HeroVideoPlayer.tsx`
**Type:** Client Component

Lightweight video player for hero sections.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `src` | string | Video URL (MP4) |
| `poster` | string | Poster image URL |
| `className` | string | Additional CSS classes |

**Features:**
- No autoplay (shows poster initially)
- Controls appear on hover
- Controls hide after 2 seconds of playback
- Loops video on end
- Muted by default with toggle
- Play button overlay when paused
- Frosted glass effect on overlay

---

## Layout Components

### Header

**File:** `src/components/layout/Header.tsx`
**Type:** Client Component

Fixed navigation header.

**Features:**
- Fixed positioning (top-0, z-50)
- Logo: mark + wordmark
- Desktop navigation links
- Mobile hamburger menu
- CTA button: "Begin a Conversation"
- Smooth mobile menu animation

**Navigation Links:**
- Safaris
- Destinations
- About
- Contact

---

### Footer

**File:** `src/components/layout/Footer.tsx`
**Type:** Server Component

Site footer with navigation and contact info.

**Features:**
- Dark background (kiuli-charcoal)
- Four-column responsive grid
- Brand column with logo + tagline
- Explore links: Safaris, Destinations, About, How It Works
- Support links: Contact, FAQs, Privacy, Terms
- Connect: Email, phone, LinkedIn
- Dynamic copyright year

---

## Component Categories

### Server Components
- ItineraryHero
- TripOverview
- JourneyNarrative
- InvestmentLevel
- Footer

### Client Components (Interactive)
- StayCard (accordions)
- ActivityBlock (carousel)
- TransferRow (expandable)
- FAQSection (accordion)
- HeroVideoPlayer (video controls)
- Header (mobile menu)

---

## Usage in Pages

### Itinerary Page Structure

```tsx
// src/app/(frontend)/safaris/[slug]/page.tsx

<main>
  <ItineraryHero {...heroProps} />
  <TripOverview {...overviewProps} />
  <JourneyNarrative days={itinerary.days} />
  <FAQSection faqs={processedFaqs} />
  <InvestmentLevel {...investmentProps} />
</main>
```

---

## Image Optimization

All images use imgix for optimization:

```tsx
// imgix URL with parameters
`${imgixUrl}?w=800&fit=crop&auto=format`
```

Common parameters:
- `w` - Width
- `h` - Height
- `fit=crop` - Crop to dimensions
- `auto=format` - Auto WebP/AVIF

---

## Responsive Breakpoints

Following Tailwind defaults:
- `sm` - 640px
- `md` - 768px
- `lg` - 1024px
- `xl` - 1280px
- `2xl` - 1536px

---

## See Also

- [ADMIN_COMPONENTS.md](./ADMIN_COMPONENTS.md) - Payload admin components
- [COLLECTIONS.md](./COLLECTIONS.md) - Data schemas
- [V7_TWO_FIELD_PATTERN.md](./V7_TWO_FIELD_PATTERN.md) - Content versioning
