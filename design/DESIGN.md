---
name: Dungeon Crawler Aesthetic
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d6c3b0'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9f8e7c'
  outline-variant: '#524535'
  surface-tint: '#ffb95a'
  primary: '#ffd7a9'
  on-primary: '#462a00'
  primary-container: '#ffb347'
  on-primary-container: '#704700'
  inverse-primary: '#845400'
  secondary: '#f8ffec'
  on-secondary: '#153800'
  secondary-container: '#75fd00'
  on-secondary-container: '#307000'
  tertiary: '#ffd4d0'
  on-tertiary: '#680008'
  tertiary-container: '#ffada5'
  on-tertiary-container: '#a30113'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb6'
  primary-fixed-dim: '#ffb95a'
  on-primary-fixed: '#2a1800'
  on-primary-fixed-variant: '#643f00'
  secondary-fixed: '#80ff2c'
  secondary-fixed-dim: '#67e100'
  on-secondary-fixed: '#092100'
  on-secondary-fixed-variant: '#215100'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: ebGaramond
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: ebGaramond
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: ebGaramond
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: hankenGrotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  stat-label:
    fontFamily: geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
  caption:
    fontFamily: hankenGrotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  card-padding: 16px
  stack-compact: 8px
  stack-loose: 48px
---

## Brand & Style

The design system is engineered to evoke the immersive, high-stakes atmosphere of a classic tabletop RPG session. The brand personality is grim-dark, tactile, and authoritative, targeting seasoned gamers who appreciate the intersection of physical board game textures and digital card-battler precision.

The visual style is **Tactile / Skeuomorphic** blended with **High-Contrast** elements. It relies on the metaphor of a dungeon interior—surfaces should feel heavy like stone or cold like forged iron, while interactive elements emit a magical radiance. The goal is to make the user feel as if they are navigating a physical game board through a digital lens, using depth, subtle glows, and rich textures to differentiate the product from flat, corporate competitors.

## Colors

This design system utilizes a dark-first palette to maintain an atmospheric "dungeon" feel. 

- **Primary (Torch-light Amber):** Used for critical calls to action, gold-tier rarities, and navigational highlights. It represents the warmth of a torch against the dark.
- **Secondary (Slime Green):** Reserved for "Active" states, health/stamina buffs, and common/uncommon monster tiers. 
- **Tertiary (Blood Ruby):** Used for destructive actions, boss-level threats, and low-health warnings.
- **Neutral (Obsidian & Stone):** A range of deep blacks and weathered grays forms the structural foundation, mimicking the shadows and walls of a crawl space.

Surfaces should primarily use the neutral palette, with accents used sparingly to guide the eye toward interactive "treasures" or "threats."

## Typography

The typography in the design system creates a dialogue between the ancient and the modern. 

**Headlines** utilize a weathered, high-contrast serif to mimic stone inscriptions or parchment scrolls. These should be set with tight tracking to feel dense and impactful. 

**Body Text** uses a sharp, clean sans-serif to ensure legibility during long reads of game rules or item descriptions. 

**UI Labels and Stats** utilize a technical monospaced-adjacent font. This provides a "mechanical" feel for game data, ensuring numbers and values are easily scannable and feel like a programmatic readout of a monster's power.

## Layout & Spacing

The design system employs a **Fixed Grid** layout to reinforce the feeling of a structured board game. The interface should feel contained and deliberate rather than expansive.

- **Desktop:** 12-column grid with a max-width of 1280px. Gutters are kept wide (24px) to allow the "stone" backgrounds to breathe between cards.
- **Tablet:** 8-column grid with 16px margins. 
- **Mobile:** 4-column grid. Content should stack vertically, prioritizing the "Monster Card" as the primary unit of information.

Spacing follows a strict 4px base unit. Negative space should be used to create focus, but the overall layout should feel "dense" and rich, avoiding the airy emptiness of traditional minimalism.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Glows**. 

Instead of traditional drop shadows, this design system uses "recessed" and "extruded" effects. Backgrounds act as the deepest layer (Level 0). Cards and buttons (Level 1) use subtle inner glows to appear as if they are illuminated from within or highlighted by a nearby torch. 

High-priority elements (Level 2), such as modals or hovered cards, should feature a soft "outer bloom" in the primary amber or secondary green color, suggesting a magical aura. Borders are never flat; they should appear as "beveled edges" or "forged metal frames" using thin, 1px highlights on the top and left edges and darker 1px shadows on the bottom and right.

## Shapes

The shape language is "Soft-Sharp." While we avoid the clinical feel of 0px corners, we also avoid the friendliness of high roundedness. A 0.25rem (4px) corner radius is the standard for cards and buttons, mimicking the slightly worn corners of a physical cardboard game card or a carved stone slab. 

Interactive items like "Action Buttons" may use a slightly more pronounced radius for comfort, but the overall geometry remains architectural and sturdy.

## Components

### Buttons
Buttons are styled as "Stone Slabs" or "Forged Plates." They feature a subtle vertical gradient (lighter at the top). On hover, the inner glow intensifies. The "Primary" button uses the Torch Amber for text and a 1px border.

### Monster Cards
The centerpiece of the design system. Cards must have a decorative inner border (0.5rem inset) and a dedicated "Rarity Header." The top 60% of the card is reserved for creature artwork, while the bottom 40% uses the technical `stat-label` typography for attributes like Attack, Defense, and Speed.

### Inputs & Fields
Input fields are "Carved" into the UI. Use a dark background with an inner shadow to create a recessed effect. The cursor and focus state should utilize the Slime Green glow.

### Chips & Tags
Chips represent "Status Effects" (e.g., Poisoned, Burning). They use a heavy border and high-saturation background colors from the accent palette, appearing as small "Gems" or "Runes" embedded in the interface.

### Progress Bars
Health and XP bars should not be smooth. They should be segmented, looking like a row of small glass vials or a carved stone track that fills with luminous liquid.