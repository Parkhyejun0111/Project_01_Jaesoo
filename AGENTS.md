# Repository design instructions

These instructions apply to the entire repository.

## Source of truth

1. Read `DESIGN.md` completely before changing UI.
2. Treat `DESIGN.md` as the visual source of truth.
3. Use the PRD and mock data only for product behavior, states, and copy.
4. Direct user instructions override repository guidance.

## UI implementation rules

- Reuse CSS custom properties from `app/globals.css`. Do not add raw colors, spacing, radii, or motion values when an existing token fits.
- Keep the product flat: no decorative box shadows. Use tone, borders, dividers, spacing, and typography for hierarchy.
- Preserve the 430px mobile-first shell, 20px screen gutter, 4px spacing rhythm, 24px card radius, and 16px control radius.
- Keep subject colors stable: Korean red, Math teal, English blue, Inquiry yellow.
- Use Lucide or Line Awesome-style outline icons with consistent sizing and stroke weight.
- Use semantic HTML, 44px minimum touch targets, accessible labels, and visible keyboard focus.
- Prefer shared classes and tokens over one-off inline styling.

## Change protocol

When a new reusable visual pattern or token is introduced:

1. Update `DESIGN.md`.
2. Update the token mapping in `app/globals.css`.
3. Add or update the specimen in `app/design-system`.
4. Implement the product change.
5. Run the production build and fix real failures.

Do not refactor unrelated screens while working on a focused request.

