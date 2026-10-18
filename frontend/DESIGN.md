---
name: Cartners
description: A vibrant illustrated cookbook for the shared kitchen.
colors:
  cobalt: "#3549cb"
  cobalt-hover: "#25349f"
  ink: "#292342"
  muted: "#675e76"
  ground: "#fff8ed"
  white: "#fffdf8"
  line: "#ddd5cc"
  pale: "#eee8fb"
  tomato: "#c13927"
  tomato-pale: "#ffe1d5"
  sun: "#ffe27a"
  sun-pale: "#fff0b6"
  lilac: "#e6dcfa"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "clamp(2.7rem, 4.8vw, 4.6rem)"
    fontWeight: 750
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "clamp(2.3rem, 4vw, 3.5rem)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 700
rounded:
  field: "9px"
  control: "10px"
  list: "12px"
  card: "14px"
  feature: "16px"
  pill: "24px"
spacing:
  tight: "8px"
  control: "16px"
  card: "24px"
  section: "28px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "#fff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 11px"
  chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 12px"
  navigation-active:
    backgroundColor: "{colors.tomato-pale}"
    textColor: "#9d291c"
    rounded: "{rounded.control}"
    padding: "13px 14px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  shared-list:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.feature}"
    padding: "24px"
---

# Design System: Cartners

## Overview

**Creative North Star: "The Shared Kitchen Cookbook"**

A contemporary illustrated cookbook translated into a working household app. Warm paper, expressive headings, original ingredient sketches and saturated color fields carry the collaborative cooking energy requested for DubHacks 2026 and the Cook Smarter track. The lowercase cartners wordmark remains the product identity; no sponsor marks or affiliation are implied.

The task area stays readable and direct. Color distinguishes actions and supporting surfaces, while dense shopping and ingredient content remains in rows. Decorative motion is brief; frequently used controls respond immediately.

**Key Characteristics:**
- Warm paper and aubergine ink.
- Cobalt actions, tomato display accents, butter and lilac fields.
- Expressive cookbook headings with clear everyday controls.
- Ingredient illustration alongside real recipe photography.

## Colors

The palette is warm, saturated and food-led. Frontmatter values are normative; CSS in `src/kitchen.css`, loaded after the functional styles by `src/main.jsx`, is the implementation source.

### Primary
- **Cobalt:** primary buttons, links, selection controls and keyboard focus; the darker cobalt is the primary hover state.

### Secondary
- **Tomato:** wordmark and expressive headline emphasis. Tomato pale supports active navigation.
- **Butter:** shared shopping summary and welcome illustration field; pale butter supports quiet summaries and empty states.

### Tertiary
- **Lilac:** recipe discovery, secondary task panels and selected setup choices. Pale lilac supports notices and quiet hover states.

### Neutral
- **Warm Paper:** application canvas.
- **Cream White:** navigation, fields, lists and cards.
- **Aubergine Ink:** primary copy; muted aubergine supplies secondary information.
- **Paper Line:** dividers and navigation boundaries.

**The Cobalt Action Rule.** Cobalt identifies primary actions and focus; tomato supplies display emphasis rather than coloring every button.

The legacy CSS variable `--green` now aliases cobalt; `--dark` aliases ink, and `--rail` aliases cream white. These names do not prescribe a green palette. Warning, error and purchase-status colors remain semantic and are accompanied by text.

## Typography

**Display Font:** Bricolage Grotesque, sans-serif fallback.
**Body Font:** DM Sans, sans-serif fallback.

Both fonts are self-hosted as WOFF2 files with their OFL licenses. The kitchen stylesheet defines the font faces: Bricolage Grotesque (400–800) and DM Sans (400–700). Headings and the wordmark use the display family; content and controls inherit DM Sans.

The display face adds cookbook character through broad, tight-set forms. DM Sans keeps long instructions, labels and household data calm and legible. The frontmatter records representative roles rather than a universal size for every heading.

- **Display:** Home headline; tight leading and a short measure, with responsive overrides.
- **Headline:** feature page headings; mobile pages use a fixed smaller size.
- **Title:** section headings; recipe titles are larger, responsive display compositions.
- **Body:** base copy and request entry; explanatory paragraphs use a comfortable measure up to 70ch. Feature introductions use smaller text.
- **Label:** main buttons; navigation and metadata use smaller contextual sizes. Counts and money use tabular numerals where implemented.

