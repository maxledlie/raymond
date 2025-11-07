import { vec_add, vec_sub, vec_mul, vec_magnitude, vec_normalize, translation, rotation, mat3_mul_mat, mat3_mul_vec, mat3_inverse, scale, mat3_identity, mat3_chain } from "./math.js";
import Transform from "./transform.js";
const tools = [
    { type: "laser", name: "Laser", hotkey: "l" },
    { type: "mirror", name: "Mirror", hotkey: "m" },
    { type: "pan", name: "Pan", hotkey: "p" }
];
/* Transforms a given ray from world space into the local space of the object */
function transformRay(ray, transform) {
    return {
        start: transform.applyInverse(ray.start),
        direction: transform.applyInverse(ray.direction)
    };
}
const state = {
    lastMousePos: { x: 0, y: 0 },
    placementStart: null,
    panStart: null,
    tool: "laser",
    entities: [],
    cameraTransform: mat3_identity(),
    cameraInverseTransform: mat3_identity()
};
function defaultTransform(screenWidth, screenHeight) {
    let transform = mat3_identity();
    // Flip so y axis points upwards and stretch so each unit is much larger than one pixel
    transform = mat3_mul_mat(scale(100, -100), transform);
    // Translate so origin is at centre of screen
    transform = mat3_mul_mat(translation(screenWidth / 2, screenHeight / 2), transform);
    return transform;
}
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
    state.cameraTransform = defaultTransform(p.width, p.height);
    state.cameraInverseTransform = mat3_inverse(state.cameraTransform);
}
/** Draws a line described in world space using the current camera transform and p5 drawing state */
function drawLine(p, start, end) {
    const startScreen = mat3_mul_vec(state.cameraTransform, start);
    const endScreen = mat3_mul_vec(state.cameraTransform, end);
    p.line(startScreen.x, startScreen.y, endScreen.x, endScreen.y);
}
function p5_draw(p) {
    p.background("black");
    p.stroke("white");
    p.fill("white");
    p.noStroke();
    for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        const text = (state.tool == tool.type ? "> " : "  ") + tool.name + " (" + tool.hotkey.toUpperCase() + ")";
        p.text(text, 10, 20 * (i + 1));
    }
    // Find mouse coordinates
    const mouseScreen = { x: p.mouseX, y: p.mouseY };
    const mouseWorld = mat3_mul_vec(state.cameraInverseTransform, mouseScreen);
    p.text(`x: ${mouseWorld.x.toFixed(2)}, y: ${mouseWorld.y.toFixed(2)}`, p.width / 2, 20);
    // Handle panning
    if (state.panStart != null) {
        const panSpeed = 0.5;
        const mouseDelta = vec_sub(mouseScreen, state.lastMousePos);
        const pan = vec_mul(mouseDelta, panSpeed);
        state.cameraTransform = mat3_mul_mat(translation(pan.x, pan.y), state.cameraTransform);
        state.cameraInverseTransform = mat3_inverse(state.cameraTransform);
    }
    // Draw coordinate grid
    const gridColor = p.color(100, 100);
    p.stroke(gridColor);
    for (let i = -100; i < 100; i++) {
        const xStartWorld = { x: i, y: -100 };
        const xEndWorld = { x: i, y: 100 };
        drawLine(p, xStartWorld, xEndWorld);
        const yStartWorld = { x: -100, y: i };
        const yEndWorld = { x: 100, y: i };
        drawLine(p, yStartWorld, yEndWorld);
    }
    p.strokeWeight(2);
    p.stroke("white");
    const yAxisStartWorld = { x: 0, y: -100 };
    const yAxisEndWorld = { x: 0, y: 100 };
    const xAxisStartWorld = { x: -100, y: 0 };
    const xAxisEndWorld = { x: 100, y: 0 };
    drawLine(p, yAxisStartWorld, yAxisEndWorld);
    drawLine(p, xAxisStartWorld, xAxisEndWorld);
    // Draw entities
    for (const entity of state.entities) {
        drawEntity(p, entity);
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
        const startWorld = transform.apply(startLocal);
        const endWorld = transform.apply(endLocal);
        console.log("Mirror start world: ", startWorld);
        console.log("Mirror end world: ", endWorld);
        drawLine(p, startWorld, endWorld);
    }
    if (state.placementStart) {
        if (state.tool == "laser") {
            p.stroke("yellow");
            const ray = drawnRay(p);
            // Find end point of line very far along the direction from mouse start to mouse end
            const endPoint = vec_add(ray.start, vec_mul(ray.direction, 10000));
            p.line(ray.start.x, ray.start.y, endPoint.x, endPoint.y);
        }
        else if (state.tool == "mirror") {
            const previewMirror = computePreviewMirror(state.placementStart, { x: p.mouseX, y: p.mouseY });
            drawEntity(p, previewMirror);
        }
    }
    state.lastMousePos = mouseScreen;
}
function drawEntity(p, entity) {
    const hovered = hitTest(entity, { x: p.mouseX, y: p.mouseY });
    switch (entity.type) {
        case "laser":
            drawLaser(p, entity, hovered);
            break;
        case "mirror":
            drawMirror(p, entity, hovered);
            break;
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
function drawMirror(p, mirror, hovered) {
    p.stroke("lightblue");
    p.strokeWeight(2);
    const startWorld = mirror.transform.apply({ x: -1, y: 0 });
    const endWorld = mirror.transform.apply({ x: 1, y: 0 });
    drawLine(p, startWorld, endWorld);
}
function drawnRay(p) {
    const mouse = { x: p.mouseX, y: p.mouseY };
    const direction = vec_normalize(vec_sub(mouse, state.placementStart));
    return { start: state.placementStart, direction };
}
function p5_mouse_pressed(p, e) {
    const mousePos = { x: p.mouseX, y: p.mouseY };
    if (e.button === 0) {
        state.placementStart = mat3_mul_vec(state.cameraInverseTransform, mousePos);
    }
    if (e.button === 1 || state.tool === "pan") {
        state.panStart = mousePos;
    }
}
function p5_key_pressed(p) {
    for (const tool of tools) {
        if (p.key == tool.hotkey || p.key == tool.hotkey.toUpperCase()) {
            state.tool = tool.type;
        }
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
    if (e.button == 0) {
        if (state.placementStart) {
            if (state.tool == "laser") {
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
            else if (state.tool == "mirror") {
                const newMirror = computePreviewMirror(state.placementStart, { x: p.mouseX, y: p.mouseY });
                state.entities.push(newMirror);
            }
        }
        state.placementStart = null;
    }
    if (e.button == 1 || state.tool == "pan") {
        state.panStart = null;
    }
}
/* Returns the mirror that would be placed if the mouse were released after dragging a certain line on the screen */
function computePreviewMirror(placementStart, mousePos) {
    const end = mat3_mul_vec(state.cameraInverseTransform, mousePos);
    const dir = vec_sub(end, placementStart);
    const theta = Math.atan2(dir.y, dir.x);
    const midpoint = vec_mul(vec_add(state.placementStart, end), 0.5);
    const length = vec_magnitude(vec_sub(end, state.placementStart));
    const s = length / 2;
    const transform = new Transform();
    transform.scale(s, 1);
    transform.rotate(theta);
    transform.translate(midpoint.x, midpoint.y);
    return {
        type: "mirror",
        transform
    };
}
function p5_mouse_wheel(p, e) {
    const zoomSpeed = 0.0001;
    const mouseScreen = { x: p.mouseX, y: p.mouseY };
    const mouseWorld = mat3_mul_vec(state.cameraInverseTransform, mouseScreen);
    const trans = translation(mouseWorld.x, mouseWorld.y);
    const transInv = mat3_inverse(trans);
    state.cameraTransform = mat3_chain([state.cameraTransform, trans, scale(1 - zoomSpeed * e.deltaY), transInv]);
    state.cameraInverseTransform = mat3_inverse(state.cameraTransform);
}
function p5_window_resized(p) {
    console.log("Window resized");
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    state.cameraTransform = defaultTransform(p.width, p.height);
    state.cameraInverseTransform = mat3_inverse(state.cameraTransform);
}
const s = (p) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.keyPressed = () => p5_key_pressed(p);
    p.mousePressed = (e) => p5_mouse_pressed(p, e);
    p.mouseReleased = (e) => p5_mouse_released(p, e);
    p.mouseWheel = (e) => p5_mouse_wheel(p, e);
    p.windowResized = () => p5_window_resized(p);
};
const sketch = new p5(s);
function rayIntersectSegment(ray, segment) {
    // Transform the ray into the segment's local space.
    const r = transformRay(ray, segment.transform);
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
    return t;
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
