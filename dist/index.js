import { vec_add, vec_sub, vec_mul, vec_magnitude, vec_normalize, translation, rotation, mat3_mul_mat, mat3_mul_vec, mat3_inverse, scale, mat3_identity } from "./math.js";
function transformRay(ray, transform) {
    return {
        start: mat3_mul_vec(transform, ray.start),
        direction: mat3_mul_vec(transform, ray.direction)
    };
}
const state = {
    debug: false,
    placementStart: null,
    panStart: null,
    editMode: "laser",
    entities: [],
    transform: defaultTransform(),
    inv_transform: mat3_inverse(defaultTransform()),
};
function defaultTransform() {
    let transform = mat3_identity();
    // Flip so y axis points upwards and stretch so each unit is much larger than one pixel.
    transform = mat3_mul_mat(scale(100, -100), transform);
    // Translate so origin is visible
    transform = mat3_mul_mat(translation(500, 500), transform);
    return transform;
}
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}
/** Draws a line described in world space using the current camera transform and p5 drawing state */
function drawLine(p, start, end) {
    const startScreen = mat3_mul_vec(state.transform, start);
    const endScreen = mat3_mul_vec(state.transform, end);
    p.line(startScreen.x, startScreen.y, endScreen.x, endScreen.y);
}
function p5_draw(p) {
    p.background("black");
    p.stroke("white");
    p.fill("white");
    p.noStroke();
    p.text(state.editMode == "laser" ? "> draw laser (L)" : "  draw laser (L)", 10, 20);
    p.text(state.editMode == "mirror" ? "> draw mirror (M)" : "  draw mirror (M)", 10, 40);
    // Find mouse coordinates
    const mouseWorld = mat3_mul_vec(state.inv_transform, { x: p.mouseX, y: p.mouseY });
    p.text(`x: ${mouseWorld.x.toFixed(2)}, y: ${mouseWorld.y.toFixed(2)}`, p.width / 2, 20);
    // Handle panning
    const panSpeed = 0.02;
    if (state.panStart != null) {
        state.transform = mat3_mul_mat(translation(panSpeed * (p.mouseX - state.panStart.x), panSpeed * (p.mouseY - state.panStart.y)), state.transform);
        state.inv_transform = mat3_inverse(state.transform);
    }
    // Draw coordinate grid
    const gridColor = p.color(100, 100);
    p.stroke(gridColor);
    for (let i = -1000; i < 1000; i++) {
        const xStartWorld = { x: i, y: -1000000 };
        const xEndWorld = { x: i, y: 1000000 };
        drawLine(p, xStartWorld, xEndWorld);
        const yStartWorld = { x: -1000000, y: i };
        const yEndWorld = { x: 1000000, y: i };
        drawLine(p, yStartWorld, yEndWorld);
    }
    p.strokeWeight(2);
    p.stroke("white");
    const yAxisStartWorld = { x: 0, y: -1000000 };
    const yAxisEndWorld = { x: 0, y: 1000000 };
    const xAxisStartWorld = { x: -1000000, y: 0 };
    const xAxisEndWorld = { x: 1000000, y: 0 };
    drawLine(p, yAxisStartWorld, yAxisEndWorld);
    drawLine(p, xAxisStartWorld, xAxisEndWorld);
    // Draw entities
    const mouseVec = { x: p.mouseX, y: p.mouseY };
    for (const entity of state.entities) {
        const hovered = hitTest(entity, mouseVec);
        switch (entity.type) {
            case "laser":
                drawLaser(p, entity, hovered);
                break;
        }
    }
    const lasers = state.entities.filter(e => e.type == "laser");
    const mirrors = state.entities.filter(e => e.type == "mirror");
    // Work out the segments to actually draw
    const segments = [];
    for (const laser of lasers) {
        let tmin = Infinity;
        for (const mirror of mirrors) {
            const t = rayIntersectSegment(laser, mirror);
            if (t != null && t >= 0 && t < tmin) {
                tmin = t;
            }
        }
        if (tmin == Infinity) {
            // No intersection: Find end point of line very far along the direction from mouse start to mouse end
            segments.push({ start: laser.start, end: pointOnRay(laser, 10000) });
        }
        else {
            segments.push({ start: laser.start, end: pointOnRay(laser, tmin) });
        }
    }
    p.stroke("yellow");
    for (const segment of segments) {
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
    p.stroke("lightblue");
    for (const { transform } of mirrors) {
        const startLocal = { x: -1, y: 0 };
        const endLocal = { x: 1, y: 0 };
        const startWorld = mat3_mul_vec(transform, startLocal);
        const endWorld = mat3_mul_vec(transform, endLocal);
        p.line(startWorld.x, startWorld.y, endWorld.x, endWorld.y);
    }
    if (state.placementStart) {
        if (state.editMode == "laser") {
            p.stroke("yellow");
            const ray = drawnRay(p);
            // Find end point of line very far along the direction from mouse start to mouse end
            const endPoint = vec_add(ray.start, vec_mul(ray.direction, 10000));
            p.line(ray.start.x, ray.start.y, endPoint.x, endPoint.y);
        }
        else if (state.editMode == "mirror") {
            p.stroke("lightblue");
            p.line(state.placementStart.x, state.placementStart.y, p.mouseX, p.mouseY);
        }
    }
}
function drawLaser(p, laser, hovered) {
    // Draw rectangle behind the starting point representing the laser generator
    // Calculate angle of beam
    const theta = Math.atan2(laser.direction.y, laser.direction.x);
    p.push();
    p.translate(laser.start.x, laser.start.y);
    p.rotate(theta);
    p.fill("yellow");
    p.circle(0, 0, 5);
    p.fill(hovered ? "green" : "white");
    p.rect(-40, -10, 40, 20);
    p.pop();
}
function drawnRay(p) {
    const mouse = { x: p.mouseX, y: p.mouseY };
    const direction = vec_normalize(vec_sub(mouse, state.placementStart));
    return { start: state.placementStart, direction };
}
function p5_mouse_pressed(p, e) {
    if (e.button == 0) {
        state.placementStart = { x: p.mouseX, y: p.mouseY };
    }
    if (e.button == 1) {
        state.panStart = { x: p.mouseX, y: p.mouseY };
    }
}
function p5_key_pressed(p) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
    if (p.key == "l" || p.key == "L") {
        state.editMode = "laser";
    }
    if (p.key == "m" || p.key == "M") {
        state.editMode = "mirror";
    }
}
/** Returns true if clicking at the given world point should highlight the entity */
function hitTest(entity, mouseVec) {
    switch (entity.type) {
        case "laser":
            return hitTestLaser(entity, mouseVec);
        case "mirror":
            return hitTestMirror(entity, mouseVec);
    }
}
function hitTestLaser(laser, screenPoint) {
    // Build world transform for the laser: translate(start) * rotate(theta)
    const theta = Math.atan2(laser.direction.y, laser.direction.x);
    const T = translation(laser.start.x, laser.start.y);
    const R = rotation(theta);
    const worldTransform = mat3_mul_mat(T, R);
    // Use the generic 3x3 inverse of the world transform
    const inv = mat3_inverse(worldTransform);
    if (!inv)
        return false; // non-invertible - treat as not hittable
    // Transform the screen point into local coords
    const local = mat3_mul_vec(inv, screenPoint);
    // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
    if (local.x >= -40 && local.x <= 0 && local.y >= -10 && local.y <= 10) {
        return true;
    }
    return false;
}
function hitTestMirror(mirror, mouseVec) {
    return false;
}
function p5_mouse_released(p, e) {
    if (e.button == 1) {
        if (state.placementStart) {
            if (state.editMode == "laser") {
                const ray = drawnRay(p);
                const theta = Math.atan2(ray.direction.y, ray.direction.x);
                const transform = mat3_mul_mat(translation(ray.start.x, ray.start.y), rotation(theta));
                state.entities.push({
                    type: "laser",
                    start: ray.start,
                    direction: ray.direction,
                    transform,
                    inv_transform: mat3_inverse(transform)
                });
            }
            else if (state.editMode == "mirror") {
                const end = { x: p.mouseX, y: p.mouseY };
                const dir = vec_sub(end, state.placementStart);
                const theta = Math.atan2(dir.y, dir.x);
                console.log("theta: ", theta);
                const midpoint = vec_mul(vec_add(state.placementStart, end), 0.5);
                const length = vec_magnitude(vec_sub(end, state.placementStart));
                const s = length / 2;
                let transform = mat3_mul_mat(rotation(theta), scale(s, 1));
                transform = mat3_mul_mat(translation(midpoint.x, midpoint.y), transform);
                state.entities.push({
                    type: "mirror",
                    transform,
                    inv_transform: mat3_inverse(transform)
                });
            }
        }
        state.placementStart = null;
    }
    if (e.button == 1) {
        state.panStart = null;
    }
}
function p5_mouse_wheel(p, e) {
    const zoomSpeed = 0.0001;
    state.transform = mat3_mul_mat(scale(1 - zoomSpeed * e.deltaY), state.transform);
    state.inv_transform = mat3_inverse(state.transform);
}
const s = (p) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.keyPressed = () => p5_key_pressed(p);
    p.mousePressed = (e) => p5_mouse_pressed(p, e);
    p.mouseReleased = (e) => p5_mouse_released(p, e);
    p.mouseWheel = (e) => p5_mouse_wheel(p, e);
};
const sketch = new p5(s);
function rayIntersectSegment(ray, segment) {
    // Transform the ray into the segment's local space.
    const r = transformRay(ray, segment.inv_transform);
    console.log("transformed ray: ", r);
    // In the segment's local space, it's a horizontal line of length 2 centred at the origin.
    // So we need to find the distance along the ray at which it intersects the x axis.
    if (r.direction.x == 0) {
        return null;
    }
    const t = r.start.y / r.direction.y;
    const intersection = pointOnRay(r, t);
    // Ray may have missed the segment
    if (Math.abs(intersection.x) > 1) {
        return null;
    }
    console.log("intersection at ", t);
    return t;
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
