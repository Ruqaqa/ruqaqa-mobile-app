# Ruqaqa Mobile Design System

> Derived from the [ruqaqa-website](../ruqaqa-website/) design system. This document is the single source of truth for the mobile app's visual language. No need to reference the website project.

---

## 1. Color Palette

### Brand Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Primary Blue** | `#1428a0` | 222, 89%, 35% | Dominant brand color, primary actions, navigation |
| **Secondary Cyan** | `#00a9e0` | 197, 100%, 44% | Secondary actions, links, accents |
| **Accent Teal** | `#20858f` | 186, 63%, 34% | Hover states, feedback, overlays |
| **Accent Green** | `#208f5a` | 151, 62%, 34% | Success, growth, sustainability indicators |

### Light Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#f6f8fd` | App background |
| `surface` | `#ffffff` | Cards, sheets, modals |
| `foreground` | `#0c0e14` | Primary text |
| `foregroundSecondary` | `#64748b` | Secondary/muted text |
| `border` | `#d1ddf7` | Card borders, dividers |
| `input` | `#e2e8f0` | Input field borders |
| `muted` | `#f1f5f9` | Disabled backgrounds, subtle fills |

### Dark Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0f172a` | App background |
| `surface` | `#1e293b` | Cards, sheets, modals |
| `foreground` | `#f8fafc` | Primary text |
| `foregroundSecondary` | `#94a3b8` | Secondary/muted text |
| `border` | `#334155` | Card borders, dividers |
| `input` | `#475569` | Input field borders |
| `muted` | `#1e293b` | Disabled backgrounds |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `success` | `#208f5a` | `#29b974` | Success states, confirmations |
| `warning` | `#f59e0b` | `#fbbf24` | Warning states, cautions |
| `error` | `#ef4444` | `#f87171` | Error states, destructive actions |
| `info` | `#00a9e0` | `#00c3ff` | Informational states |

---

## 2. Typography

### Font Family

- **Primary**: System default (San Francisco on iOS, Roboto on Android)
- No custom fonts required — the system fonts align with the website's Geist Sans feel.

### Type Scale

| Name | Size (px) | Weight | Line Height | Usage |
|------|-----------|--------|-------------|-------|
| `displayLarge` | 32 | 700 (Bold) | 40 | Page titles, hero text |
| `displayMedium` | 28 | 700 | 36 | Section headers |
| `headingLarge` | 24 | 600 (SemiBold) | 32 | Card titles, modal titles |
| `headingMedium` | 20 | 600 | 28 | Sub-section headers |
| `headingSmall` | 18 | 600 | 24 | List group headers |
| `bodyLarge` | 16 | 400 (Regular) | 24 | Primary body text |
| `bodyMedium` | 14 | 400 | 20 | Secondary body text, descriptions |
| `bodySmall` | 12 | 400 | 16 | Captions, timestamps, helper text |
| `label` | 14 | 500 (Medium) | 20 | Form labels, tab labels |
| `labelSmall` | 12 | 500 | 16 | Badges, chips, small labels |
| `button` | 14 | 500 | 20 | Button text |

---

## 3. Spacing

