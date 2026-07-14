# atajo / Davos Links Design

atajo should feel like a precise developer tool with an energetic
Tripwire-inspired vivid-light finish. Davos Links remains the technical project
name and does not appear as the public product identity.

## Identity

- Public wordmark: `atajo`, always lowercase.
- Spacious lockup: `atajo by davosdo`.
- Tagline: `La ruta corta.`
- Mark: a geometric A built from two converging route ribbons with a diagonal
  negative-space shortcut. Do not substitute a chain-link icon.
- Core palette: warm white `#FAF9F6`, ink `#151515`, atajo blue `#275DFF`,
  and route coral `#FF6B4A`.
- Blue and coral may use their documented light/dark scales. User-selected tag
  swatches are content and are the only arbitrary-color exception.
- Use the color/dither atmosphere on major surfaces and social assets; keep
  repeated icons and compact brand applications clean.

## Direction

- Light-only interface with controlled dither texture and bloom.
- Geist Sans for primary UI text.
- Geist Mono for IDs, short paths, timestamps, URLs, and metrics.
- Warm white surfaces, dark ink, and a focused blue/coral semantic palette.
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
- Blue: primary actions, navigation, focus, information, success/active, and the current analytics series.
- Coral: previous-period analytics, campaigns, warnings, inactive states, errors, and destructive actions.
- Previous-period series use dashed strokes; warnings and destructive states use distinct icons, labels, intensity, and patterns.
- Borders: warm neutral; focus rings: accessible blue with a visible offset.
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
