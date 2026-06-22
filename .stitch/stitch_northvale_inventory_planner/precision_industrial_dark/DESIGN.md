---
name: Precision Industrial Dark
colors:
  surface: '#111316'
  surface-dim: '#111316'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#a4c9ff'
  on-secondary: '#00315d'
  secondary-container: '#0267b8'
  on-secondary-container: '#d6e5ff'
  tertiary: '#b6c6ef'
  on-tertiary: '#1f3050'
  tertiary-container: '#8091b6'
  on-tertiary-container: '#182949'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a4c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004883'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#b6c6ef'
  on-tertiary-fixed: '#081b3a'
  on-tertiary-fixed-variant: '#364768'
  background: '#111316'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style
The design system is engineered for high-performance industrial environments where clarity and visual comfort are paramount. It targets manufacturing floor managers and logistics leads who require a premium, data-dense interface that reduces eye strain during long shifts.

The aesthetic blends **Modern Corporate** efficiency with **Glassmorphism** and **Tactile** depth. It avoids the harshness of pure black, opting for a deep charcoal foundation that allows for sophisticated layering. The emotional response is one of controlled power, reliability, and technological sophistication—moving away from "industrial grit" toward "precision aerospace" aesthetics.

## Colors
This design system utilizes a tiered dark-mode palette to establish a clear information hierarchy.

- **Foundational Neutrals:** The base background is a deep charcoal (#121417). Surfaces use a slightly lighter charcoal (#1E2126) to create depth.
- **Accents:** Electric cobalt serves as the primary action color. The soft cyan is used for secondary interactive elements, data visualization highlights, and "glow" effects to soften the dark interface.
- **Hero Surface:** A deep navy (#1A2B4B) is reserved for high-level dashboard summaries or "Hero" cards to anchor the user's attention.
- **Semantics:** Warning, critical, and success colors are slightly desaturated to ensure they don't vibrate against the dark background while remaining highly legible for status monitoring.

## Typography
Plus Jakarta Sans is the sole typeface, chosen for its modern geometric clarity and excellent legibility at small sizes. 

- **Casing:** Utilize sentence case for all headlines and labels to maintain a friendly yet professional tone. Avoid all-caps except for very small, high-contrast badges or metadata tags.
- **Weight:** Use Bold (700) for primary headlines and SemiBold (600) for UI labels to ensure they "pop" against the dark background.
- **Hierarchy:** Maintain generous line height for body text to improve readability in high-glare environments (like a factory floor).

## Layout & Spacing
The layout follows an **8px grid system** to ensure mathematical consistency. 

- **Grid Strategy:** A 12-column fluid grid is used for desktop, collapsing to a single-column view for mobile warehouse scanning devices.
- **Density:** While the design is "airy" to convey a premium feel, data tables and inventory lists utilize "compact" vertical spacing (8px–12px padding) to maximize information density without clutter.
- **Breakpoints:**
  - Mobile: < 600px (16px margins)
  - Tablet: 600px - 1024px (24px margins)
  - Desktop: > 1024px (Max container width 1440px)

## Elevation & Depth
Depth is created through a combination of **Tonal Layering** and **Subtle Glows** rather than traditional heavy shadows.

- **Layer 0 (Background):** #121417.
- **Layer 1 (Cards/Sidebar):** #1E2126. Features a 1px solid border (#2D3139) to define edges.
- **Layer 2 (Modals/Popovers):** Slightly lighter than Layer 1 with a soft blue-tinted drop shadow (0px 10px 30px rgba(0, 0, 0, 0.5)).
- **Glass Effects:** Use backdrop filters (blur: 12px) on navigation bars and overlay panels, utilizing a 10% opacity white tint to simulate polished glass.
- **Interaction:** Active elements (like selected sidebar items) should use a subtle inner glow of the primary cobalt blue.

## Shapes
The shape language is sophisticated and approachable. All primary UI containers, including cards, modals, and main action areas, utilize a **16px (rounded-lg)** radius. 

- **Buttons & Inputs:** Use a 12px radius to appear slightly more precise than the larger containers they sit within.
- **Badges/Chips:** Use a full pill-shape (999px) for status indicators to distinguish them from interactive buttons.
- **Visual Rhythm:** Ensure that nested elements always have a radius smaller than their parent container to maintain visual harmony.

## Components
- **Buttons:** 
  - *Primary:* Solid Electric Cobalt with white text. 
  - *Secondary:* Ghost style with a 1px Cyan border and Cyan text. 
  - *States:* Hovering on primary buttons should trigger a soft cyan outer glow (bloom).
- **Cards:** Use #1E2126 background with 16px padding. Hero cards for "Stock Alerts" use the deep navy #1A2B4B with a subtle cobalt gradient border.
- **Input Fields:** Darker than the surface (#15171B), 12px radius, with a 1px border that turns Electric Cobalt on focus.
- **Status Chips:** Small, pill-shaped, using 15% opacity of the semantic color for the background and 100% opacity for the text (e.g., Success chip: Emerald text on 15% Emerald background).
- **Inventory Lists:** Use zebra-striping with a very subtle difference in charcoal tones or a 1px divider (#2D3139) to separate items.
- **Specialty Components:** Include "Stock Level Gauges" using progress bars with gradients from Cobalt to Cyan to signify healthy levels.