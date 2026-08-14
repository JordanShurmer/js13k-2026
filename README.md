# js13k-2026-orb-ruins

## Goal

Adventure exploration Noita-like that ships as a deliverable less than 13 KB.

Odin compiling to WASM.

Player has 2 editable wands and a permanent digging tool that can be upgraded.

Adventure is the main point of the game. Some bosses, some collectibles, some NPCs, lots of enemies. Very difficult roguelike Noita-like.

Atmospheric pixel-art. Mobile-first. Procedural assets only.

See [PLAN.md](PLAN.md) for the foundation plan and Grug rules.
See [AGENT.md](AGENT.md) for the high-level goal + implementation notes.

## Current vertical slice

- Flat diggable tile world (u8 array)
- Player movement + tile collision
- Permanent dig tool (action / X / second button)
- Camera follow
- No wands / enemies / bosses yet (disabled by absence)

## Build (requires recent Odin)

```bash
# from repo root
odin build src -target:js_wasm32 -out:game.wasm -o:size -no-entry-point
# copy odin.js from your Odin install: core/sys/wasm/js/odin.js
# serve the directory (python -m http.server)
```

Size check:

```bash
make size
```

## Controls

- Touch: stick appears under thumb. Two buttons fixed top-left (Jump + Dig).
- Keyboard: arrows/WASD + Z/Space (jump) X (dig)
