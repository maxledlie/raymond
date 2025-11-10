import { vec_add, vec_sub, vec_mul, vec_magnitude, vec_normalize, translation, mat3_mul_mat, mat3_mul_vec, mat3_inverse, scale, mat3_identity, mat3_chain, newPoint, newVector } from "./math.js";
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
    lastMousePos: newPoint(0, 0),
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
    const mouseScreen = newPoint(p.mouseX, p.mouseY);
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
    const minorColor = p.color(100, 100);
    const majorColor = p.color(255);
    drawCoordinates(p, new Transform(), majorColor, minorColor, 100);
    // Draw entities
    for (const entity of state.entities) {
        const hovered = hitTest(entity, newPoint(p.mouseX, p.mouseY));
        drawEntity(p, entity, hovered);
    }
    const lasers = state.entities.filter(e => e.type == "laser");
    const mirrors = state.entities.filter(e => e.type == "mirror");
    // Work out the segments to actually draw
    const segments = [];
    for (const laser of lasers) {
        const fullDir = vec_sub(laser.transform.apply(newPoint(1, 0)), laser.transform.apply(newPoint(0, 0)));
        const ray = {
            start: laser.transform.apply(newPoint(0, 0)),
            direction: vec_normalize(fullDir)
        };
        let tmin = Infinity;
        for (const mirror of mirrors) {
            const t = rayIntersectSegment(ray, mirror);
            if (t != null && t >= 0 && t < tmin) {
                tmin = t;
            }
        }
        if (tmin == Infinity) {
            // No intersection: Find end point of line very far along the direction from mouse start to mouse end
            segments.push({ start: ray.start, end: pointOnRay(ray, 10000) });
        }
        else {
            segments.push({ start: ray.start, end: pointOnRay(ray, tmin) });
        }
    }
    p.stroke("yellow");
    for (const segment of segments) {
        drawLine(p, segment.start, segment.end);
    }
    p.stroke("lightblue");
    for (const { transform } of mirrors) {
        const startLocal = newPoint(-1, 0);
        const endLocal = newPoint(1, 0);
        const startWorld = transform.apply(startLocal);
        const endWorld = transform.apply(endLocal);
        drawLine(p, startWorld, endWorld);
    }
    if (state.placementStart) {
        const mouse = newPoint(p.mouseX, p.mouseY);
        if (state.tool == "laser") {
            const previewLaser = computePreviewLaser(state.placementStart, mouse);
            drawEntity(p, previewLaser, true);
        }
        else if (state.tool == "mirror") {
            const previewMirror = computePreviewMirror(state.placementStart, mouse);
            drawEntity(p, previewMirror, true);
        }
    }
    state.lastMousePos = mouseScreen;
}
function drawEntity(p, entity, hovered) {
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
    // Drawing the apparatus as a polygon is probably suboptimal.
    // Maybe I should transform the canvas and use p.rect?
    const topLeft = newPoint(-0.4, -0.1);
    const topRight = newPoint(0, -0.1);
    const bottomRight = newPoint(0, 0.1);
    const bottomLeft = newPoint(-0.4, 0.1);
    if (hovered) {
        // Draw local coordinate system of laser
        const minorColor = p.color(0, 100, 0, 100);
        const majorColor = p.color(0, 255, 0, 255);
        drawCoordinates(p, laser.transform, majorColor, minorColor, 2);
    }
    p.noStroke();
    p.fill(hovered ? "green" : "white");
    p.beginShape();
    for (const vertex of [topLeft, topRight, bottomRight, bottomLeft]) {
        const world = laser.transform.apply(vertex);
        const screen = mat3_mul_vec(state.cameraTransform, world);
        p.vertex(screen.x, screen.y);
    }
    p.endShape();
}
function drawMirror(p, mirror, hovered) {
    if (hovered) {
        const majorColor = p.color(100, 100, 255, 255);
        const minorColor = p.color(100, 100, 255, 200);
        drawCoordinates(p, mirror.transform, majorColor, minorColor, 2);
    }
    p.stroke("lightblue");
    p.strokeWeight(hovered ? 4 : 2);
    const startWorld = mirror.transform.apply(newPoint(-1, 0));
    const endWorld = mirror.transform.apply(newPoint(1, 0));
    drawLine(p, startWorld, endWorld);
}
/**
 * Given a `transform` that maps points from one space to another, draws the coordinates
 * of this new space.
 */
