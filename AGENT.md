# AGENT

## Primary Goal

Adventure exploration Noita-like that ships as a deliverable under 13 KB (js13k limit).

- Odin compiling to WASM.
- Player has 2 editable wands + a permanent digging tool that can be upgraded.
- Adventure is the main point of the game.
- Some bosses, some collectibles, some NPCs, lots of enemies.
- Very difficult roguelike / Noita-like.

Size is sacred. Every byte counted. Procedural everything. Grug rules from PLAN.md apply.

## Implementation Notes

- **Fat structs** — pack related data together. Prefer one big struct over many small ones when it keeps cache and code simple.
- **Data oriented** — arrays of data, not objects with behavior. Procs operate on slices/arrays. No deep inheritance or virtual tables.
- **Ponytail complexity ladder** (stop at first rung that holds):
  1. Does this need to exist at all? Speculative = skip.
  2. Already in this codebase? Reuse.
  3. Stdlib / core does it? Use it.
  4. Native platform feature? Prefer it.
  5. Already-installed dep? Use it. (We have none.)
  6. Can it be one line / one proc? Do that.
  7. Only then: minimum code that works.
- **Disableable modules** — every optional feature (each boss, shaders, special areas, advanced wand effects, etc.) must be behind a simple compile-time or build flag / `#if` so it can be stripped to reclaim bytes. Default to off until the feature is required and measured.
