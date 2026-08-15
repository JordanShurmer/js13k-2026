package main

import "core:runtime"

// Data-oriented world: one flat array of tiles.
// Everything optional later can be #if'd out; this core stays.

TILE_SIZE :: 4
WORLD_W   :: 80   // 320 px
WORLD_H   :: 45   // 180 px

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
    if !in_bounds(tx, ty) do return Tile_Solid // outside = solid wall
    return tiles[idx(tx, ty)]
}

set_tile :: proc(tx, ty: int, v: u8) {
    if !in_bounds(tx, ty) do return
    tiles[idx(tx, ty)] = v
}

is_solid :: proc(tx, ty: int) -> bool {
    return get_tile(tx, ty) != Tile_Air
}

// World coords → tile
world_to_tile :: proc(wx, wy: f32) -> (int, int) {
    return int(wx / TILE_SIZE), int(wy / TILE_SIZE)
}

// Fill solid, carve a more interesting starting ruin: chamber, tunnel, shafts, rubble niches.
gen_world :: proc() {
    for i in 0..<len(tiles) {
        tiles[i] = Tile_Solid
    }
    // starting chamber
    for ty in 18..<32 {
        for tx in 4..<22 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    // floor platforms / steps inside chamber
    for tx in 6..<12 {
        set_tile(tx, 28, Tile_Solid)
        set_tile(tx, 29, Tile_Solid)
    }
    for tx in 14..<19 {
        set_tile(tx, 26, Tile_Solid)
    }
    // short horizontal tunnel with uneven roof
    for tx in 22..<48 {
        set_tile(tx, 24, Tile_Air)
        set_tile(tx, 25, Tile_Air)
        if tx % 5 != 0 {
            set_tile(tx, 23, Tile_Air)
        }
    }
    // vertical shaft
    for ty in 8..<25 {
        set_tile(36, ty, Tile_Air)
        set_tile(37, ty, Tile_Air)
    }
    // small upper chamber
    for ty in 6..<14 {
        for tx in 30..<44 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    // a couple of pillars / ruin supports
    for ty in 20..<28 {
        set_tile(10, ty, Tile_Solid)
        set_tile(11, ty, Tile_Solid)
    }
    for ty in 22..<28 {
        set_tile(16, ty, Tile_Solid)
    }
    // rubble pockets on floor
    set_tile(8, 31, Tile_Solid)
    set_tile(9, 31, Tile_Solid)
    set_tile(18, 31, Tile_Solid)
    set_tile(25, 25, Tile_Solid)
    set_tile(26, 25, Tile_Solid)
    set_tile(40, 25, Tile_Solid)
}

// Dig a small brush of tiles around a world point (the dig tool).
dig_at :: proc(wx, wy: f32) {
    tx, ty := world_to_tile(wx, wy)
    // 2x2 brush so it feels usable at TILE_SIZE=4
    for dy in -1..=0 {
        for dx in -1..=0 {
            set_tile(tx + dx, ty + dy, Tile_Air)
        }
    }
}

// Exported for JS drawing / debug
@(export)
export_get_tile :: proc "c" (tx, ty: i32) -> u8 {
    context = runtime.default_context()
    return get_tile(int(tx), int(ty))
}

@(export)
export_world_w :: proc "c" () -> i32 {
    return i32(WORLD_W)
}

@(export)
export_world_h :: proc "c" () -> i32 {
    return i32(WORLD_H)
}

@(export)
export_tile_size :: proc "c" () -> i32 {
    return i32(TILE_SIZE)
}
