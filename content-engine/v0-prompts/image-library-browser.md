# v0 Prompt: Kiuli Image Library Browser

## Brand System

- **Kiuli Teal**: #486A6A
- **Clay**: #DA7A5A
- **Charcoal**: #404040
- **Gray**: #DADADA
- **Ivory**: #F5F3EB
- **Heading font**: General Sans (semibold, tracking tight)
- **Body font**: Satoshi (regular)
- **Aesthetic**: Understated luxury — clean, matte, sophisticated. Not flashy. Think boutique gallery, not stock photo site.

## Component

Design an admin image library browser for a luxury African safari company called Kiuli. This is a full-page admin interface at `/admin/image-library`.

### Layout

**Left sidebar (280px fixed):** Filter panel with collapsible sections. Each section has a subtle header with a chevron toggle.

- **Country**: multi-select checkboxes — Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique. Show count next to each.
- **Image Type**: multi-select checkboxes — Wildlife, Landscape, Accommodation, Activity, People, Food, Aerial, Detail. Show count next to each.
- **Species**: tag input with autocomplete. Typed text filters a dropdown of known animal names (elephant, lion, leopard, cheetah, rhino, hippo, giraffe, zebra, buffalo, gorilla, wild dog, etc.). Selected items appear as removable pills.
- **Property**: tag input with autocomplete from existing sourceProperty values.
- **Mood**: multi-select checkboxes — Serene, Adventurous, Romantic, Dramatic, Intimate, Luxurious, Wild, Peaceful.
- **Time of Day**: multi-select checkboxes — Dawn, Morning, Midday, Afternoon, Golden Hour, Dusk, Night.
- **Composition**: multi-select checkboxes — Hero, Establishing, Detail, Portrait, Action, Panoramic.
- **Suitable For**: multi-select checkboxes — Hero Banner, Article Feature, Gallery, Thumbnail, Social, Print.
- **Quality**: single-select radio — High, Medium, Low.
- **Hero Only**: toggle switch (pill shape, teal when active).
- **Source**: radio buttons — All, Scraped Only, Generated Only.
- **Clear All Filters** button at bottom — text button in clay color.

**Main area:**

Top bar:
- Search text input (full-width, placeholder "Search by tags, scene, alt text..."), magnifying glass icon on left.
- Result count ("247 images") right-aligned.
- View toggle: grid/list icons.
- Sort dropdown: Relevance, Newest, Country A-Z.

Image grid:
- Responsive masonry layout, 3-4 columns depending on container width.
- Each image card:
  - Thumbnail loaded via imgix with `?w=400&h=300&fit=crop&auto=format`.
  - Rounded corners (4px), subtle shadow on hover.
  - On hover: semi-transparent dark overlay with alt text (white, 13px), country badge (teal pill), type badge (clay pill), species badges (charcoal pills).
  - Bottom-right corner: source indicator — camera icon for scraped images, sparkle icon for AI-generated.
  - Click opens detail panel.
- Infinite scroll with "Load more" button fallback.

Active filter state shown as horizontal row of pills above the grid. Each pill shows filter name and value, with × to remove. Background ivory, border gray.

**Right detail panel (slides in from right, 400px):** Appears when an image is clicked.

- Close button (×) top-right.
- Large preview (imgix with `?w=800&auto=format`). Aspect ratio preserved.
- Below preview, metadata sections:
  - **Tags**: displayed as pills.
  - **Scene description**: italic text.
  - **Country / Destination**: text with flag emoji.
  - **Image Type / Composition / Quality**: labeled values.
  - **Mood / Time of Day**: labeled values.
  - **Animals**: species pills if wildlife.
  - **Source**: "Scraped from [property name]" or "AI Generated".
  - **Dimensions**: e.g., "3200 × 2400".
  - **File size**: e.g., "2.4 MB".
- Action buttons (full width, stacked):
  - "Select as Hero" — teal, prominent (only shown when used as picker).
  - "Edit Metadata" — outlined, opens inline editable fields.
  - "Copy imgix URL" — outlined, copies to clipboard with toast.
  - "Download Original" — outlined.

**Bottom floating bar:** Fixed at bottom, centered, slight shadow upward.
- "Generate New Image" button — clay background, white text, sparkle icon.

### Sample Data

Use these sample images for the mockup:
1. "Leopard in acacia tree at sunset" — Wildlife, Tanzania, Golden Hour, Hero composition, Dramatic mood.
2. "Aerial view of Okavango Delta channels" — Landscape, Botswana, Midday, Establishing, Serene mood.
3. "Luxury tented suite at Singita Grumeti" — Accommodation, Tanzania, Afternoon, Detail, Luxurious mood.
4. "Elephant herd crossing the Mara River" — Wildlife, Kenya, Morning, Action, Wild mood.
5. "Mountain gorilla in Bwindi forest" — Wildlife, Uganda, Morning, Portrait, Intimate mood.
6. "Sundowner setup on safari vehicle" — Activity, South Africa, Golden Hour, Detail, Romantic mood.

### Technical Notes

- This is a Next.js 15 app with Tailwind CSS.
- Images load from `kiuli.imgix.net` CDN.
- Use `next/image` with imgix loader for optimized loading.
- Filter state managed via React `useState`.
- Search and filter trigger server action calls (debounced 300ms for text input).
- Results paginated at 50 per page.
