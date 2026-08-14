# js13k-2026-orb-ruins

## Goal

Adventure exploration Noita-like that ships as a deliverable less than 13 KB.

Odin compiling to WASM.

Player has 2 editable wands and a permanent digging tool that can be upgraded.

Adventure is the main point of the game. Some bosses, some collectibles, some NPCs, lots of enemies. Very difficult roguelike Noita-like.

Atmospheric pixel-art. Mobile-first. Procedural assets only.

See [PLAN.md](PLAN.md) for the foundation plan and Grug rules.
See [AGENT.md](AGENT.md) for the high-level goal.

## Build (requires recent Odin)

```bash
# from repo root
odin build src -target:js_wasm32 -out:game.wasm -o:size -no-entry-point
# copy odin.js from your Odin install: core/sys/wasm/js/odin.js
# serve the directory (python -m http.server)
```

Size check (after you have a zip):

```bash
make size
```

## Controls

- Touch: stick appears under thumb. Two buttons fixed top-left.
- Keyboard: arrows/WASD + Z (jump) X (action)
