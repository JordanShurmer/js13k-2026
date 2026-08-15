package main

import "base:runtime"

TILE_SIZE :: 4
WORLD_W   :: 80
WORLD_H   :: 45

Tile_Air   :: u8(0)
Tile_Solid :: u8(1)
Tile_Wood  :: u8(2)

tiles: [WORLD_W * WORLD_H]u8
explored: [WORLD_W * WORLD_H]u8

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
        explored[i] = 0
    }

    // === WOOD START ROOM (left) ===
    // air interior
    for ty in 20..<34 {
        for tx in 3..<17 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    // wood floor (thick)
    for tx in 3..<17 {
        set_tile(tx, 33, Tile_Wood)
        set_tile(tx, 34, Tile_Wood)
    }
    // wood ceiling
    for tx in 3..<17 {
        set_tile(tx, 19, Tile_Wood)
        set_tile(tx, 18, Tile_Wood)
    }
    // wood left wall
    for ty in 18..<35 {
        set_tile(2, ty, Tile_Wood)
        set_tile(1, ty, Tile_Wood)
    }
    // right wall partial (opening to tunnel at mid height)
    for ty in 18..<24 {
        set_tile(16, ty, Tile_Wood)
        set_tile(17, ty, Tile_Wood)
    }
    for ty in 30..<35 {
        set_tile(16, ty, Tile_Wood)
        set_tile(17, ty, Tile_Wood)
    }
    // doorway air
    for ty in 24..<30 {
        set_tile(16, ty, Tile_Air)
        set_tile(17, ty, Tile_Air)
    }
    // simple table for book/candle (wood platform)
    for tx in 5..<9 {
        set_tile(tx, 32, Tile_Wood)
    }
    // mark start room explored so candle area is visible
    for ty in 18..<35 {
        for tx in 1..<18 {
            if in_bounds(tx, ty) {
                explored[idx(tx, ty)] = 1
            }
        }
    }

    // === GIANT CAUSEWAY (tall tunnels east) ===
    // main corridor: high ceiling, plenty headroom (~20 tiles / 80px)
    for tx in 17..<78 {
        for ty in 10..<33 {
            set_tile(tx, ty, Tile_Air)
        }
        // solid floor
        set_tile(tx, 33, Tile_Solid)
        set_tile(tx, 34, Tile_Solid)
        // solid ceiling
        set_tile(tx, 9, Tile_Solid)
        set_tile(tx, 8, Tile_Solid)
    }

    // jutting walls / stalagmites from floor
    for tx := 20; tx < 75; tx += 4 {
        h := 2 + (tx % 5)
        for dy in 0..<h {
            set_tile(tx, 32 - dy, Tile_Solid)
            if (tx % 3) == 0 {
                set_tile(tx + 1, 32 - dy, Tile_Solid)
            }
        }
    }
    // stalactites from ceiling
    for tx := 22; tx < 74; tx += 5 {
        h := 1 + (tx % 4)
        for dy in 0..<h {
            set_tile(tx, 10 + dy, Tile_Solid)
            if (tx % 2) == 0 {
                set_tile(tx + 1, 10 + dy, Tile_Solid)
            }
        }
    }
    // floating land bits / platforms mid-air
    for tx := 24; tx < 70; tx += 6 {
        for dx in 0..<4 {
            set_tile(tx + dx, 20, Tile_Solid)
            set_tile(tx + dx, 21, Tile_Solid)
        }
        // small floating chunk above
        if (tx % 12) < 6 {
            set_tile(tx + 1, 15, Tile_Solid)
            set_tile(tx + 2, 15, Tile_Solid)
            set_tile(tx + 1, 16, Tile_Solid)
        }
    }
    // occasional full pillars / wall spurs
    for tx := 28; tx < 72; tx += 9 {
        for ty in 12..<28 {
            if (ty + tx) % 3 != 0 {
                set_tile(tx, ty, Tile_Solid)
            }
        }
    }
    // a few upper ledges / overhangs
    for tx in 40..<55 {
        set_tile(tx, 14, Tile_Solid)
        set_tile(tx, 15, Tile_Solid)
    }
    for tx in 58..<68 {
        set_tile(tx, 17, Tile_Solid)
        set_tile(tx, 18, Tile_Solid)
        set_tile(tx, 19, Tile_Solid)
    }

    // end chamber-ish
    for ty in 12..<30 {
        for tx in 72..<79 {
            set_tile(tx, ty, Tile_Air)
        }
    }
    for tx in 72..<79 {
        set_tile(tx, 30, Tile_Solid)
        set_tile(tx, 31, Tile_Solid)
    }
}

mark_explored :: proc(cx, cy, radius: f32) {
    tr := int(radius / TILE_SIZE) + 2
    tcx, tcy := world_to_tile(cx, cy)
    r2 := tr * tr
    for dy in -tr..=tr {
        for dx in -tr..=tr {
            if dx * dx + dy * dy > r2 do continue
            tx := tcx + dx
            ty := tcy + dy
            if in_bounds(tx, ty) {
                explored[idx(tx, ty)] = 1
            }
        }
    }
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
export_get_explored :: proc "c" (tx, ty: i32) -> u8 {
    context = runtime.default_context()
    if !in_bounds(int(tx), int(ty)) do return 0
    return explored[idx(int(tx), int(ty))]
}

@(export)
export_world_w :: proc "c" () -> i32 { return i32(WORLD_W) }
@(export)
export_world_h :: proc "c" () -> i32 { return i32(WORLD_H) }
@(export)
export_tile_size :: proc "c" () -> i32 { return i32(TILE_SIZE) }
