package main

import "base:runtime"
import "core:math"

TILE_SIZE :: 4
WORLD_W   :: 80
WORLD_H   :: 45

Tile_Air     :: u8(0)
Tile_Dirt    :: u8(1)
Tile_Wood    :: u8(2)
Tile_Hard    :: u8(3)
Tile_Crystal :: u8(4)

tiles: [WORLD_W * WORLD_H]u8
explored: [WORLD_W * WORLD_H]u8

idx :: proc(tx, ty: int) -> int {
	return ty * WORLD_W + tx
}

in_bounds :: proc(tx, ty: int) -> bool {
	return tx >= 0 && tx < WORLD_W && ty >= 0 && ty < WORLD_H
}

get_tile :: proc(tx, ty: int) -> u8 {
	if !in_bounds(tx, ty) do return Tile_Hard
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

carve_circle :: proc(cx, cy, r: int) {
	r2 := r * r
	for dy in -r..=r {
		for dx in -r..=r {
			if dx * dx + dy * dy <= r2 + r {
				set_tile(cx + dx, cy + dy, Tile_Air)
			}
		}
	}
}

// wavy tube: step x, y follows sin+cos, carve circular cross-section
carve_wavy :: proc(x0, x1, base_y: int, amp, freq: f32, r: int) {
	for tx := x0; tx <= x1; tx += 1 {
		wave := math.sin(f32(tx) * freq) * amp + math.cos(f32(tx) * freq * 0.63) * (amp * 0.45)
		cy := base_y + int(wave)
		if cy < r + 1 do cy = r + 1
		if cy > WORLD_H - r - 2 do cy = WORLD_H - r - 2
		carve_circle(tx, cy, r)
		if (tx % 5) == 0 {
			carve_circle(tx, cy, r + 1)
		}
	}
}

gen_world :: proc() {
	// hard rock fill
	for i in 0..<len(tiles) {
		tiles[i] = Tile_Hard
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

	// === TUNNEL NETWORK (circular cross-section tubes, Noita-like) ===
	// main mid-height from doorway
	carve_wavy(17, 78, 27, 3.8, 0.11, 3)
	// upper parallel
	carve_wavy(19, 76, 13, 2.8, 0.085, 2)
	// lower
	carve_wavy(21, 75, 36, 2.5, 0.13, 2)
	// vertical shafts connecting levels
	for y in 14..=26 {
		carve_circle(29, y, 2)
	}
	carve_circle(28, 20, 2)
	carve_circle(30, 20, 2)
	for y in 27..=36 {
		carve_circle(42, y, 2)
	}
	for y in 13..=27 {
		carve_circle(55, y, 2)
	}
	// side branch
	carve_wavy(45, 62, 20, 1.5, 0.2, 2)
	// end chamber pockets
	carve_circle(74, 26, 5)
	carve_circle(76, 24, 4)
	carve_circle(75, 28, 3)

	// === soft Dirt shell surrounding tunnels (2 passes = thicker soft layer) ===
	for _ in 0..<2 {
		for ty in 0..<WORLD_H {
			for tx in 0..<WORLD_W {
				if get_tile(tx, ty) != Tile_Hard do continue
				has_air := false
				for dy in -1..=1 {
					for dx in -1..=1 {
						if dx == 0 && dy == 0 do continue
						if get_tile(tx + dx, ty + dy) == Tile_Air {
							has_air = true
							break
						}
					}
					if has_air do break
				}
				if has_air {
					set_tile(tx, ty, Tile_Dirt)
				}
			}
		}
	}

	// === light pockets: sparse crystals in remaining hard rock ===
	for ty in 1..<WORLD_H - 1 {
		for tx in 1..<WORLD_W - 1 {
			if get_tile(tx, ty) != Tile_Hard do continue
			h := (tx * 17 + ty * 31 + tx * ty) % 67
			if h == 0 || h == 13 {
				set_tile(tx, ty, Tile_Crystal)
				if get_tile(tx + 1, ty) == Tile_Hard do set_tile(tx + 1, ty, Tile_Crystal)
				if get_tile(tx, ty + 1) == Tile_Hard do set_tile(tx, ty + 1, Tile_Crystal)
				if h == 0 && get_tile(tx - 1, ty) == Tile_Hard do set_tile(tx - 1, ty, Tile_Crystal)
			}
		}
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
			t := get_tile(tx + dx, ty + dy)
			// only soft materials; Hard stays (upgrade dig later)
			if t == Tile_Dirt || t == Tile_Wood || t == Tile_Crystal {
				set_tile(tx + dx, ty + dy, Tile_Air)
			}
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
