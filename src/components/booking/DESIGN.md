---
name: Dentara booking
description: Scoped visual rules for the existing booking calendar, details form, and visit summary.
colors:
  primary: "#052927"
  accent: "#0454ff"
  accent-hover: "#0040cc"
  teal: "#0b5953"
  teal-mid: "#0f766e"
  white: "#ffffff"
  bg-light: "#f5f8fb"
  bg-hero: "#edf2ff"
  border-teal: "#dbeae9"
  buffer-bg: "#fff7e9"
  buffer-text: "#825714"
  error-bg: "#fff1ec"
  error-text: "#962d24"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-.035em"
  body:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
rounded:
  field: "8px"
  panel: "16px"
  action: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "13px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
---

# Design System: Dentara booking

## Overview

These rules apply only to `/booking`, implemented in `src/pages/booking.astro`, `src/styles/booking.css`, and `src/lib/booking/client.ts`. The surface inherits the clinic's Bricolage Grotesque headings, Inter body text, dark teal, blue actions, and pale cool surfaces from `src/styles/global.css`. Shared navigation and footer retain their incumbent styling.

The booking interface uses restrained borders, compact labels, native form controls, and explicit appointment states. It ships inline SVG icons and CSS geometry; there are no new raster assets. Product constraints and the surface direction remain in `PRODUCT.md` and `.impeccable/booking-brief.md`.

## Colors

Primary teal carries headings and body text; teal-mid carries supporting descriptions. Blue identifies actionable progression and selected dates or times. White is the main canvas, bg-light distinguishes the visit summary and unavailable slots, and bg-hero distinguishes the demo notice and date hover.

Buffer slots use the warm buffer colors; error messages use the error colors. Text labels accompany appointment status colors. Selection reverses text to white, including the slot's “Selected” label.

## Typography

Headings use the inherited heading stack at weight 500. The introductory title is 44px, reduces to 38px at 900px, and becomes 34px at 600px. Calendar and times headings are 20px; the summary heading is 22px. Details and confirmation headings are larger than their supporting text.

Inter supplies controls and supporting copy, primarily 11–14px. Patient text inputs remain 16px; service and buffer selects also become 16px on mobile. Date buttons, slots, and summary values use tabular numerals for stable scanning.

## Layout

The shell is centered at a maximum width of 1260px with 40px horizontal padding. The desktop workspace pairs a flexible scheduler with a 296px summary and a 28px gap. The scheduler places the service selector above adjacent calendar and time columns. The summary becomes sticky from 1100px, below the shared navigation.

- At 1100px and below: shell padding becomes 24px, the summary narrows to 260px, the workspace gap is 20px, and time slots use two columns.
- At 900px and below: the summary follows the scheduler in a single workspace column and uses two internal columns. The calendar and times remain adjacent; slots return to three columns. The summary address is hidden.
- At 600px and below: shell padding becomes 16px; service controls, calendar, times, summary, and settings stack. The calendar's vertical divider becomes a horizontal divider. Slots remain in three columns, at least 54px tall; calendar days are 44px tall. Confirmation actions stack.

The details form replaces the scheduler while retaining the summary. Confirmation replaces the workspace with a centered panel capped at 720px. Hidden steps use `display: none`, so they do not occupy layout or keyboard navigation.

## Elevation & Depth

Booking panels are flat. Borders separate the scheduler, form, and confirmation; the summary uses a pale fill. Today's date has a one-pixel inset teal outline. Booking actions change color on hover without lift or shadow. Slot and primary-button transitions are 150ms ease-out; reduced-motion preferences disable transitions within the booking page.

## Shapes

Main panels use 16px corners, native fields and calendar days use 8px, and time slots use 7px. Primary actions use 30px pill corners and a minimum height of 48px, increasing to 50px on mobile. Numbered progress markers and the confirmation check background are circular. Borders are generally one pixel.

## Components

**Calendar and times.** Dates are native buttons in a seven-column group with full-date accessible labels. Today has `aria-current="date"`; the selected date has `aria-pressed="true"`. Unavailable dates are disabled. Arrow keys change dates and skip unavailable days. Month navigation is bounded by the booking window. Morning, afternoon, and evening are pressed-state filter buttons with a blue underline for the active period.

Time buttons expose both their time and status. Available slots have a white fill and teal border; booked slots have muted fill and struck-through times; buffers have a warm fill. Past and too-short slots are muted and disabled. Visible labels distinguish “Booked,” “Buffer,” “Unavailable,” and “Too short”; explanatory copy defines insufficient gaps. Selecting an available slot turns it blue and labels it “Selected.”

**Summary and progression.** A definition list shows duration, date, and time; supporting copy explains the buffer and clinic timezone. Continue stays disabled until a time is selected. Progress uses an ordered list with `aria-current="step"`; completed step markers receive a pale green fill. Changes that invalidate the selection clear it, announce the change, and return the flow to date/time when necessary.

**Details and confirmation.** The form uses persistent labels, autocomplete attributes, native required/email/phone validation, grouped visit radios, and explicit demo consent. Busy submission disables its action and changes the label to “Saving your demo booking…”. Confirmation shows a check mark, a visit definition list, a browser-only demo notice, and actions to return to the calendar or contact the clinic.

**Loading, empty, and error states.** Initial calendar copy communicates loading while controls are disabled and the workspace is `aria-busy`. Empty slot periods show explanatory text. A warm error panel uses `role="alert"` and provides a reload action. A visually hidden polite status region announces date, period, and selection changes. Native `<details>` keeps demo buffer settings collapsible.

**Focus.** Buttons, inputs, selects, links, and disclosure summaries within the booking page receive a three-pixel blue `:focus-visible` outline offset by four pixels. The skip link becomes visible on focus. Details and confirmation transitions focus their headings; returning to date/time restores the chosen time, and returning from confirmation focuses the calendar heading. Calendar and slot rerenders preserve the focused button when it remains enabled; otherwise they focus the times heading. Programmatic heading targets have scroll margin below the shared navigation.

## Do's and Don'ts

- Do inherit shared color and font variables before adding local values.
- Do preserve text labels alongside color for availability, selection, and buffers.
- Do keep keyboard focus stable when replacing calendar or slot buttons.
- Do retain the browser-only demo wording throughout the booking flow.
- Don't turn booking-specific geometry into a replacement for the site's shared navigation, footer, or global buttons.
- Don't imply that the demo reserves a clinic appointment or sends a notification.
