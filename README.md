# js13k-2026-orb-ruins

Atmospheric pixel-art 2D platformer for js13k 2026.
Odin → WASM. Mobile-first. Procedural assets only.

See [PLAN.md](PLAN.md) for the full foundation plan and Grug rules.

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
