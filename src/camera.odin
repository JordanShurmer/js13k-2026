package main

import "core:runtime"

CameraMode :: enum u8 {
    Follow,
    LookAt,
    PanTo,
    Hold,
}

CameraTrigger :: struct {
    rect: Rect,
    mode: CameraMode,
    target: Vec2,
    duration: f32,
    fired: bool,
}

triggers: [8]CameraTrigger
trigger_count: int

cam_mode: CameraMode = .Follow
cam_target: Vec2
cam_timer: f32

add_trigger :: proc(r: Rect, mode: CameraMode, target: Vec2, dur: f32) {
    if trigger_count >= len(triggers) do return
    triggers[trigger_count] = {r, mode, target, dur, false}
    trigger_count += 1
}

setup_camera_triggers :: proc() {
    // example: when player reaches the pillar area, look at the orb for 2s
    add_trigger({100, 80, 40, 60}, .LookAt, {160, 90}, 2.0)
}

check_triggers :: proc(px, py: f32) {
    for i in 0..<trigger_count {
        t := &triggers[i]
        if t.fired do continue
        if px > t.rect.x && px < t.rect.x + t.rect.w &&
           py > t.rect.y && py < t.rect.y + t.rect.h {
            t.fired = true
            cam_mode = t.mode
            cam_target = t.target
            cam_timer = t.duration
        }
    }
}

update_camera_full :: proc(player: Vec2, dt: f32) {
    check_triggers(player.x, player.y)

    switch cam_mode {
    case .Follow:
        target := player - Vec2{cw * 0.5, ch * 0.5}
        cam = approach_v(cam, target, 6.0 * dt)
    case .LookAt, .PanTo:
        cam = approach_v(cam, cam_target - Vec2{cw * 0.5, ch * 0.5}, 3.0 * dt)
        cam_timer -= dt
        if cam_timer <= 0 {
            cam_mode = .Follow
        }
    case .Hold:
        // stay
        cam_timer -= dt
        if cam_timer <= 0 {
            cam_mode = .Follow
        }
    }
}
