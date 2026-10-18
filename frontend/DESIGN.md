---
name: Cartners
description: A warm, playful shared kitchen with clear motion and practical AI assistance.
colors:
  warm-blue: '#2e6a7e'
  warm-blue-hover: '#214f60'
  ink: '#4b2d26'
  muted: '#786052'
  ground: '#fff4e1'
  white: '#fffdf6'
  line: '#e2d2ba'
  pale: '#f5e8cf'
  paprika: '#b54128'
  paprika-pale: '#f9dfc8'
  gold: '#efb74e'
  parchment: '#faeac8'
  apron: '#f2e4cd'
typography:
  display:
    fontFamily: Bricolage Grotesque, sans-serif
    fontSize: clamp(2.7rem, 4.8vw, 4.6rem)
    fontWeight: 750
    lineHeight: 0.99
    letterSpacing: -0.035em
  headline:
    fontFamily: Bricolage Grotesque, sans-serif
    fontSize: clamp(2.3rem, 4vw, 3.5rem)
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: -0.035em
  title:
    fontFamily: Bricolage Grotesque, sans-serif
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.025em
  body:
    fontFamily: DM Sans, sans-serif
    fontSize: 1rem
    lineHeight: 1.65
  label:
    fontFamily: DM Sans, sans-serif
    fontSize: 0.84rem
    fontWeight: 700
rounded:
  field: 9px
  control: 10px
  list: 12px
  card: 14px
  feature: 16px
  pill: 24px
spacing:
  tight: 8px
  control: 16px
  card: 24px
  section: 28px
  desktop-gutter: 40px
components:
  button-primary:
    backgroundColor: '{colors.warm-blue}'
    textColor: '#fff'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 11px 16px
    height: 46px
  button-primary-hover:
    backgroundColor: '{colors.warm-blue-hover}'
  button-secondary:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 11px 16px
  input:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
    padding: 8px 11px
  chip:
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    padding: 9px 12px
  navigation-active:
    backgroundColor: '{colors.paprika-pale}'
    textColor: '#8e3f25'
    rounded: '{rounded.control}'
    padding: 13px 14px
  card:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.card}'
    padding: 24px
  shared-list:
    backgroundColor: '{colors.parchment}'
    textColor: '{colors.ink}'
    rounded: '{rounded.feature}'
    padding: 24px
---


# Design System: Cartners

## Overview

**Creative North Star: "The Playful Shared Kitchen"**