Based on a 4px grid (same as Tailwind's default scale):

| Token | Value | Usage |
|-------|-------|-------|
| `xxs` | 2px | Micro gaps |
| `xs` | 4px | Icon-to-text gap, tight spacing |
| `sm` | 8px | Between related elements |
| `md` | 12px | Standard gap |
| `base` | 16px | Card padding, section gap |
| `lg` | 20px | Between sections |
| `xl` | 24px | Page padding, modal padding |
| `xxl` | 32px | Large section spacing |
| `xxxl` | 48px | Page-level vertical spacing |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `none` | 0 | No rounding |
| `sm` | 4px | Small elements (badges, chips) |
| `md` | 8px | Buttons, inputs |
| `lg` | 12px | Cards, modals |
| `xl` | 20px | Feature cards, bottom sheets (matches website's `--radius-card`) |
| `full` | 9999px | Circular elements, pills |

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `none` | none | No shadow |
| `sm` | `0 1px 2px rgba(0,0,0,0.06)` | Subtle elevation (inputs) |
| `md` | `0 2px 4px rgba(0,0,0,0.1)` | Default card shadow |
| `lg` | `0 8px 16px rgba(0,0,0,0.12)` | Elevated cards, dropdowns |
| `xl` | `0 15px 30px rgba(0,0,0,0.1)` | Modals, floating elements |
| `gradient` | `0 4px 20px rgba(20,40,160,0.4)` | Gradient button shadow |

---

## 6. Gradients

| Name | Value | Usage |
|------|-------|-------|
| `primary` | `linear(90deg, #00a9e0 → #1428a0)` | Primary gradient (cyan → blue) |
| `hover` | `linear(45deg, #1428a0 → #20858f)` | Active/pressed gradient |
| `accentGreen` | `linear(45deg, #20858f → #208f5a)` | Success/growth gradient |

---

## 7. Component Specs

### Button Variants

| Variant | Background | Text | Border | Shadow |
|---------|-----------|------|--------|--------|
| `default` | `primary` | `#ffffff` | none | none |
| `gradient` | `primary gradient` | `#ffffff` | none | `gradient` shadow |
| `secondary` | `secondary` | `#ffffff` | none | none |
| `outline` | transparent | `foreground` | `border` | none |
| `ghost` | transparent | `foreground` | none | none |
| `destructive` | `error` | `#ffffff` | none | none |

**Button sizes:**
| Size | Height | Horizontal padding | Font size |
|------|--------|-------------------|-----------|
| `sm` | 36px | 12px | 13px |
| `md` | 44px | 16px | 14px |
| `lg` | 48px | 24px | 16px |
| `icon` | 44px | 0 (square) | — |

**Minimum touch target**: 44px (accessibility requirement).

### Input Field

- Height: 44px
- Padding: 12px horizontal
- Background: `surface`
- Border: 1px `input` color
- Border radius: `md` (8px)
- Font size: 14px
- Focus: 2px ring in `primary` color
- Error: border becomes `error` color
- Disabled: 50% opacity

### Card

- Background: `surface`
- Border: 1px `border` color
- Border radius: `lg` (12px) or `xl` (20px) for feature cards
- Padding: 16px
- Shadow: `md`

### Badge / Chip

- Height: 24px
- Padding: 8px horizontal
- Border radius: `full` (pill)
- Font: `labelSmall` (12px, medium)
- Variants: `primary`, `secondary`, `muted`, `success`, `warning`, `error`

### Modal / Bottom Sheet

- Background: `surface` with 95% opacity
- Backdrop: black at 60% opacity with blur
- Border radius: `xl` (20px) on top corners for bottom sheets
- Padding: 24px
- Max height: 85% of screen

### Approval Status Chips

| Status | Background | Text |
|--------|-----------|------|
| Pending | `#fef3c7` (light) / `#78350f` (dark bg) | `#92400e` |
| Approved | `#d1fae5` (light) / `#064e3b` (dark bg) | `#065f46` |
| Rejected | `#fee2e2` (light) / `#7f1d1d` (dark bg) | `#991b1b` |

---

## 8. Iconography

- Use **Lucide React Native** icons (consistent with website's `lucide:IconName` pattern)
- Default icon size: 20px
- Touch target icons: 24px within 44px touch area
- Icon color inherits from text color unless specified

---

## 9. Motion & Animation

| Property | Duration | Easing | Usage |
|----------|----------|--------|-------|
| Color transitions | 200ms | ease-out | Button press, focus |
| Layout shifts | 300ms | ease-in-out | Tab switching, accordion |
| Modal enter | 300ms | spring (damping: 25, stiffness: 300) | Modal/sheet appearance |
| Modal exit | 200ms | ease-in | Modal/sheet dismissal |
| Hover lift | 300ms | ease-in-out | Card press (translateY -4px) |

---

## 10. RTL Support

- All layouts must flip horizontally in Arabic mode
- Icons that imply direction (arrows, chevrons) must mirror
- Text alignment switches from left to right
- Margins/paddings mirror (start/end, not left/right)
- Use `I18nManager.isRTL` or styling abstractions to handle this

---

## 11. Accessibility

- **Minimum touch target**: 44x44px
- **Color contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- **Focus indicators**: 2px ring in primary color
- **Text scaling**: Support system font scaling up to 200%
- All interactive elements must have accessible labels
