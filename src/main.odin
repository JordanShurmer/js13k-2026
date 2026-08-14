package main

import "core:math"
import "core:runtime"

// --- tiny types ---
Vec2 :: [2]f32
Rect :: struct { x, y, w, h: f32 }

// --- game state (flat, grug style) ---
player_pos: Vec2
player_vel: Vec2
on_ground: bool
coyote: f32
jump_buf: f32

orb_pos: Vec2 = {160, 90}
orb_pulse: f32

cam: Vec2

// input from JS
inp_x: f32
inp_y: f32
inp_jump: bool
inp_action: bool

// timing
dt: f32
time: f32

// canvas size (set from JS)
cw, ch: f32 = 320, 180   // internal pixel size, scale later

// --- Celeste-inspired constants (start here, tune by feel) ---
GRAVITY :: 900.0
JUMP_SPEED :: -280.0
MAX_SPEED :: 110.0
ACCEL :: 800.0
FRICTION :: 700.0
COYOTE_TIME :: 0.08
JUMP_BUFFER :: 0.1
HALF_GRAV_MULT :: 0.5

// ---

@(export)
init :: proc "c" () {
    context = runtime.default_context()
    player_pos = {40, 120}
    player_vel = {}
    cam = {}
    gen_basic_ruins()
    setup_camera_triggers()
}

@(export)
set_input :: proc "c" (x, y: f32, jump, action: bool) {
    context = runtime.default_context()
    inp_x = x
    inp_y = y
    inp_jump = jump
    inp_action = action
}

@(export)
set_dt :: proc "c" (d: f32) {
    context = runtime.default_context()
    dt = d
    time += d
}

@(export)
update :: proc "c" () {
    context = runtime.default_context()
    update_player()
    update_orb()
    update_camera_full(player_pos, dt)
}

update_player :: proc() {
    // horizontal
    target := inp_x * MAX_SPEED
    if abs(inp_x) > 0.1 {
        player_vel.x = approach(player_vel.x, target, ACCEL * dt)
    } else {
        player_vel.x = approach(player_vel.x, 0, FRICTION * dt)
    }

    // coyote + buffer
    if on_ground {
        coyote = COYOTE_TIME
    } else {
        coyote -= dt
    }
    if inp_jump {
        jump_buf = JUMP_BUFFER
    } else {
        jump_buf -= dt
    }

    // jump
    if jump_buf > 0 && coyote > 0 {
        player_vel.y = JUMP_SPEED
        coyote = 0
        jump_buf = 0
        on_ground = false
    }

    // gravity (half at apex while holding)
    g := GRAVITY
    if inp_jump && player_vel.y < 0 {
        g *= HALF_GRAV_MULT
    }
    player_vel.y += g * dt

    // integrate (no collision yet)
    player_pos += player_vel * dt

    // crude ground for now
    if player_pos.y > 140 {
        player_pos.y = 140
        player_vel.y = 0
        on_ground = true
    } else {
        on_ground = false
    }
}

update_orb :: proc() {
    orb_pulse = 0.5 + 0.5 * math.sin(time * 3.0)
}

// ---

@(export)
draw :: proc "c" () {
    context = runtime.default_context()
    // clear is done in JS for now; we just issue draw commands via foreign later
    // for skeleton we only update state
}

// helpers
approach :: proc(cur, target, max_delta: f32) -> f32 {
    if cur < target {
        return min(cur + max_delta, target)
    }
    return max(cur - max_delta, target)
}

approach_v :: proc(cur, target: Vec2, max_delta: f32) -> Vec2 {
    return {
        approach(cur.x, target.x, max_delta),
        approach(cur.y, target.y, max_delta),
    }
}

min :: proc(a, b: f32) -> f32 { return a < b ? a : b }
max :: proc(a, b: f32) -> f32 { return a > b ? a : b }
abs :: proc(v: f32) -> f32 { return v < 0 ? -v : v }

// required empty main for some toolchains
main :: proc() {}
