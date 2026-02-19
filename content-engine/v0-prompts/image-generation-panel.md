# v0 Prompt: Kiuli Image Generation Panel

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

Design a slide-over panel (from right, 600px wide) for generating AI wildlife and nature photography. Same Kiuli brand. The panel has a dark semi-transparent backdrop overlay. Panel itself has white background with subtle left border shadow.

### Section 1: Safety Notice (always visible at top)

A subtle ivory background bar with a teal-bordered left edge. Text:
> "Generated images are limited to wildlife, landscapes, destinations, and countries. Property and accommodation images are never generated to ensure authenticity."

This is ALWAYS visible. It cannot be dismissed.

### Section 2: Subject Selection

- **Type** radio buttons (horizontal pill group):
  - Wildlife | Landscape | Destination | Country
  - Active selection: teal background, white text
  - Inactive: ivory background, charcoal text

Conditional fields based on type:
- **IF Wildlife**: Species input (autocomplete from known animals: elephant, lion, leopard, cheetah, rhino, hippo, giraffe, zebra, buffalo, gorilla, wild dog, etc.) + Country dropdown.
- **IF Landscape**: Destination text input + Country dropdown.
- **IF Destination**: Destination name input + Country dropdown.
- **IF Country**: Country dropdown only.

Countries: Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique.

Optional fields (always shown, collapsed by default):
- **Mood** dropdown — Serene, Adventurous, Romantic, Dramatic, Intimate, Luxurious, Wild, Peaceful.
- **Time of Day** dropdown — Dawn, Morning, Midday, Afternoon, Golden Hour, Dusk, Night.

**IMPORTANT**: If user somehow selects Accommodation or Property as type, show a red warning banner: "Property and accommodation images cannot be generated. These must be authentic photographs." Disable the Generate button.

### Section 3: Prompt Generation

"Generate Prompts" button — teal, full width.

When clicked, shows a loading spinner ("Crafting photographic briefs..."), then displays 3 prompt cards stacked vertically.

Each prompt card:
- White background, 1px gray border, 8px border-radius.
- **Header row**: Aspect ratio badge (e.g., "3:2"), Intent description in italic (e.g., "Intimate portrait in morning mist").
- **Prompt text**: Full photographic prompt, wrapped, readable. Satoshi 14px. This is multi-line text describing the shot.
- **Camera spec summary**: Mono-spaced or small caps — e.g., "400mm f/2.8 | ISO 800 | Golden hour backlight".
- **Edit toggle**: Small "Edit" text button. When active, prompt text becomes a textarea for manual editing.
- **Generate Image button**: Clay background, white text. Per-prompt. Shows loading state with progress indicator.

### Section 4: Generation Results

Below each prompt card, when an image is generated:
- Large preview (400px wide, aspect-ratio preserved).
- The prompt text that produced it (collapsed by default, expandable).
- Three action buttons in a row:
  - "Approve & Save" — teal, primary. Uploads to S3, creates Media, triggers labeling. Shows success toast with "Saved to library" + thumbnail.
  - "Regenerate" — outlined. Same prompt, new image. Replaces the current preview.
  - "Reject" — text button, subtle. Discards the image.

### Interaction Flow

1. User selects type → fills in details
2. Clicks "Generate Prompts" → 3 prompts appear
3. User optionally edits prompts
4. Clicks "Generate Image" on preferred prompt → image appears
5. User approves → image saved to library automatically
6. Panel can be closed, or user generates more

### Sample Data

For the mockup, show:
- Type: Wildlife selected
- Species: "Leopard"
- Country: "Tanzania"
- 3 generated prompt cards:
  1. "A leopard draped over a gnarled acacia branch in the Serengeti, shot with a Canon 400mm f/2.8 telephoto. Golden hour backlighting creates a warm rim around the animal's spotted coat. Shallow depth of field dissolves the savanna background into creamy bokeh."
  2. "Close-up portrait of a leopard's face emerging from tall grass, morning dew visible on whiskers. Nikon 600mm f/4. Eye-level angle with sharp focus on the eyes. Soft directional light from the left."
  3. "A leopard mid-stride across red earth, dust particles catching low afternoon light. Sony 200-600mm at 400mm. Motion frozen at 1/2000s. Warm color temperature, dramatic side lighting."

### Technical Notes

- Panel renders as a React portal or fixed-position overlay.
- Close on backdrop click or Escape key.
- Each generation step is a separate server action call.
- Loading states are non-blocking — user can read prompt cards while one image generates.
