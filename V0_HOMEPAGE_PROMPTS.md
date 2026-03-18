# v0 Homepage Prompts — Kiuli

Use these prompts sequentially in v0 to build a brand-compliant, award-winning Kiuli homepage. Each prompt builds on the previous output.

---

## PROMPT 1: Hero Section + Navigation

```
Build a luxury safari homepage hero section in Next.js 15 (App Router) with React 19 and Tailwind CSS.

BRAND IDENTITY:
- Company: Kiuli — luxury African safari travel company
- Tagline: "Experience Travel Redefined"
- Primary color (Kiuli Teal): #486A6A
- Accent color (Kiuli Clay): #DA7A5A
- Text color (Kiuli Charcoal): #404040
- Border color (Kiuli Gray): #DADADA
- Background (Kiuli Ivory): #F5F3EB
- Fonts: General Sans (headlines + body), Satoshi (secondary), Waterfall (accent script — sparingly, for one or two words)

TYPOGRAPHY HIERARCHY (from brand guidelines):
- Headline 1: General Sans, 11% letter-spacing, light weight
- Headline 2: General Sans with a single Waterfall-script accent word (the accent word's x-height should align visually with the heading text)
- Paragraph: Satoshi, light weight
- Attribution: Satoshi, light italic

NAVIGATION:
- Fixed header with transparent background over hero, transitioning to white with subtle shadow on scroll
- Logo: KIULI wordmark (spaced letters K I U L I) with circular logo mark to the left
- Nav links: Safaris, Where We Go, Properties, Articles (General Sans, light weight, #FFFFFF over hero, #404040 on white)
- CTA button: "Begin a Conversation" in #DA7A5A with white text, rounded-sm, right-aligned

HERO SECTION:
- Full viewport height (100vh), edge-to-edge background image
- The image shows a lone giraffe silhouetted against a golden African sunset with acacia trees (this will be a Next.js Image with fill + object-cover + priority)
- Subtle gradient overlay from transparent at top to rgba(0,0,0,0.4) at bottom
- Content positioned bottom-left (not centered):
  - Small caps label: "LUXURY AFRICAN SAFARIS" in Satoshi, 12px, tracking-[0.2em], text-white/70
  - Headline: "Experience Travel" on line 1, "Redefined." on line 2 — "Redefined" in Waterfall script. General Sans for "Experience Travel", large (56px desktop, 36px mobile)
  - Subtext: One line, Satoshi light, text-white/80, max 60 characters: "Handcrafted journeys through Africa's wild heart"
  - CTA: "Explore Safaris" button in #DA7A5A, px-8 py-3.5, hover:bg-[#C66A4A]
- NO scroll indicator. NO animated elements. Let the image do the work.
- The overall feel should be understated luxury — quiet confidence, generous whitespace, editorial magazine quality

OUTPUT: A single React component with Tailwind CSS. Include the sticky header with scroll behavior. Do not use any UI libraries. Use only Tailwind core utility classes.
```

---

## PROMPT 2: Featured Safaris Section

```
Build the "Featured Safaris" section that sits immediately below the hero. This is the second section of the Kiuli luxury safari homepage.

DESIGN SYSTEM (same as previous):
- Kiuli Teal: #486A6A, Clay: #DA7A5A, Charcoal: #404040, Gray: #DADADA, Ivory: #F5F3EB
- Fonts: General Sans (headlines), Satoshi (body), Waterfall (accent)
- Typography: Headline 1 = 11% letter-spacing, light weight

SECTION LAYOUT:
- White background (#FFFFFF)
- Generous vertical padding: py-24 md:py-32
- Section header centered:
  - Small label: "CURATED EXPERIENCES" in caps, Satoshi, 12px, tracking-[0.2em], text-[#486A6A]/60
  - Decorative lines either side of the label (thin, 40px wide, #DADADA)
  - Headline: "Our Safaris" — General Sans, 42px, font-light, #404040, 11% letter-spacing
  - Subtext: Satoshi light, #404040/60, max 50 chars: "Five handcrafted journeys, each one extraordinary"

SAFARI CARDS (show 5):
- 2-column grid on desktop (first card spans full width as a hero card, remaining 4 in 2x2 grid)
- Hero card (first): landscape orientation, 16:9 aspect ratio, full-bleed image with gradient overlay, text bottom-left
- Regular cards: portrait orientation, 3:4 aspect ratio
- Each card shows:
  - Background image (Next.js Image, fill, object-cover)
  - Gradient overlay from transparent to rgba(0,0,0,0.5) at bottom
  - Country name: small caps label, Satoshi 11px, tracking-wider, text-white/70
  - Safari title: General Sans, 24px (hero: 32px), font-medium, text-white
  - Duration: "10 nights" in Satoshi, text-white/60
  - Price: "From $40,000" in General Sans, text-white/80
  - On hover: image scales 1.02 over 400ms ease-out, overlay darkens slightly
- Cards link to /safaris/[slug]
- No "View More" button — the collection IS the complete set

FEEL: Magazine editorial, like a Condé Nast Traveller feature spread. No borders. No shadows. Just images, typography, and whitespace.

Use Next.js Link, next/image. Tailwind only. Single component. Data passed as props (array of safaris with title, slug, country, nights, price, imageUrl).
```