function drawCoordinates(p, transform, majorColor, minorColor, gridSize) {
    p.stroke(1);
    p.stroke(minorColor);
    for (let i = -gridSize; i <= gridSize; i++) {
        const xStartWorld = transform.apply(newPoint(i, -gridSize));
        const xEndWorld = transform.apply(newPoint(i, gridSize));
        drawLine(p, xStartWorld, xEndWorld);
        const yStartWorld = transform.apply(newPoint(-gridSize, i));
        const yEndWorld = transform.apply(newPoint(gridSize, i));
        drawLine(p, yStartWorld, yEndWorld);
    }
    p.strokeWeight(2);
    p.stroke(majorColor);
    const xAxisEndLocal = newPoint(gridSize, 0);
    const yAxisEndLocal = newPoint(0, gridSize);
    const yAxisStartWorld = transform.apply(newPoint(0, -gridSize));
    const yAxisEndWorld = transform.apply(yAxisEndLocal);
    const xAxisStartWorld = transform.apply(newPoint(-gridSize, 0));
    const xAxisEndWorld = transform.apply(xAxisEndLocal);
    drawLine(p, yAxisStartWorld, yAxisEndWorld);
    drawLine(p, xAxisStartWorld, xAxisEndWorld);
    // Arrow heads indicating direction of axes
    const yAxisLeftLocal = vec_add(yAxisEndLocal, newVector(-0.1, -0.1));
    const yAxisRightLocal = vec_add(yAxisEndLocal, newVector(0.1, -0.1));
    const yAxisLeftWorld = transform.apply(yAxisLeftLocal);
    const yAxisRightWorld = transform.apply(yAxisRightLocal);
    drawLine(p, yAxisEndWorld, yAxisLeftWorld);
    drawLine(p, yAxisEndWorld, yAxisRightWorld);
    const xAxisLeftLocal = vec_add(xAxisEndLocal, newVector(-0.1, 0.1));
    const xAxisRightLocal = vec_add(xAxisEndLocal, newVector(-0.1, -0.1));
    const xAxisLeftWorld = transform.apply(xAxisLeftLocal);
    const xAxisRightWorld = transform.apply(xAxisRightLocal);
    drawLine(p, xAxisEndWorld, xAxisLeftWorld);
    drawLine(p, xAxisEndWorld, xAxisRightWorld);
}
function p5_mouse_pressed(p, e) {
    const mousePos = newPoint(p.mouseX, p.mouseY);
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
    // Transform point from screen to world to local space
    const world = mat3_mul_vec(state.cameraInverseTransform, screenPoint);
    const local = laser.transform.applyInverse(world);
    // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
    if (local.x >= -0.4 && local.x <= 0 && local.y >= -0.1 && local.y <= 0.1) {
        return true;
    }
    return false;
}
function hitTestMirror(mirror, screenPoint) {
    const world = mat3_mul_vec(state.cameraInverseTransform, screenPoint);
    const local = mirror.transform.applyInverse(world);
    return Math.abs(local.y) < 0.1 && Math.abs(local.x) < 1;
}
function p5_mouse_released(p, e) {
    if (e.button == 0) {
        if (state.placementStart) {
            if (state.tool == "laser") {
                const newLaser = computePreviewLaser(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.entities.push(newLaser);
            }
            else if (state.tool == "mirror") {
                const newMirror = computePreviewMirror(state.placementStart, newPoint(p.mouseX, p.mouseY));
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
function computePreviewLaser(placementStart, mousePos) {
    const end = mat3_mul_vec(state.cameraInverseTransform, mousePos);
    const dir = vec_sub(end, placementStart);
    const theta = Math.atan2(dir.y, dir.x);
    const transform = new Transform();
    transform.rotate(theta);
    transform.translate(placementStart.x, placementStart.y);
    return {
        type: "laser",
        transform
    };
}
function p5_mouse_wheel(p, e) {
    const zoomSpeed = 0.0001;
    const mouseScreen = newPoint(p.mouseX, p.mouseY);
    const mouseWorld = mat3_mul_vec(state.cameraInverseTransform, mouseScreen);
    const trans = translation(mouseWorld.x, mouseWorld.y);
    const transInv = mat3_inverse(trans);
    state.cameraTransform = mat3_chain([state.cameraTransform, trans, scale(1 - zoomSpeed * e.deltaY), transInv]);
    state.cameraInverseTransform = mat3_inverse(state.cameraTransform);
}
function p5_window_resized(p) {
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
    const t = (-r.start.y / r.direction.y);
    const x = r.start.x + t * r.direction.x;
    // Ray may have missed the segment
    if (Math.abs(x) > 1) {
        return null;
    }
    return t;
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
