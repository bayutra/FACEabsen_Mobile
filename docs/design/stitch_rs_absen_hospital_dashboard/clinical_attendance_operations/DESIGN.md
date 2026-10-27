---
name: Clinical Attendance & Operations
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#005c54'
  on-tertiary: '#ffffff'
  tertiary-container: '#00776d'
  on-tertiary-container: '#91fdef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  tabular-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a clinical, precise, and dependable interface tailored for healthcare workforce management. Designed for hospital supervisors, clinical unit managers, and central HR administrators, the design emphasizes visual calm, non-fatiguing data surfaces, and immediate operational clarity during critical round handovers and multi-shift tracking.

The design movement combines **Modern Healthcare Utility** with **Subtle Tonal Layering**. It rejects noisy decorative trends in favor of structural clarity, high data legibility, and unmistakable operational states. The aesthetic evokes clinical hygiene, high accountability, and quiet efficiency—reducing cognitive friction when auditing attendance logs, approving emergency shift swaps, or reviewing medical department staffing quotas.

## Colors

The palette uses clinical teal as its primary anchor to convey professional medical authority, complemented by precision sky blue for secondary actions and telemetry indicators. Surface hierarchies rest on neutral slate tones rather than pure black or sterile stark gray, minimizing eye strain under hospital ambient lighting.

### Palette Roles & Mappings
- **Primary (`#0F766E`)**: System navigation, primary action triggers, validated timestamps, and selected administrative states. Interactive focus states leverage mid-teal (`#0D9488`), while light teal (`#CCFBF1`) serves as the active item fill.
- **Secondary (`#0284C7`)**: Information links, secondary review triggers, shift assignment badges, and active operational telemetry.
- **Tertiary (`#0D9488`)**: Secondary metrics, sub-navigation tabs, and confirmed check-in badges.
- **Neutral Canvas & Tiers**:
  - Application Canvas: `#F8FAFC` (Slate 50)
  - Card & Container Surface: `#FFFFFF`
  - Subtle Section Fill: `#F1F5F9` (Slate 100)
  - Structural Borders: `#E2E8F0` (Slate 200)
  - Text Primary: `#0F172A` (Slate 900)
  - Text Secondary: `#475569` (Slate 600)
  - Text Muted: `#64748B` (Slate 500)

### Status & Shift States (Bahasa Indonesia)
- **Tepat Waktu / Hadir (Success)**: Foreground `#065F46`, Border `#A7F3D0`, Background `#ECFDF5`.
- **Terlambat / Pulang Cepat (Warning)**: Foreground `#92400E`, Border `#FDE68A`, Background `#FFFBEB`.
- **Sangat Terlambat / Ditolak / Alpa (Danger)**: Foreground `#991B1B`, Border `#FECACA`, Background `#FEF2F2`.
- **Izin / Cuti / Review Shift (Info)**: Foreground `#075985`, Border `#BAE6FD`, Background `#F0F9FF`.

All text-to-background combinations maintain a minimum 4.5:1 contrast ratio to ensure compliance with WCAG AA accessibility standards.

## Typography

Typography is set exclusively in **Inter** to ensure geometric neutrality, robust tabular alignment, and immediate recognition across critical medical rosters and timestamps.

### Typographic Principles
- **Tabular Figures**: All attendance times (`07:02:14 WIB`), shift counts, and employee NIK numbers must use `font-variant-numeric: tabular-nums` to guarantee vertical grid alignment inside tables and lists.
- **Hierarchy in Density**: Headings use tight negative tracking (`-0.01em` to `-0.02em`) for cohesion, while status labels and badges utilize uppercase or tracking-expanded small text (`+0.02em` to `+0.04em`) to remain distinct at small scales.
- **Visual Weight**: Regular weight (`400`) handles body narratives and metadata descriptions, Medium (`500`) defines interactive values and table cells, while Semibold (`600`) and Bold (`700`) are reserved for section targets, key metrics, and module titles.

## Layout & Spacing

The layout adopts a **Fluid Administrative Grid** bounded by a standard 1440px viewport container to balance panoramic overview with scannable lines. A multi-column structure adapts across viewports:

- **Desktop (>= 1280px)**: 12-column grid, permanent 260px collapsible clinical sidebar navigation, `margin-desktop` (2rem), and `gutter-desktop` (1.5rem).
- **Tablet / Workstation (768px – 1279px)**: 8-column layout, compact icon sidebar (72px) or collapsible drawer, `margin-tablet` (1.5rem), and `gutter` (1.25rem).
- **Mobile (<= 767px)**: 4-column flow, full-width data lists with sticky top headers, bottom action drawers, and `margin` (1rem).

Layout spacing operates on an absolute 4px/8px incremental rhythm. Spacing within modules prioritizes compact scanning: tight component gaps (`space-xs` and `space-sm`) keep labels tied directly to their data fields, while `space-lg` and `space-xl` cleanly segment independent patient wards, departments, and shift groups.

