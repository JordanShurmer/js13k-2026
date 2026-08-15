package main

import "core:math"
import "base:runtime"

// --- tiny types ---
Vec2 :: [2]f32
Rect :: struct { x, y, w, h: f32 }

// --- game state (fat / data oriented) ---
player_pos: Vec2
player_vel: Vec2
player_facing: Vec2 = {1, 0}  // last non-zero move dir for dig
on_ground: bool
coyote: f32
jump_buf: f32

cam: Vec2

// input from JS
inp_x: f32
inp_y: f32
inp_jump: bool
inp_action: bool   // dig tool

// timing
dt: f32
time: f32

// canvas size (set from JS)
cw, ch: f32 = 320, 180

// movement constants (Celeste-ish, keep for feel)
GRAVITY :: f32(900.0)
JUMP_SPEED :: f32(-280.0)
MAX_SPEED :: f32(110.0)
ACCEL :: f32(800.0)
FRICTION :: f32(700.0)
COYOTE_TIME :: f32(0.08)
JUMP_BUFFER :: f32(0.1)
HALF_GRAV_MULT :: f32(0.5)

PLAYER_W :: f32(6.0)
PLAYER_H :: f32(10.0)
DIG_REACH :: f32(14.0)

// ---

@(export)
init :: proc "c" () {
    context = runtime.default_context()
    gen_world()
    // spawn inside the carved chamber
    player_pos = {10 * TILE_SIZE, 24 * TILE_SIZE}
    player_vel = {}
    cam = player_pos - Vec2{cw * 0.5, ch * 0.5}
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
    update_camera()
}

update_player :: proc() {
    // facing from stick / keys
    if abs(inp_x) > 0.2 || abs(inp_y) > 0.2 {
        // prefer strongest axis for dig aim
        if abs(inp_x) >= abs(inp_y) {
            player_facing = {inp_x > 0 ? 1 : -1, 0}
        } else {
            player_facing = {0, inp_y > 0 ? 1 : -1}
        }
    }

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

    if jump_buf > 0 && coyote > 0 {
        player_vel.y = JUMP_SPEED
        coyote = 0
        jump_buf = 0
        on_ground = false
    }

    g := GRAVITY
    if inp_jump && player_vel.y < 0 {
        g *= HALF_GRAV_MULT
    }
    player_vel.y += g * dt

    // integrate + resolve against tiles (separate axes)
    move_and_collide(player_vel.x * dt, 0)
    move_and_collide(0, player_vel.y * dt)

    // dig tool (permanent, always available)
    if inp_action {
        dig_x := player_pos.x + PLAYER_W * 0.5 + player_facing.x * DIG_REACH
        dig_y := player_pos.y + PLAYER_H * 0.5 + player_facing.y * DIG_REACH
        dig_at(dig_x, dig_y)
    }
}

// AABB vs tiles. Moves by (dx, dy) one axis at a time.
move_and_collide :: proc(dx, dy: f32) {
    player_pos.x += dx
    player_pos.y += dy

    // player rect in world
    left   := player_pos.x
    right  := player_pos.x + PLAYER_W
    top    := player_pos.y
    bottom := player_pos.y + PLAYER_H

    // check tiles overlapping the rect
    tx0, ty0 := world_to_tile(left,  top)
    tx1, ty1 := world_to_tile(right - 0.001, bottom - 0.001)

    on_ground = false

    for ty in ty0..=ty1 {
        for tx in tx0..=tx1 {
            if !is_solid(tx, ty) do continue
            // tile rect
            tile_l := f32(tx) * TILE_SIZE
            tile_r := tile_l + TILE_SIZE
            tile_t := f32(ty) * TILE_SIZE
            tile_b := tile_t + TILE_SIZE

            // overlap?
            if right <= tile_l || left >= tile_r || bottom <= tile_t || top >= tile_b do continue

            if dx > 0 { // moving right
                player_pos.x = tile_l - PLAYER_W
                player_vel.x = 0
            } else if dx < 0 {
                player_pos.x = tile_r
                player_vel.x = 0
            }

            if dy > 0 { // falling
                player_pos.y = tile_t - PLAYER_H
                player_vel.y = 0
                on_ground = true
            } else if dy < 0 {
                player_pos.y = tile_b
                player_vel.y = 0
            }

            // refresh after resolution
            left   = player_pos.x
            right  = player_pos.x + PLAYER_W
            top    = player_pos.y
            bottom = player_pos.y + PLAYER_H
        }
    }
}

update_camera :: proc() {
    target := player_pos - Vec2{cw * 0.5 - PLAYER_W * 0.5, ch * 0.5 - PLAYER_H * 0.5}
    cam = approach_v(cam, target, 8.0 * 60.0 * dt) // snappy follow
}

// --- exports for JS draw ---

@(export)
export_player_x :: proc "c" () -> f32 {
    context = runtime.default_context()
    return player_pos.x
}
@(export)
export_player_y :: proc "c" () -> f32 {
    context = runtime.default_context()
    return player_pos.y
}
@(export)
export_cam_x :: proc "c" () -> f32 {
    context = runtime.default_context()
    return cam.x
}
@(export)
export_cam_y :: proc "c" () -> f32 {
    context = runtime.default_context()
    return cam.y
}
@(export)
export_time :: proc "c" () -> f32 {
    context = runtime.default_context()
    return time
}
@(export)
export_facing_x :: proc "c" () -> f32 {
    context = runtime.default_context()
    return player_facing.x
}
@(export)
export_facing_y :: proc "c" () -> f32 {
    context = runtime.default_context()
    return player_facing.y
}

// ---

@(export)
draw :: proc "c" () {
    context = runtime.default_context()
    // drawing still done in JS for this slice
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

main :: proc() {}