Cartners brings the warmth and playful kitchen-object language of the user-pinned [DubHacks 2026 reference](https://dh26.dubhacks.co/) into a practical household app. Cream paper, cocoa text, warm blue actions and flat original cooking illustrations establish the replacement world. The user rejected the earlier purple/yellow palette and engraved ingredient treatment; those are not the visual authority for future work. Cartners retains its lowercase wordmark and does not imply event sponsorship or affiliation.

The Cook Smarter direction centers on less coordination work: AI helps turn a request into a reviewed list, while spatial feedback makes changes understandable. Motion follows the user’s work through navigation, setup, drafting, list updates and disclosures. Dense task information stays in readable rows.

**Key Characteristics:**
- Warm cream and cocoa with restrained warm blue actions.
- Parchment and apron fields with paprika display accents.
- Flat, playful original kitchen objects alongside real recipe photography.
- State-preserving surfaces, visible progress and immediate control feedback.

## Colors

The palette follows the warm cream, cocoa and muted blue character of the selected reference. Frontmatter values are normative; `src/kitchen.css`, loaded after functional styles by `src/main.jsx`, supplies the implementation values.

### Primary
- **Warm Blue:** main actions, links, focus outlines, progress and selection controls; the deeper blue is the hover state.

### Secondary
- **Paprika:** wordmark and expressive headline emphasis; pale paprika marks active navigation.
- **Gold:** shopping counts, selected text and compact cart summaries.

### Tertiary
- **Parchment:** the Home shared list, welcome story and quiet supporting summaries.
- **Apron:** discovery panels, selected setup choices and secondary task fields.

### Neutral
- **Cream Paper:** the application canvas.
- **Cream White:** navigation, cards and fields.
- **Cocoa Ink:** primary content; muted cocoa supports secondary copy.
- **Paper Line:** subtle borders and dividers; pale paper supports notices.

**The Blue Action Rule.** Warm blue identifies primary actions and focus; paprika adds display emphasis without coloring every button.

Legacy implementation names `--green` and `--cobalt` both resolve to warm blue; `--dark` resolves to cocoa and `--rail` to cream white. Their names do not prescribe the earlier colors. Warning, error and purchase states retain semantic colors and explicit text.

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

Home pairs the request area with a parchment shared-list panel. Recipe discovery pairs photography and copy. Shopping pairs its list with a supporting next-step panel. These are page patterns rather than a requirement for every new screen.

At 1200px, the shopping flow becomes one column. Between 701px and 1020px, the sidebar narrows (190px), gutters reduce (26px), and Home becomes one column. At 760px, setup becomes one column and the illustration field recedes after the welcome step. At 700px, navigation becomes a fixed five-column bottom bar. Home, Shopping, This week, Spending and Household all remain directly visible; no More menu is used. Main gutters reduce (22px), recipe photography stacks above its copy, and sticky confirmation controls clear the bottom navigation and safe area.

## Elevation & Depth

Parchment, apron, cream and paper fields establish most depth. Cards, the request composer, shopping rows and the recipe feature remain flat. Buttons have a soft resting shadow (`0 3px 7px #4b2d2610`), deepen on fine-pointer hover (`0 6px 12px #4b2d2618`) and lose their shadow on press. Toasts use `0 12px 28px #4b2d2625`. Fine dividers structure dense lists.

**The Shared Table Rule.** Use broad tonal fields to organize work; preserve compact rows for dense task content.

## Shapes

Controls have gently curved corners, fields are slightly tighter, and feature fields are broader. Pills distinguish suggestion chips and compact identity controls. Lists share a rounded outer container while individual rows remain square and divided. The original artwork has transparent edges rather than its own card or frame.

## Components

### Buttons

Confident, immediate actions. Primary buttons pair warm blue with white text and darken on hover. Secondary controls use cream with a cocoa outline; feature secondary buttons gain apron on hover. Main controls have a minimum height (46px), with setup controls at least 48px. The token height denotes this minimum. Disabled controls have reduced opacity (0.55). Fine-pointer hover lifts buttons (1px); press moves them down (1px) and scales them to 0.98. Background, text and transform feedback lasts 160ms.

### Chips

Rounded suggestion starters alternate parchment and apron on Home. Desktop chips have a minimum height (44px); mobile chips use 40px. Preserve actual labels and native control behavior.

### Cards / Containers

Cream task cards use generous padding, no border and no resting shadow. Parchment shared-list and apron discovery fields have broader corners. Mobile card padding reduces to 20px. Retain row dividers inside list containers.

### Inputs / Fields

Cream fields use a restrained cocoa outline. Standard feature fields have a minimum height (44px); setup fields use 48px. The request composer has a stronger outline, larger corners and a transparent textarea. Focus changes its border to warm blue with a pale warm blue outer outline. Global keyboard focus is a warm blue outline (3px) offset by 4px. Error text and invalid-field states remain explicit.

### Navigation

All five destinations appear in the desktop rail and the mobile bottom bar: Home, Shopping, This week, Spending and Household. Medium-weight labels accompany simple line icons. Pale paprika active rows use deep paprika text; shopping has a gold count marker. The mobile bar uses five equal columns, compact labels (0.64rem), and minimum-height links (54px). Active links retain `aria-current`, and main content has a skip link. Route changes focus the main region, reset scroll and provide a brief surface transition.

### Composer and state continuity

Typed content strengthens the composer border; pending work changes its field color and adds a progress strip inside the same field. The textarea grows with content where supported. Progress is indeterminate rather than an invented completion percentage. A returned draft receives heading focus and scrolls into view; reduced motion uses immediate scrolling. Route, draft and setup changes use a small upward reveal (8px over 220ms). Home remains mounted to preserve work. Shopping insertions and reorder changes animate from previous row positions over 240ms.

### Ingredient artwork and recipe discovery

The original transparent flat illustration groups a cream grocery tote, tomato, pepper, leek and onion with a light-blue saucepan, wooden spoon and recipe card. It uses simple silhouettes and clean flat colors, with no engraving or hatching. The optimized WebP is decorative with empty alt text and `aria-hidden`. Welcome art arrives once over 700ms; Home art has a slight desktop rotation and straightens on fine-pointer hover over 500ms.

Recipe discovery retains real photography. Horizontal dragging or swiping the image changes the recipe while `touch-action: pan-y` preserves vertical page scrolling. Previous, Next and Pause remain visible. Slides enter from the chosen direction (24px over 650ms); autoplay waits 12 seconds and pauses during hover or keyboard interaction. Disclosures reveal their content using native size interpolation where supported; unsupported browsers retain native disclosure behavior.

Reduced-motion preferences disable the welcome and recipe animations, surface and list movement, progress traversal, and interactive transform feedback. The progress strip becomes a static full-width indicator. Short color and opacity feedback remains; carousel autoplay initializes paused.

## Do's and Don'ts

### Do:
- **Do** use warm blue for the primary action and visible keyboard focus.
- **Do** retain flat kitchen-object artwork as decorative art with empty alternative text.
- **Do** keep shopping and ingredient information readable as rows.
- **Do** preserve reduced-motion behavior and the recipe carousel’s pause control.
- **Do** keep navigation, review, confirmation and recovery controls available at every viewport.

### Don't:
- **Don't** return to the rejected purple/yellow palette or engraved ingredient treatment.
- **Don't** replace recipe photography with decorative kitchen art.
- **Don't** imply official DubHacks sponsorship or affiliation.
- **Don't** introduce gradients as the new surface language.
- **Don't** hide essential actions behind decorative motion.
