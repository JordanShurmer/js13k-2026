package main

import "base:runtime"

Vec2 :: [2]f32

player_pos: Vec2
player_vel: Vec2
player_facing: Vec2 = {1, 0}
dig_facing: Vec2 = {1, 0}
on_ground: bool
coyote: f32
jump_buf: f32

orb_pos: Vec2

cam: Vec2

inp_x: f32
inp_y: f32
inp_jump: bool
inp_action: bool
dig_inp_x: f32
dig_inp_y: f32

dt: f32
time: f32

// Dynamic view size (set from JS so mobile can show more world at 1:1)
cw, ch: f32 = 320, 180

// Even slower + half jump for deliberate dig/explore feel
GRAVITY: f32 : 650
JUMP_SPEED: f32 : -110
MAX_SPEED: f32 : 32
ACCEL: f32 : 260
FRICTION: f32 : 300
COYOTE_TIME: f32 : 0.08
JUMP_BUFFER: f32 : 0.1
HALF_GRAV_MULT: f32 : 0.5

PLAYER_W: f32 : 6
PLAYER_H: f32 : 10
DIG_REACH: f32 : 16

@(export)
init :: proc "c" () {
    context = runtime.default_context()
    gen_world()
    // start inside wood room, on the floor near table
    player_pos = {8 * TILE_SIZE, 30 * TILE_SIZE}
    player_vel = {}
    // orb waits at tunnel entrance (doorway)
    orb_pos = {18 * TILE_SIZE + 2, 26 * TILE_SIZE + 2}
    cam = player_pos - Vec2{cw * 0.5, ch * 0.5}
    // clear initial orb area
    mark_explored(orb_pos.x, orb_pos.y, 48)
}

@(export)
set_view :: proc "c" (w, h: f32) {
    context = runtime.default_context()
    if w > 16 && h > 16 {
        cw = w
        ch = h
    }
}

@(export)
set_input :: proc "c" (x, y: f32, jump, action: bool, digx, digy: f32) {
    context = runtime.default_context()
    inp_x = x
    inp_y = y
    inp_jump = jump
    inp_action = action
    dig_inp_x = digx
    dig_inp_y = digy
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
    update_camera()
}

update_orb :: proc() {
    // gentle follow toward player center, slightly above
    target := player_pos + Vec2{PLAYER_W * 0.5, PLAYER_H * 0.25}
    // lag so it trails a little
    speed: f32 = 55
    orb_pos = approach_v(orb_pos, target, speed * dt)
    // permanent fog clear wherever orb travels
    mark_explored(orb_pos.x, orb_pos.y, 56)
}

update_player :: proc() {
    // Movement facing (eye / look) from move stick / keys only
    if abs(inp_x) > 0.2 || abs(inp_y) > 0.2 {
        if abs(inp_x) >= abs(inp_y) {
            player_facing = {inp_x > 0 ? 1 : -1, 0}
        } else {
            player_facing = {0, inp_y > 0 ? 1 : -1}
        }
    }

    // Dig direction independent: digStick or keyboard fallback via dig_inp
    if abs(dig_inp_x) > 0.15 || abs(dig_inp_y) > 0.15 {
        dig_facing = {dig_inp_x, dig_inp_y}
    }

    target := inp_x * MAX_SPEED
    if abs(inp_x) > 0.1 {
        player_vel.x = approach(player_vel.x, target, ACCEL * dt)
    } else {
        player_vel.x = approach(player_vel.x, 0, FRICTION * dt)
    }

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

    move_and_collide(player_vel.x * dt, 0)
    move_and_collide(0, player_vel.y * dt)

    // Near-field plasma dig: clear every tile along the beam from body to tip
    if inp_action {
        steps := 5
        for i in 0..<steps {
            t := f32(i) / f32(steps - 1)
            dig_x := player_pos.x + PLAYER_W * 0.5 + dig_facing.x * DIG_REACH * t
            dig_y := player_pos.y + PLAYER_H * 0.5 + dig_facing.y * DIG_REACH * t
            dig_at(dig_x, dig_y)
        }
    }
}