---

## PROMPT 3: Value Proposition + Testimonial

```
Build two connected sections for the Kiuli luxury safari homepage: "The Kiuli Difference" value proposition and a testimonial section.

DESIGN SYSTEM:
- Kiuli Teal: #486A6A, Clay: #DA7A5A, Charcoal: #404040, Gray: #DADADA, Ivory: #F5F3EB
- Fonts: General Sans (headlines), Satoshi (body), Waterfall (accent script)

SECTION 1: "THE KIULI DIFFERENCE"
- Background: #F5F3EB (Kiuli Ivory)
- py-24 md:py-32
- Two-column layout (text left, image right on desktop; stacked on mobile)
- Left column (55%):
  - Small label: "WHY KIULI" — caps, Satoshi, 12px, tracking-[0.2em], #486A6A/60
  - Headline: "The Kiuli" on line 1, "Difference" on line 2 in Waterfall script — General Sans 42px, font-light, #404040
  - Three value points, each with:
    - A thin teal line (2px wide, 24px long, #486A6A) as a bullet
    - Bold label: General Sans, 16px, font-medium, #404040
    - Description: Satoshi, 15px, font-light, #404040/70, max 2 lines
  - Values:
    1. "Specialists, Not Agents" — "Every designer has lived and worked in the destinations they craft"
    2. "No Compromises" — "We don't book what's available. We secure what's extraordinary"
    3. "Invisible Logistics" — "Every transfer, every detail, handled before you think to ask"
- Right column (45%):
  - Single image, rounded-sm, aspect-[3/4]
  - The image shows a Serengeti hot air balloon at sunrise over vast plains (placeholder: Next.js Image with fill)
  - Subtle shadow-lg

SECTION 2: TESTIMONIAL
- Background: white
- py-20 md:py-28
- Centered layout, max-w-3xl
- Large decorative opening quote mark in #DADADA (use a styled span, 72px, font-serif)
- Quote text: Waterfall script for the first few words, then Satoshi italic for the rest. 24px, #404040, text-center, leading-relaxed
- Quote: "Our safari with Kiuli exceeded every expectation. The attention to detail, the incredible guides, and the seamless logistics made this the trip of a lifetime."
- Attribution below: "The Morrison Family" — General Sans, 16px, font-medium, #404040
- Context: "Tanzania & Rwanda, 2024" — Satoshi, 14px, #404040/50
- No quotation marks around text (the decorative mark is enough)

FEEL: Luxury magazine editorial. Restrained. Confident. No shadows except on the image. No animations.

Tailwind CSS only. Single component file. Props for values array and testimonial data.
```

---

## PROMPT 4: Country Highlights + CTA Footer

