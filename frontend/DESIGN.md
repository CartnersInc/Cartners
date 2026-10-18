---
name: Common
description: Retained visual system for the shared shell, Home, and Plans.
colors:
  ink: "#233c2c"
  muted: "#596751"
  green: "#347841"
  dark: "#244c2c"
  rail: "#d9e7cd"
  ground: "#faf9f2"
  line: "#dbe0d1"
  pale: "#eaf0e1"
  white: "#fffef9"
  focus: "#4575a0"
typography:
  headline:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-.035em"
  title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: ".82rem"
    fontWeight: 750
rounded:
  control: "8px"
  surface: "14px"
  chip: "24px"
spacing:
  compact: "8px"
  control-gap: "10px"
  related: "12px"
  standard: "16px"
  mobile-gutter: "20px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.dark}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  navigation-active:
    backgroundColor: "{colors.dark}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
  preferences-panel:
    backgroundColor: "{colors.pale}"
    rounded: "{rounded.surface}"
    padding: "22px"
---

# Design System: Common

## Overview

**Creative North Star: "Common's established warm green world"**

Common retains its established warm green visual system: Manrope, dark green text, a pale green navigation rail, a warm ground, and the original food photography. This record describes the shared shell, Home, and Plans as implemented; it does not establish styles for teammate-owned feature screens.

**Key Characteristics:**
- Warm tonal surfaces and fine dividing lines.
- Rounded controls, restrained photography, and compact supporting text.
- A five-area shell that changes from a side rail to bottom navigation.

## Colors

Green carries actions and selected navigation. Ink carries headings and main text; muted carries supporting text. Rail anchors navigation, ground carries the page, white carries editable surfaces, pale groups preferences and notices, and line separates rows. The focus color identifies keyboard position. Values in the frontmatter are extracted from the current stylesheet.

## Typography

Manrope is used throughout, with Arial and sans-serif fallbacks. Headings use compact tracking; paragraphs have open leading and a maximum width of 70ch. Home's initial heading uses the headline role; draft and Plans headings use smaller local sizes. At the mobile breakpoint, Home's initial heading is 2rem, its draft heading is 1.65rem, and the Plans heading is 1.7rem. Supporting interface text ranges from .65rem to .95rem. Button labels are bold, sentence case.

## Layout

The desktop shell has a fixed 210px rail and a flexible content column. Main content is centered with a 1320px maximum width. At 1100px, page gutters reduce to 28px; Home's columns and Plans' weekly list/preferences sidebar collapse at 900px. At 700px, the rail becomes a fixed five-item bottom navigation, gutters become 20px, group selection wraps below the wordmark, and content reserves bottom space including the safe-area inset. At 1600px, the main top padding increases to 40px.

Home begins with the request composer and an illustrative photograph, then switches to a full-width introduction above a two-column draft review. Plans uses dated rows and a separate preferences surface. These describe the scoped pages, not a required composition for every screen.

## Elevation & Depth

The scoped implementation is flat: no box shadows. Warm ground, white editable surfaces, pale preference/notice surfaces, borders, and open spacing distinguish layers. The photograph is clipped into a rounded surface with a white caption. A dark fixed toast communicates a completed update.

## Shapes

Controls and active navigation share softly rounded corners; composer, photograph, and preferences panel use the larger surface radius. Starter chips are pill shaped. Row separators are thin and quiet. Avatars are circular. Checkbox accents use green.

## Components

- **Buttons:** primary actions use green and turn dark on hover; secondary actions use white with a fine border and pale hover. Text actions use green and underline on hover. Controls have a 44px minimum height. Background transitions last 180ms with ease-out; reduced-motion preference removes transitions and animations.
- **Focus and disabled states:** keyboard focus has a 3px outline with a 4px offset. Disabled buttons use .55 opacity and a not-allowed cursor. Pending labels describe the operation underway.
- **Composer and fields:** the composer has a white surface, fine green-gray border, larger radius, and a resizable textarea. Focus within changes its border to green. Preferences use labeled white fields with 7px corners and helper text.
- **Starter chips:** outlined, transparent, bold compact labels; pale hover. Sample mode selects a fixed preview, while connected mode fills the request input.
- **Navigation:** five labeled icon links; the selected area has a dark fill and warm white content. Mobile links place the icon above the label. A skip link and focusable main region support keyboard navigation.
- **Draft review:** source and status text distinguish samples, live suggestions, clarification, stale previews, failures, and saved results. Ingredient checkboxes edit the pending inclusion list. A successful save exposes its feedback, Undo, and View cart. Feedback remains explicit rather than relying on color alone.
- **Plans and preferences:** date rows use fine separators and a dark today tile. Empty dates route to Home with that date; browsing weeks does not invoke AI or add groceries. Preferences switch between a definition list and an inline labeled form with Cancel and Save preferences.

## Do's and Don'ts

### Do:
- Do retain Manrope, the established palette, and original food photography.
- Do use visible keyboard focus, labeled controls, and the implemented 44px minimum control height.
- Do distinguish sample, pending, error, stale, and saved states with explicit text.

### Don't:
- Don't introduce a replacement visual identity or new palette in this scoped extension.
- Don't imply a preview has been saved or a live service is available before the corresponding state is confirmed.