move_and_collide :: proc(dx, dy: f32) {
    player_pos.x += dx
    player_pos.y += dy

    left   := player_pos.x
    right  := player_pos.x + PLAYER_W
    top    := player_pos.y
    bottom := player_pos.y + PLAYER_H

    tx0, ty0 := world_to_tile(left,  top)
    tx1, ty1 := world_to_tile(right - 0.001, bottom - 0.001)

    on_ground = false

    for ty in ty0..=ty1 {
        for tx in tx0..=tx1 {
            if !is_solid(tx, ty) do continue
            tile_l := f32(tx) * TILE_SIZE
            tile_r := tile_l + TILE_SIZE
            tile_t := f32(ty) * TILE_SIZE
            tile_b := tile_t + TILE_SIZE

            if right <= tile_l || left >= tile_r || bottom <= tile_t || top >= tile_b do continue

            if dx > 0 {
                player_pos.x = tile_l - PLAYER_W
                player_vel.x = 0
            } else if dx < 0 {
                player_pos.x = tile_r
                player_vel.x = 0
            }

            if dy > 0 {
                player_pos.y = tile_t - PLAYER_H
                player_vel.y = 0
                on_ground = true
            } else if dy < 0 {
                player_pos.y = tile_b
                player_vel.y = 0
            }

            left   = player_pos.x
            right  = player_pos.x + PLAYER_W
            top    = player_pos.y
            bottom = player_pos.y + PLAYER_H
        }
    }
}

update_camera :: proc() {
    target := player_pos - Vec2{cw * 0.5 - PLAYER_W * 0.5, ch * 0.5 - PLAYER_H * 0.5}
    cam = approach_v(cam, target, 8 * 60 * dt)
}

@(export)
export_player_x :: proc "c" () -> f32 { context = runtime.default_context(); return player_pos.x }
@(export)
export_player_y :: proc "c" () -> f32 { context = runtime.default_context(); return player_pos.y }
@(export)
export_cam_x :: proc "c" () -> f32 { context = runtime.default_context(); return cam.x }
@(export)
export_cam_y :: proc "c" () -> f32 { context = runtime.default_context(); return cam.y }
@(export)
export_time :: proc "c" () -> f32 { context = runtime.default_context(); return time }
@(export)
export_facing_x :: proc "c" () -> f32 { context = runtime.default_context(); return player_facing.x }
@(export)
export_facing_y :: proc "c" () -> f32 { context = runtime.default_context(); return player_facing.y }
@(export)
export_dig_facing_x :: proc "c" () -> f32 { context = runtime.default_context(); return dig_facing.x }
@(export)
export_dig_facing_y :: proc "c" () -> f32 { context = runtime.default_context(); return dig_facing.y }
@(export)
export_on_ground :: proc "c" () -> i32 { context = runtime.default_context(); return on_ground ? 1 : 0 }
@(export)
export_view_w :: proc "c" () -> f32 { context = runtime.default_context(); return cw }
@(export)
export_view_h :: proc "c" () -> f32 { context = runtime.default_context(); return ch }
@(export)
export_vel_x :: proc "c" () -> f32 { context = runtime.default_context(); return player_vel.x }
@(export)
export_vel_y :: proc "c" () -> f32 { context = runtime.default_context(); return player_vel.y }
@(export)
export_orb_x :: proc "c" () -> f32 { context = runtime.default_context(); return orb_pos.x }
@(export)
export_orb_y :: proc "c" () -> f32 { context = runtime.default_context(); return orb_pos.y }

@(export)
draw :: proc "c" () { context = runtime.default_context() }

approach :: proc(cur, target, max_delta: f32) -> f32 {
    if cur < target { return min(cur + max_delta, target) }
    return max(cur - max_delta, target)
}
approach_v :: proc(cur, target: Vec2, max_delta: f32) -> Vec2 {
    return { approach(cur.x, target.x, max_delta), approach(cur.y, target.y, max_delta) }
}
min :: proc(a, b: f32) -> f32 { return a < b ? a : b }
max :: proc(a, b: f32) -> f32 { return a > b ? a : b }
abs :: proc(v: f32) -> f32 { return v < 0 ? -v : v }

main :: proc() {}