## Layout

Desktop uses a fixed sidebar (224px) and a flexible task area. The main content has a maximum width (1440px), horizontal gutters (40px), and an independently visible household header. All five destinations remain visible on desktop.

Home pairs the request area with a butter shared-list panel. Recipe discovery pairs photography and copy. Shopping pairs its list with a supporting next-step panel. These are page patterns rather than a requirement for every new screen.

At 1200px, the shopping flow becomes one column. Between 701px and 1020px, the sidebar narrows (190px), gutters reduce (26px), and Home becomes one column. At 760px, setup becomes one column and the illustration field recedes after the welcome step. At 700px, navigation becomes a fixed bottom bar with Home, Shopping and More; More exposes the remaining destinations. Main gutters reduce (22px), recipe photography stacks above its copy, and sticky confirmation controls clear the bottom navigation and safe area.

## Elevation & Depth

Broad butter, lilac, cream and paper surfaces establish depth. Primary cards, the request composer, shopping rows and the recipe feature do not use resting shadows. Fine dividers retain structure inside dense lists. Overlays keep functional shadows: the toast uses `0 12px 28px #29234225`; the mobile More menu uses `0 12px 35px #2923421c`.

**The Shared Table Rule.** Use broad tonal fields to organize work; preserve compact rows for dense task content.

## Shapes

Controls have gently curved corners, fields are slightly tighter, and feature fields are broader. Pills distinguish suggestion chips and compact identity controls. Lists share a rounded outer container while individual rows remain square and divided. The original artwork has transparent edges rather than its own card or frame.

## Components

### Buttons

Confident, immediate actions. Primary buttons pair cobalt with white text and darken on hover. Secondary controls use cream with an aubergine outline; feature secondary buttons gain lilac on hover. Main controls have a minimum height (46px), with setup controls at least 48px. The token height denotes this minimum. Disabled controls have reduced opacity (0.55). Fine-pointer hover lifts buttons (1px); press moves them down (1px). Background, text and transform feedback lasts 160ms.

### Chips

Rounded suggestion starters alternate pale butter and lilac on Home. Desktop chips have a minimum height (44px); mobile chips use 40px. Preserve actual labels and native control behavior.

### Cards / Containers

Cream task cards use generous padding, no border and no resting shadow. Butter shared-list and lilac discovery fields have broader corners. Mobile card padding reduces to 20px. Retain row dividers inside list containers.

### Inputs / Fields

Cream fields use a restrained aubergine outline. Standard feature fields have a minimum height (44px); setup fields use 48px. The request composer has a stronger outline, larger corners and a transparent textarea. Focus changes its border to cobalt with a pale cobalt outer outline. Global keyboard focus is a cobalt outline (3px) offset by 4px. Error text and invalid-field states remain explicit.

### Navigation

The desktop rail uses medium-weight labels, simple line icons and pale tomato active rows with deep tomato text. Shopping has a butter count marker. On mobile the bottom bar keeps Home and Shopping visible; an explicit More disclosure provides the other destinations, with lilac for its open state. Active links retain `aria-current` and the main content has a skip link.

### Ingredient artwork and recipe discovery

The original transparent ingredient composition contains tomatoes, lemon, basil, garlic and pasta in a blue bowl. It is optimized as WebP and rendered decoratively with empty alt text and `aria-hidden`. Welcome art arrives once over 700ms using the kitchen easing curve. Home art has a slight rotation on desktop; it becomes still and unrotated for reduced motion. Recipe discovery retains real food photography and the existing slow, pausable carousel. Reduced-motion preferences disable decorative transitions and animation and initialize autoplay paused.

## Do's and Don'ts

### Do:
- **Do** use cobalt for the primary action and visible keyboard focus.
- **Do** retain ingredient sketches as decorative art with empty alternative text.
- **Do** keep shopping and ingredient information readable as rows.
- **Do** preserve reduced-motion behavior and the recipe carousel’s pause control.
- **Do** keep navigation, review, confirmation and recovery controls available at every viewport.

### Don't:
- **Don't** return to the muted green identity.
- **Don't** replace recipe photography with decorative ingredient art.
- **Don't** imply official DubHacks sponsorship or affiliation.
- **Don't** introduce gradients as the new surface language.
- **Don't** hide essential actions behind decorative motion.