## Elevation & Depth

Visual hierarchy uses **Low-Contrast Outlines paired with Ambient Micro-Shadows**. In clinical dashboards, heavy drop shadows cause visual noise and obscure subtle borders. Depth is instead defined through strict surface containment:

- **Surface Level 0 (Canvas)**: `#F8FAFC` base application background.
- **Surface Level 1 (Card & Module Layer)**: `#FFFFFF` background with a mandatory `1px solid #E2E8F0` border and an ambient micro-shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Surface Level 2 (Flyouts & Dropdown Filters)**: `#FFFFFF` container with `1px solid #CBD5E1` border and elevated shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Surface Level 3 (Shift Modal & Dialog Overlays)**: `#FFFFFF` surface resting over a backdrop overlay of `#0F172A` at 40% opacity, elevated by `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

Hover interactions across interactive rows or roster cards never jump in elevation; they transition surface color from `#FFFFFF` to `#F8FAFC` with a border color shift to `#CBD5E1`.

## Shapes

The design uses balanced, modern geometric rounding to ensure comfort without sacrificing enterprise structure. 

- **Containers & Cards (`rounded-lg`)**: 12px (`0.75rem`) border radius, framing major data sections, shift schedules, and operational statistics.
- **Interactive Controls (`rounded`)**: 8px (`0.5rem`) border radius, applied uniformly to input fields, regular buttons, table action triggers, and filter chips.
- **Status Tags & Badges**: 6px (`0.375rem`) border radius or fully rounded pill (`9999px`) for individual attendance markers (`Hadir`, `Izin`, `Cuti`).
- **Modals & Dialogs (`rounded-xl`)**: 16px (`1rem`) border radius for floating administrative overlays.

## Components

### Buttons
- **Primary**: Solid background `#0F766E`, text `#FFFFFF`, border `transparent`, 8px border radius. Hover: `#0D9488`. Active: `#115E59`. Focus: ring 2px `#0F766E` with 2px offset.
- **Secondary**: Solid background `#FFFFFF`, text `#0F766E`, border `1px solid #CCFBF1`. Hover: `#F0FDFA` background, border `#99F6E4`.
- **Destructive**: Solid background `#EF4444`, text `#FFFFFF`, border `transparent`. Hover: `#DC2626`.
- **Tertiary / Ghost**: Transparent background, text `#475569`. Hover: background `#F1F5F9`, text `#0F172A`.

### Badges & Status Chips
- All attendance indicators feature an 8px vertical padding, a solid 1px border, and high-contrast text.
- **Tepat Waktu (On Time)**: Background `#ECFDF5`, text `#065F46`, border `#A7F3D0`. Includes a 6px solid `#10B981` leading indicator dot.
- **Terlambat (Late)**: Background `#FFFBEB`, text `#92400E`, border `#FDE68A`. Leading indicator `#F59E0B`.
- **Sangat Terlambat / Alpa (Absent)**: Background `#FEF2F2`, text `#991B1B`, border `#FECACA`. Leading indicator `#EF4444`.
- **Izin / Cuti (Permit/Leave)**: Background `#F0F9FF`, text `#075985`, border `#BAE6FD`. Leading indicator `#0EA5E9`.

### Data Tables & Roster Lists
- **Header**: Background `#F8FAFC`, text `#475569`, border bottom `1px solid #E2E8F0`, uppercase tracking for column labels (`label-md`).
- **Row**: Height `52px` (standard) or `44px` (dense roster view), background `#FFFFFF`, border bottom `1px solid #F1F5F9`. Hover state switches to `#F8FAFC`.
- **Monospace Elements**: Check-in and check-out timestamps are rendered using `tabular-data` for vertical alignment across adjacent nurse/physician shifts.

### Input Fields & Select Controls
- Default: Height `40px`, background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`, placeholder `#94A3B8`, border radius `8px`.
- Focus: Border color `#0F766E`, outline ring `2px solid rgba(15, 118, 110, 0.15)`.
- Error state: Border color `#EF4444`, focus ring `2px solid rgba(239, 68, 68, 0.15)`.

### Cards & Analytical Panels
- White `#FFFFFF` surface wrapped in a uniform `1px solid #E2E8F0` border. Padding `space-lg` (20px).
- Metric widgets feature a top-right context badge, an extra-large numeric tally with `tabular-nums`, and a secondary trend line indicating department shift readiness.

### Clinical Shift Swap & Approval Card (Healthcare Domain Specific)
- Structured dual-pane card highlighting current personnel alongside requested substitute staff.
- Visual connector featuring arrow icons in `#0284C7` with department certification badges ensuring parity between incoming and outgoing staff credentials before supervisor approval.