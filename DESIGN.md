# Davos Links Design

Davos Links should feel like a precise developer tool with an energetic Tripwire-inspired vivid-light finish.

## Direction

- Light-only interface with controlled dither texture and bloom.
- Geist Sans for primary UI text.
- Geist Mono for IDs, short paths, timestamps, URLs, and metrics.
- Warm white surfaces, dark ink, and a vivid semantic palette.
- Tinted crisp borders, compact spacing, and exact alignment.

## Principles

- Prioritize speed and clarity; visual energy must reinforce hierarchy or state.
- Put the link workflow first.
- Make table scanning easy.
- Keep actions predictable and close to the data they affect.
- Use 500–650 ms entrances only where they orient the user; respect reduced motion and let stable Canvas loops sleep.

## Layout

The dashboard should use:

- A restrained top navigation or sidebar.
- A primary links table.
- A clear create-link action.
- Compact stat summaries.
- Detail/edit views that keep destination, short path, status, and analytics visible.

Avoid nested cards, oversized marketing sections inside the app, permanent sparkles, and a Canvas per card.

## Components

- Buttons should use clear labels or recognizable icons.
- Inputs should show validation messages near the field, use vivid focus rings, and expose `aria-invalid`.
- Tables should support empty/loading states and retain a scan-friendly hover/focus row cue.
- Copy actions should use icon buttons with clear tooltips or labels.
- Destructive actions should require confirmation before production hardening.
- Disabled states should explain what is missing when practical and remain distinguishable from active controls.

## Visual System

- Base background: warm off-white with white cards and popovers.
- Text: near-black foreground; muted copy remains at least WCAG AA on its surface.
- Blue: primary actions and the current analytics series.
- Purple: navigation, focus-adjacent secondary actions, and previous-period analytics.
- Green: success and active status; orange: warnings and inactive status.
- Red: errors and destructive actions; pink: campaigns and secondary accents.
- Borders: subtly purple-tinted; focus rings: vivid blue with a visible offset.
- Dither: Canvas on hero/login/sidebar and labeled CTAs; static CSS Bayer pattern on repeated, ghost, and icon controls.
- Bloom: low and interaction-bound; continuous sparkles are disabled.
- Radius: small and consistent, with slightly larger dialogs/cards than inputs.
- Typography: compact, with clear hierarchy.

Status must never depend on color alone: pair it with text, an icon, a pattern, or a shape. Normal text targets 4.5:1 contrast; large text, component boundaries, and focus indicators target at least 3:1.

## Content

Use direct Spanish product language:

- "Crear enlace"
- "Ruta corta"
- "URL de destino"
- "Copiar"
- "Desactivar"
- "Clics"

Avoid explanatory marketing copy in the dashboard. The user is there to work.
