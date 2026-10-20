---
name: Clinical Attendance & Identity
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
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
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
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-lg-medium:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
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
    letterSpacing: 0.01em
  metric-mono:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1rem
  margin-lg: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system establishes a clinical, reassuring, and highly organized environment tailored for hospital staff, nurses, physicians, and administrative personnel operating under time-critical hospital shifts. It balances sterile precision with human-centric warmth, prioritizing legibility, immediate visual feedback, and tactile certainty under varying ambient lighting (bright surgical suites, dimly lit night-shift wards, and variable-glare outdoor hospital entryways).

Drawing from modern clinical minimalism and subtle atmospheric depth, the aesthetic relies on ample breathing space, crisp structure, and reassuring medical tones. The emotional response is centered on trust, accuracy, and operational calm: shifts, attendance stamps, geolocation verification, and biometric Face ID scans must feel instantaneous, fail-safe, and unambiguous. Bahasa Indonesia healthcare nomenclature is treated as a first-class citizen, ensuring immediate comprehension for complex workflows (e.g., *Presensi Masuk*, *Verifikasi Biometrik Wajah*, *Tepat Waktu*, *Dinas Pagi/Sore/Malam*).

## Colors
The palette is anchored by deep clinical teal (`#0F766E`) as the primary tone, representing sterile clinical rigor and institutional stability. Vibrant medical blue (`#0EA5E9`) acts as a secondary interactive tone for active tracking, active camera viewfinders, and telemetry indicators, while soft jade teal (`#0D9488`) supports secondary confirmations and interactive states.

Surface architecture utilizes a layered off-white and cool slate foundation:
- **Canvas Base:** `#F8FAFC`
- **Surface Elevation (Cards, Modals):** `#FFFFFF`
- **Muted Structural Borders:** `#E2E8F0` (standard) and `#CBD5E1` (stronger component outlines)
- **Neutral Typographic Stack:** Headlines and body text use Slate-900 (`#0F172A`) for maximum legibility, Slate-600 (`#475569`) for secondary metadata, and Slate-400 (`#94A3B8`) for disabled or placeholder states.

Semantic feedback tiers follow hospital triage conventions:
- **Tepat Waktu / Hadir (Success):** Emerald `#10B981` paired with surface tint `#ECFDF5`
- **Terlambat / Menunggu (Warning):** Amber `#F59E0B` paired with surface tint `#FFFBEB`
- **Ditolak / Di Luar Radius (Error):** Rose `#EF4444` paired with surface tint `#FEF2F2`
- **Dalam Verifikasi / Info Shift (Info):** Sky `#0284C7` paired with surface tint `#F0F9FF`

All interactive combinations meet strict WCAG AA contrast ratios (minimum 4.5:1 for standard body text and 3:1 for large display metrics).

## Typography
Inter delivers systematic clarity, high x-height, and neutral geometry vital for rapid digital scanning during emergency shift handovers. 

- **Digital Time & Biometrics:** Digital clock displays (`metric-mono`) utilize tabular numeral settings (`font-variant-numeric: tabular-nums`) to prevent layout shifting during real-time second counting on the Face ID registration and checkout screens.
- **Healthcare Labels:** Short informational badges, shift tags (*Dinas Jaga*), and status pills use `label-md` with slight positive tracking (`+0.02em`) to ensure legibility when rendered in all-caps or mixed casing on tinted backgrounds.
- **Microcopy:** System status (e.g., biometric match score, timestamp sync warnings) stays strictly at or above `label-sm` (11px) to prevent illegibility on low-dpi handheld hardware.

## Layout & Spacing
The layout model follows a disciplined 8pt grid with 4pt baseline intervals for tight metric alignment.

- **Mobile Viewport Grid:** Designed primarily for handheld mobile use with a 4-column fluid layout, 16px (`gutter`) column spacing, and 16px (`margin`) outer horizontal safe padding.
- **Tablet / Kiosk Breakpoints:** Above 640px, the grid expands to 8 columns with 24px margins (`margin-lg`) and 16px gutters to accommodate stationary hospital ward punch-in tablets and shared station docks.
- **Ergonomics & Touch Safeties:** Interactive components are positioned primarily in the lower thumb zone (40% to 90% of screen height). Primary check-in buttons and face trigger shutters adhere strictly to a 48px minimum height/width dimension with 12px tap boundary margins.

## Elevation & Depth
Depth is created through clean tonal separation, crisp clinical borders, and diffused, medical-grade ambient shadows tinted with soft slate blue (`rgba(15, 23, 42, 0.06)`):

