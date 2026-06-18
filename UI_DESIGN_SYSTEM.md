# HUE UI Guidelines & Design System

This document outlines the core UI characteristics, branding, and frontend components to be implemented consistently across all HUE-related projects. It is based on the unified styles defined in `tailwind.config.ts` and `globals.css`.

## 🎨 Branding & Colors

The brand relies on a deep navy and a vibrant gold accent, combined with clean, modern slate tones for surfaces.

### Primary Colors
- **HUE Navy (Primary):** `#002147` (Default)
  - Light variants: `#4361ff` (500), `#1d32e0` (700)
- **HUE Gold (Accent):** `#FFB81C` (Default)
  - Light variants: `#ffe04a` (300), `#ffd31a` (400)

### Surface & Backgrounds
- **Light mode bases:** `#f8fafc` (50), `#f1f5f9` (100)
- **Dark mode elements:** `#1e293b` (800), `#0f172a` (900), `#020617` (950)

### Semantic Colors
- **Success:** `#22c55e` (500)
- **Warning:** `#f59e0b` (500)
- **Danger:** `#f43f5e` (500)
- **Info:** `#3b82f6` (500)

## 🔤 Typography

We use modern Google Fonts for a clean, professional aesthetic.

- **Display Font:** `Outfit` - Used for headings (`h1` through `h6`) and section titles.
- **Body Font:** `Inter` - Used for all body text, paragraphs, and standard UI elements.

*Note: All headings apply a `--font-outfit` and are automatically styled with `font-semibold` and `tracking-tight`.*

## 🔘 Buttons

Button classes are standardized to ensure consistent interactive elements. Use the base `.btn` class alongside a variant.

- `.btn`: Base class (`inline-flex items-center gap-2 rounded-xl font-semibold px-4 py-2.5`, smooth transitions).
- `.btn-primary`: Navy background, white text, hover glow (`shadow-glow-primary`).
- `.btn-gold`: Gold gradient background, navy text, hover glow (`shadow-glow-gold`).
- `.btn-secondary`: White background, slate text, subtle border, shadow-sm.
- `.btn-ghost`: Transparent background, slate text, hover slate background.
- `.btn-danger` / `.btn-success`: Semantic buttons for destructive or positive actions.
- **Sizes:** `.btn-sm`, `.btn-lg`, `.btn-icon` (for icon-only buttons).

## 🃏 Cards & Surfaces

Cards use rounded corners (`rounded-2xl`) and subtle borders for a clean separation.

- `.card`: Base card (`bg-white`, `rounded-2xl`, `border-slate-200/80`, `shadow-card`).
- `.card-hover`: Adds a lift effect on hover (`-translate-y-0.5`) with a deeper shadow (`shadow-card-hover`).
- `.card-glass`: Frosted glass effect (`bg-white/70`, `backdrop-blur-sm`).
- `.card-dark`: Dark glass effect (`bg-gradient-glass`, `backdrop-blur-sm`, `border-white/10`).
- `.stat-card`: Flex layout card for dashboard statistics (padding, flex gap).

## 📝 Form Inputs

- `.input`: Standard input (`h-10`, `rounded-xl`, `border-slate-200`, focuses with navy ring).
- `.input-dark`: Input for dark themes (`bg-white/10`, white text, focuses with gold ring).
- `.label`: Form label (`text-sm`, `font-medium`, `text-slate-700`).
- `.form-group`: Standard vertical spacing for input groups (`space-y-1.5`).

## 🏷️ Badges

Used for status indicators, roles, and tags. They use `rounded-full` and `text-xs font-semibold`.

- **Base:** `.badge` (`inline-flex items-center gap-1 px-2.5 py-1`).
- **Variants:** `.badge-primary`, `.badge-gold`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-gray`, `.badge-purple`, `.badge-pink`.

## 🧭 Navigation & Menus

Sidebar and navigation elements use a distinct dark theme and active states.

- `.nav-item`: Sidebar link base (`rounded-xl`, `text-white/65`, `hover:bg-white/10`).
- `.nav-item-active`: Active sidebar link (`bg-white/15`, `text-white`, `font-semibold`).
  - *Active items automatically feature a gold gradient indicator bar on the left side.*

## 📊 Tables

- `.table-container`: Responsive wrapper (`overflow-x-auto`, `rounded-xl`, border).
- `.table-header`: Table head (`text-xs font-semibold`, uppercase, `text-slate-500`, `bg-slate-50`).
- `.table-cell`: Table data (`text-sm`, `text-slate-700`, `whitespace-nowrap`).
- `.table-row`: Row hover effect (`hover:bg-slate-50/70`).

## ✨ Effects, Shadows & Gradients

### Gradients
- `gradient-sidebar`: Linear downward gradient (`#002147` to `#000d1f`).
- `gradient-gold`: Diagonal gradient (`#FFB81C` to `#FFE04A`).
- `gradient-hero`: Diagonal blue/navy gradient (`#002147` to `#4361ff`).

### Shadows
- `shadow-glow-gold`: Soft gold glow (`rgba(255,184,28,0.35)`).
- `shadow-glow-primary`: Soft navy/blue glow (`rgba(67,97,255,0.30)`).
- `shadow-card`, `shadow-card-hover`: Layered shadows for structural depth.

### Text Gradients
- `.text-gradient-gold`: Gold gradient applied directly to text.
- `.text-gradient-primary`: Navy/blue gradient applied directly to text.

## 🎬 Animations

Built-in subtle animations to make the UI feel dynamic.

- `fade-in`: Simple opacity fade (0.3s).
- `slide-up`: Upward translate fade (0.3s).
- `slide-in-left`: Leftward translate fade (0.35s).
- `pulse-gold`: Breathing gold shadow effect.
- `shimmer`: Moving background gradient (often used with `.bg-shimmer` utility).
- `bounce-subtle`: Gentle up/down floating.

## 💡 Best Practices & Usage

1. **Layout Structure:** Use `.page-content` for standard page padding and max-widths.
2. **Glassmorphism:** Use `.glass` or `.glass-dark` utilities on floating elements or popups to layer them elegantly.
3. **Typography Hierarchy:** Headings are visually distinct (`Outfit`). Ensure `.section-title` is used for content area headers over standard `Inter` body text.
4. **Consistency:** Avoid ad-hoc inline styles. Standard corner radius defaults to `.rounded-2xl` or `.rounded-xl`. Always use the `.btn` wrapper for interactive clickable actions.
