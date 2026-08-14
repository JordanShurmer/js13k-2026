package main

// Helper procs that generate different assets at locations.
// All drawing currently stubbed; later call into canvas foreign or pixel buffer.

// Placeholder rects that will become the level geometry
walls: [32]Rect
wall_count: int

add_wall :: proc(x, y, w, h: f32) {
    if wall_count >= len(walls) do return
    walls[wall_count] = {x, y, w, h}
    wall_count += 1
}

gen_basic_ruins :: proc() {
    wall_count = 0
    // floor
    add_wall(0, 150, 320, 30)
    // left ruin wall
    add_wall(0, 80, 20, 70)
    // broken pillar
    add_wall(120, 100, 12, 50)
    // right rubble pile (approx)
    add_wall(240, 130, 40, 20)
    add_wall(250, 110, 20, 20)
}

// Call once after init
@(export)
setup_world :: proc "c" () {
    context = runtime.default_context()
    gen_basic_ruins()
}

// Future: gen_pillar, gen_rubble with seed variation, etc.