1. **Flat / Base Layer (Elevation 0):** Background canvas (`#F8FAFC`) with no drop shadow.
2. **Card Rest Layer (Elevation 1):** Main shift containers, schedule cards, and biometric feedback tiles.
   - Outline: 1px solid `#E2E8F0`
   - Shadow: `0px 1px 3px rgba(15, 23, 42, 0.05), 0px 1px 2px rgba(15, 23, 42, 0.03)`
3. **Floating Interactive Layer (Elevation 2):** Quick-action punch cards, bottom sheets, and geolocation radius monitors.
   - Outline: 1px solid `#E2E8F0`
   - Shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.07), 0px 2px 4px -2px rgba(15, 23, 42, 0.04)`
4. **Modal / Biometric Overlay Layer (Elevation 3):** Face ID verification frames, camera viewports, and confirmation alerts.
   - Shadow: `0px 20px 25px -5px rgba(15, 23, 42, 0.1), 0px 8px 10px -6px rgba(15, 23, 42, 0.05)`
   - Backdrop Blur: `backdrop-filter: blur(8px)` with a translucent overlay `rgba(15, 23, 42, 0.45)`.

## Shapes
A roundedness factor of `2` provides a friendly yet disciplined healthcare appearance, preventing severe corners without feeling overly playful or casual.

- **Base Components:** Input fields, list tiles, and secondary buttons feature `12px` (0.75rem) to `16px` (1rem) radii (`rounded-lg`).
- **Primary Hero Elements:** Shift status cards, punch-in action modules, and Face ID viewports utilize `16px` (1rem) to `24px` (1.5rem) radii (`rounded-xl`).
- **Pills / Status Chips:** Operational badges (*Tepat Waktu*, *Dinas Malam*, *Di Luar Radius*) utilize full pill radii (`9999px`) to immediately denote contextual categorical data.

## Components

### Buttons & Action Bars
- **Primary Attendance Button (*Presensi Sekarang*):** Height: 52px (exceeds 48px baseline touch target). Solid fill `#0F766E`, text `#FFFFFF`, rounded 16px, font `body-lg-medium`. Active state features a smooth compress scale (`0.98`) with background `#0D9488`.
- **Secondary / Ghost Button:** Transparent background, 1.5px border `#CBD5E1`, text `#0F172A`, hover/active background `#F1F5F9`.
- **Emergency / Out-of-Bounds Button:** Solid fill `#FEF2F2`, border 1px solid `#EF4444`, text `#B91C1C`.

### Biometric Face ID Camera Viewport
- **Frame:** Centered rounded square or oval with 24px border radius, enclosed within a 3px animated scanning guide border (`#0EA5E9` transitioning to `#10B981` upon successful facial mesh identification).
- **Liveness Indicators:** Prominent high-contrast text pill centered directly above or below the viewport reading *Posisikan Wajah di Dalam Lingkaran* or *Kedipkan Mata*.

### Status Badges & Chips
- **Teal / Active Shift:** Background `#CCFBF1`, text `#0F766E`, border `#99F6E4`.
- **Green / Tepat Waktu:** Background `#ECFDF5`, text `#047857`, border `#A7F3D0`.
- **Amber / Terlambat:** Background `#FFFBEB`, text `#B45309`, border `#FDE68A`.
- **Rose / Ditolak:** Background `#FEF2F2`, text `#B91C1C`, border `#FECACA`.
- Format: Inline flex, 28px height, 12px horizontal padding, 9999px border radius, typography `label-md`.

### Attendance History & Shift Lists
- Rendered on `#FFFFFF` surfaces with subtle divider lines (`1px solid #F1F5F9`) or contained in card arrays with 12px spacing.
- Each item contains an avatar/icon stamp, shift identifier (*Poli Penyakit Dalam - Shift Pagi*), exact clock times with monospace tabular digits, and a status badge docked to the right edge.

### Input Fields & Verification Controls
- Minimum height: 48px.
- Background `#FFFFFF`, border `1px solid #CBD5E1`, border-radius 12px, font `body-md`.
- Focus state: Border color `#0EA5E9`, box shadow `0 0 0 3px rgba(14, 165, 233, 0.15)`.
- Error state: Border color `#EF4444`, box shadow `0 0 0 3px rgba(239, 68, 68, 0.15)`.

### Cards & Verification Modules
- Hospital cards surface the verified attendance verdict (face match, liveness, device integrity) without a location map.
- Status header integrated into the top border: 4px accent line matching semantic state (green for verified, red for needs review).