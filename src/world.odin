package main

import "base:runtime"

TILE_SIZE :: 4
WORLD_W   :: 80
WORLD_H   :: 45

Tile_Air   :: u8(0)
Tile_Solid :: u8(1)

tiles: [WORLD_W * WORLD_H]u8

idx :: proc(tx, ty: int) -> int {
    return ty * WORLD_W + tx
}

in_bounds :: proc(tx, ty: int) -> bool {
    return tx >= 0 && tx < WORLD_W && ty >= 0 && ty < WORLD_H
}

get_tile :: proc(tx, ty: int) -> u8 {
    if !in_bounds(tx, ty) do return Tile_Solid
    return tiles[idx(tx, ty)]
}

set_tile :: proc(tx, ty: int, v: u8) {
    if !in_bounds(tx, ty) do return
    tiles[idx(tx, ty)] = v
}

is_solid :: proc(tx, ty: int) -> bool {
    return get_tile(tx, ty) != Tile_Air
}

world_to_tile :: proc(wx, wy: f32) -> (int, int) {
    return int(wx / TILE_SIZE), int(wy / TILE_SIZE)
}

gen_world :: proc() {
    // solid fill
    for i in 0..<len(tiles) {
        tiles[i] = Tile_Solid
    }

    // main chamber (player starts here)
    for ty in 16..<32 {
        for tx in 3..<24 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    // hard floor under spawn so player never falls into void
    for tx in 3..<24 {
        set_tile(tx, 31, Tile_Solid)
        set_tile(tx, 32, Tile_Solid)
    }
    // internal platforms
    for tx in 5..<11 {
        set_tile(tx, 28, Tile_Solid)
    }
    for tx in 14..<20 {
        set_tile(tx, 25, Tile_Solid)
    }
    // pillars
    for ty in 20..<31 {
        set_tile(9, ty, Tile_Solid)
        set_tile(10, ty, Tile_Solid)
    }
    for ty in 22..<31 {
        set_tile(17, ty, Tile_Solid)
    }

    // tunnel east
    for tx in 24..<50 {
        set_tile(tx, 24, Tile_Air)
        set_tile(tx, 25, Tile_Air)
        set_tile(tx, 26, Tile_Air)
        if (tx % 4) != 0 {
            set_tile(tx, 23, Tile_Air)
        }
    }
    // tunnel floor
    for tx in 24..<50 {
        set_tile(tx, 27, Tile_Solid)
    }

    // vertical shaft
    for ty in 6..<25 {
        set_tile(38, ty, Tile_Air)
        set_tile(39, ty, Tile_Air)
    }

    // upper room
    for ty in 4..<14 {
        for tx in 32..<48 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    for tx in 32..<48 {
        set_tile(tx, 13, Tile_Solid)
    }

    // rubble
    set_tile(6, 30, Tile_Solid)
    set_tile(7, 30, Tile_Solid)
    set_tile(20, 30, Tile_Solid)
    set_tile(28, 26, Tile_Solid)
    set_tile(29, 26, Tile_Solid)
    set_tile(42, 26, Tile_Solid)
}

dig_at :: proc(wx, wy: f32) {
    tx, ty := world_to_tile(wx, wy)
    for dy in -1..=0 {
        for dx in -1..=0 {
            set_tile(tx + dx, ty + dy, Tile_Air)
        }
    }
}

@(export)
export_get_tile :: proc "c" (tx, ty: i32) -> u8 {
    context = runtime.default_context()
    return get_tile(int(tx), int(ty))
}

@(export)
export_world_w :: proc "c" () -> i32 { return i32(WORLD_W) }
@(export)
export_world_h :: proc "c" () -> i32 { return i32(WORLD_H) }
@(export)
export_tile_size :: proc "c" () -> i32 { return i32(TILE_SIZE) }
