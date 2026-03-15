# Kiuli Frontend Bug List — Exhaustive Evaluation

**Date:** March 15, 2026
**Evaluator:** Automated review via Chrome screenshots
**Scope:** All customer-facing pages at kiuli.com

---

## CRITICAL — Blocks Launch

### H1. Homepage hero image/video not loading
- **Page:** kiuli.com/
- **Issue:** The hero section renders a grey-to-white gradient with no background image or video. The "Unforgettable African Adventures" heading and subtext are visible but float on a blank gradient.
- **Impact:** First impression is broken — a luxury travel site with no hero imagery looks unfinished.
- **Fix:** Check the Homepage global/page configuration for a hero image/video media reference. Verify the imgixUrl is populated and the `<Image>` or `<video>` tag is rendering correctly. Likely a missing media assignment in the CMS.

### H2. Destination cards have no images
- **Page:** kiuli.com/destinations
- **Issue:** All destination cards (Kenya, Mozambique, Rwanda, South Africa, Tanzania) render with a flat teal gradient background and no actual destination imagery.
- **Impact:** A luxury travel site must have stunning destination imagery. Teal gradients look like placeholders.
- **Fix:** Assign hero images to each Destination record in the CMS. The DestinationCard component likely checks for `heroImage.imgixUrl` — ensure each destination has one.

### H3. Property cards have no images
- **Page:** kiuli.com/properties
- **Issue:** All property cards (Alfajiris Cliff Villa, AndBeyond Kichwa Tembo, Angama Mara, etc.) show blank ivory cards with just the property name centered as text. No hero images.
- **Impact:** Properties are where the luxury is — empty cards destroy the browsing experience.
- **Fix:** Assign hero images from the media library to each Property record. The scraper has images for most properties — link them.

### H4. Article cards have no hero images
- **Page:** kiuli.com/articles
- **Issue:** All 3 article cards show teal gradient placeholders instead of hero images.
- **Impact:** Articles need compelling feature images to drive click-through.
- **Fix:** Assign hero images to each Post record. The Content Engine should be generating/assigning images as part of the publishing pipeline.

### H5. Itinerary 45 (South Africa & Mozambique) missing from listing
- **Page:** kiuli.com/safaris
- **Issue:** Only 4 of 5 published itineraries appear. Itinerary 45 was missing because it had no hero image. Hero image has now been assigned (media ID 1665) — should appear after ISR revalidation.
- **Status:** Fixed (pending ISR cache refresh).

---

## HIGH — Significantly Degrades Quality

### M1. Footer phone number is placeholder
- **Pages:** All pages (global footer)
- **Issue:** Footer shows `+44 1234 567890` which is clearly a placeholder number.
- **Fix:** Update the Footer global in Payload CMS with the real Kiuli phone number or remove the phone field entirely.

### M2. Contact page phone number is placeholder
- **Page:** kiuli.com/contact
- **Issue:** "CALL US" card shows `+44 1234 567890`.
- **Fix:** Same as M1 — update or remove.

### M3. Itinerary detail page hero image slow to load
- **Page:** kiuli.com/safaris/[slug]
- **Issue:** Hero image appears as a grey gradient for several seconds before the actual image loads. There's no loading skeleton or blur-up placeholder.
- **Fix:** Add a `placeholder="blur"` prop to the Next.js Image component with a blurDataURL, or use a CSS background-color that matches the image dominant color while loading.

### M4. "Your Journey" timeline shows only 2 entries
- **Page:** kiuli.com/safaris/a-luxury-kenyan-honeymoon-bush-beach
- **Issue:** The journey timeline between the TripOverview and day-by-day sections only shows "Transfer" and "Nairobi" — it should show the complete route (Nairobi → Loisaba → Angama Mara → etc.).
- **Fix:** The timeline component may only be rendering the first day's segments. Check the data mapping logic.

### M5. No "Why Kiuli" section on itinerary pages
- **Page:** kiuli.com/safaris/[slug]
- **Issue:** The whyKiuli field exists in the schema but doesn't appear to render on the frontend. This is a key value proposition section.
- **Fix:** Add a WhyKiuli component to the itinerary detail page layout if the field has content.

### M6. No FAQ section rendering on itinerary pages
- **Page:** kiuli.com/safaris/[slug]
- **Issue:** Each itinerary has 7 FAQ items in the CMS but the FAQ accordion doesn't appear on the frontend detail page.
- **Fix:** Check if the FAQ component is being rendered. The data exists — the component may be missing or conditionally hidden.

### M7. Price shows "TOTAL" not "From" on itinerary detail
- **Page:** kiuli.com/safaris/a-luxury-kenyan-honeymoon-bush-beach
- **Issue:** The TripOverview shows "TOTAL $40,000" but the listing card shows "From $40,000 pp". The detail page should also say "From" since prices are indicative.
- **Fix:** Change the label in TripOverview from "Total" to "From" to match the card and avoid implying a fixed price.

### M8. Page title has redundant "Kiuli"
- **Page:** kiuli.com/
- **Issue:** Browser tab shows "Kiuli | Luxury African Safaris | Kiuli" — "Kiuli" appears twice.
- **Fix:** Update the homepage metadata to remove the duplicate.