```
Build the final two sections of the Kiuli luxury safari homepage: "Where We Go" country highlights and a conversion CTA section.

DESIGN SYSTEM:
- Kiuli Teal: #486A6A, Clay: #DA7A5A, Charcoal: #404040, Gray: #DADADA, Ivory: #F5F3EB
- Fonts: General Sans (headlines), Satoshi (body), Waterfall (accent script)

SECTION 1: "WHERE WE GO"
- Background: white
- py-24 md:py-32
- Section header (centered):
  - Small label: "FIVE COUNTRIES" — caps, Satoshi, 12px, tracking-[0.2em], #486A6A/60
  - Headline: "Where We Go" — General Sans, 42px, font-light, #404040, 11% letter-spacing

- Country cards in a single horizontal row (5 cards, equal width)
- Each card:
  - Tall portrait image (aspect-[2/3]), rounded-sm, overflow-hidden
  - Gradient overlay bottom third only
  - Country name: General Sans, 20px, font-medium, text-white, bottom-left with padding
  - Below image: destination count text "4 destinations" in Satoshi, 13px, #404040/50
  - On hover: image scale 1.03 over 400ms
  - Link to /destinations/[slug]
- Countries: Kenya, Tanzania, Rwanda, South Africa, Mozambique
- On mobile: horizontal scroll with snap-x snap-mandatory, showing 1.2 cards at a time

SECTION 2: CONVERSION CTA
- Background: #486A6A (Kiuli Teal), full-bleed
- py-20 md:py-28
- Centered content, max-w-2xl:
  - Headline: "Ready to Begin?" — General Sans, 36px, font-light, text-white, 11% letter-spacing
  - Subtext: "Our safari experts will craft a personalised itinerary tailored to your dreams." — Satoshi, 18px, font-light, text-white/70
  - CTA button: "Begin a Conversation" — bg-[#DA7A5A], text-white, px-10 py-4, text-base, font-medium, rounded-sm, hover:bg-[#C66A4A], transition
  - Below button: "Or email hello@kiuli.com" — Satoshi, 14px, text-white/50, with mailto link
- No decorative elements. Just confident typography on teal.

FOOTER (below CTA):
- Background: #404040 (Kiuli Charcoal)
- py-16
- 4-column grid:
  1. Logo (KIULI wordmark in white) + "Luxury African Safaris" tagline in Satoshi, 14px, text-white/40
  2. EXPLORE column: Safaris, Where We Go, Properties, Articles — links in Satoshi, 14px, text-white/60, hover:text-white
  3. COMPANY column: About, Contact — same styling
  4. CONTACT column: hello@kiuli.com, LinkedIn icon
- Bottom bar: thin border-t border-white/10, "© 2026 Kiuli. All rights reserved." left, "Privacy Policy · Terms" right, Satoshi 13px, text-white/30

Tailwind CSS only. Single component. Props for countries array (name, slug, imageUrl, destinationCount) and footer data.
```

---

## INTEGRATION NOTES FOR v0 OUTPUT

After getting v0 components, integrate them into the Kiuli codebase:

1. The homepage renders at `src/app/(frontend)/page.tsx` which delegates to `src/app/(frontend)/[slug]/page.tsx`
2. Current hero uses Payload's `HighImpactHero` + layout blocks (HomeHero, FeaturedItineraries, ValueProposition, DestinationHighlights, Testimonial)
3. Replace the current Payload template hero with the v0 hero component
4. The layout blocks can be replaced with the v0 sections, keeping data sourced from Payload collections
5. The v0 components should be placed in `src/components/home/` as:
   - `HeroSection.tsx`
   - `FeaturedSafaris.tsx`
   - `ValueProposition.tsx`
   - `Testimonial.tsx`
   - `CountryHighlights.tsx`
   - `ConversionCTA.tsx`
6. The page.tsx should import and compose these, fetching data from Payload collections

**Fonts:** General Sans and Satoshi are already loaded via the Kiuli design system. Waterfall needs to be added if not present — check `src/app/(frontend)/layout.tsx` for current font configuration.

**Hero Image:** Use media ID 1333 (giraffe at sunset, 2400x1350) — imgix URL: `https://kiuli.imgix.net/media/originals/41/44af81ff-fc8f-42d1-bed2-9004f40e7943_chem_chem_-_wildlife_10-upscale.jpeg?auto=format%2Ccompress&q=80`

**Safari Data:** Query from Payload `itineraries` collection (5 published itineraries with IDs 41-45)

**Country Data:** Query from Payload `destinations` collection where `type: 'country'`
