# 재수없수 UI architecture

Before changing any interface, read `DESIGN.md` and `AGENTS.md`.

The design architecture is:

```text
DESIGN.md
  └─ app/globals.css : executable tokens
       ├─ app/design-system : visual catalog and review surface
       └─ app/page.tsx : product screens
```

## Working agreement

- `DESIGN.md` owns visual decisions.
- `app/globals.css` maps those decisions to CSS variables.
- `/design-system` proves the tokens and patterns visually.
- Product screens consume the system; they do not invent local systems.
- PRD and mock data own behavior and content, not styling.
- If a requested pattern is missing, extend all three design-system layers in the same change.
- Never add decorative shadows. Use flat surfaces, borders, dividers, spacing, and type hierarchy.
- Keep changes scoped and verify the production build before handoff.