---

## MEDIUM — Polish & UX Improvement

### L1. Destination cards lack itinerary count
- **Page:** kiuli.com/destinations
- **Issue:** Each destination card says "Explore safaris in [country] →" but doesn't show how many itineraries are available.
- **Fix:** Add a count badge like "2 safaris" to each destination card.

### L2. Property cards lack location context
- **Page:** kiuli.com/properties
- **Issue:** Property names appear twice — once centered in the card area and once below as a heading. This is visually redundant.
- **Fix:** Remove the centered text overlay when there's no image. Once images are added, this overlay becomes a text-on-image label which is fine.

### L3. Articles page only shows 3 articles
- **Page:** kiuli.com/articles
- **Issue:** Only 3 articles exist. Each of the 5 itineraries should have at least one associated article.
- **Fix:** Content Engine task — generate and publish articles for each itinerary.

### L4. No breadcrumb on homepage
- **Page:** kiuli.com/
- **Issue:** Homepage has no breadcrumb (acceptable — it's the root). However, other pages have breadcrumbs that link back to Home.
- **Status:** Not a bug — by design.

### L5. Itinerary listing grid has uneven rows
- **Page:** kiuli.com/safaris
- **Issue:** 4 cards render as 3+1 layout. The lone card on the second row looks orphaned.
- **Fix:** When there are fewer than 3 items in a row, the grid should adjust. This will self-resolve as more itineraries are added. Alternatively, use a 2-column layout for the last row.

### L6. No loading state for listing pages
- **Pages:** /safaris, /destinations, /properties, /articles
- **Issue:** Server-rendered pages have no loading skeleton — they either show content or are blank during ISR.
- **Fix:** Add loading.tsx files for each route to show a skeleton UI during page transitions.

### L7. Itinerary "Room Details" accordion is empty when collapsed
- **Page:** kiuli.com/safaris/[slug] (stay sections)
- **Issue:** "Room Details" accordion appears but content inside is unknown until clicked. No preview text visible.
- **Fix:** Show a 1-line preview of room type or add an open-by-default state.

### L8. No "Related Safaris" section on itinerary detail pages
- **Page:** kiuli.com/safaris/[slug]
- **Issue:** Each itinerary has a `relatedItineraries` field but no "You May Also Like" section renders on the frontend.
- **Fix:** Add a related itineraries component at the bottom of the detail page, before the CTA.

### L9. No social sharing buttons on itinerary or article pages
- **Pages:** /safaris/[slug], /articles/[slug]
- **Issue:** No way to share on social media.
- **Fix:** Add share buttons (WhatsApp, email, copy link) — important for the aspirational sharing behavior of luxury travel buyers.

### L10. No investment breakdown section
- **Page:** kiuli.com/safaris/[slug]
- **Issue:** The `investmentLevel.includes` field has rich text describing what's included in the price, but this doesn't render on the frontend. Only the raw price number shows.
- **Fix:** Add an "What's Included" section below the price in TripOverview or as a separate section.

---

## LOW — Nice to Have

### N1. Destination detail pages are sparse
- **Page:** kiuli.com/destinations/[slug]
- **Issue:** Destination detail pages likely have minimal content since they're auto-created by the cascade system without full editorial review.
- **Fix:** Content Engine should generate rich destination content.

### N2. No search functionality
- **Pages:** All listing pages
- **Issue:** No search bar on safaris, properties, or articles listing pages.
- **Fix:** Add client-side search/filter for properties and articles.

### N3. No trip type filter on safaris page
- **Page:** kiuli.com/safaris
- **Issue:** No way to filter by trip type (Honeymoon, Family, Great Migration, etc.).
- **Fix:** Add trip type filter pills or a sidebar filter.

### N4. No sticky header on scroll
- **Pages:** All pages
- **Issue:** The navigation header scrolls away. For long itinerary detail pages, users lose access to navigation.
- **Fix:** Make the header sticky with a subtle background blur on scroll.

### N5. No back-to-top button on long pages
- **Pages:** Itinerary detail pages
- **Issue:** Itinerary pages are very long (8000+ pixels). No way to quickly return to top.
- **Fix:** Add a floating back-to-top button that appears after scrolling past the fold.

---

## Summary

| Priority | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 5 | Missing images across all listing pages |
| HIGH | 8 | Placeholder data, missing content sections, price labeling |
| MEDIUM | 10 | UX polish, grid layouts, loading states |
| LOW | 5 | Filtering, search, navigation enhancements |
| **Total** | **28** | |

### Top 5 Actions for v0 Prompting Strategy

1. **Fix all missing images** — Assign hero images to destinations, properties, articles, and homepage from the media library
2. **Add missing itinerary sections** — FAQ accordion, Why Kiuli, What's Included, Related Safaris
3. **Fix placeholder data** — Phone number, duplicate page title
4. **Add loading states** — Hero image blur-up, route loading skeletons
5. **Improve listing grids** — Trip type filters, itinerary count badges on destinations
