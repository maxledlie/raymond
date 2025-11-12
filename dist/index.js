import { vec_add, vec_sub, vec_mul, vec_magnitude, vec_normalize, translation, mat3_mul_mat, mat3_mul_vec, mat3_inverse, scale, mat3_identity, mat3_chain, newPoint, newVector, vec_div, vec_magnitude_sq, vec_dot } from "./math.js";
import Transform from "./transform.js";
const tools = [
    { type: "laser", name: "Laser", hotkey: "l" },
    { type: "circle", name: "Circle", hotkey: "c" },
    { type: "quad", name: "Quad", hotkey: "q" },
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
    let previewLaser = null;
    let previewShape = null;
    if (state.placementStart) {
        const mouse = newPoint(p.mouseX, p.mouseY);
        if (state.tool == "laser") {
            previewLaser = computePreviewLaser(state.placementStart, mouse);
            drawEntity(p, previewLaser, true);
        }
        else if (state.tool == "quad") {
            previewShape = computePreviewQuad(state.placementStart, mouse);
            drawEntity(p, previewShape, true);
        }
        else if (state.tool == "circle") {
            previewShape = computePreviewCircle(state.placementStart, mouse);
            drawEntity(p, previewShape, true);
        }
    }
    const lasers = state.entities.filter(e => e.type == "laser");
    if (previewLaser) {
        lasers.push(previewLaser);
    }
    const shapes = state.entities.filter(e => e.type == "quad" || e.type == "circle");
    if (previewShape) {
        shapes.push(previewShape);
    }
    // Work out the segments to actually draw
    const segments = [];
    for (const laser of lasers) {
        const fullDir = vec_sub(laser.transform.apply(newPoint(1, 0)), laser.transform.apply(newPoint(0, 0)));
        let ray = {
            start: laser.transform.apply(newPoint(0, 0)),
            direction: vec_normalize(fullDir)
        };
        for (let iReflect = 0; iReflect < 10; iReflect++) {
            let tmin = Infinity;
            let hitShape = null;
            for (const shape of shapes) {
                const ts = rayIntersectShape(ray, shape);
                if (ts.length > 0) {
                    console.log(ts);
                    const tMinShape = Math.min(...ts);
                    if (tMinShape < tmin) {
                        tmin = tMinShape;
                        hitShape = shape;
                    }
                }
            }
            if (tmin == Infinity) {
                // No intersection: Find end point of line very far along the direction from mouse start to mouse end
                segments.push({ start: ray.start, end: pointOnRay(ray, 10000) });
                break;
            }
            const hitPoint = pointOnRay(ray, tmin);
            segments.push({ start: ray.start, end: hitPoint });
        }
    }
    p.stroke("yellow");
    for (const segment of segments) {
        drawLine(p, segment.start, segment.end);
    }
    state.lastMousePos = mouseScreen;
}
function drawEntity(p, entity, hovered) {
    switch (entity.type) {
        case "laser":
            drawLaser(p, entity, hovered);
            break;
        case "quad":
            drawQuad(p, entity, hovered);
            break;
        case "circle":
            drawCircle(p, entity, hovered);
    }
    p.strokeWeight(1);
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
function drawQuad(p, quad, hovered) {
    if (hovered) {
        const majorColor = p.color(100, 100, 255, 255);
        const minorColor = p.color(100, 100, 255, 200);
        drawCoordinates(p, quad.transform, majorColor, minorColor, 2);
    }
    p.stroke("lightblue");
    p.strokeWeight(hovered ? 4 : 2);
    const startWorld = quad.transform.apply(newPoint(-1, 0));
    const endWorld = quad.transform.apply(newPoint(1, 0));
    drawLine(p, startWorld, endWorld);
}
function drawCircle(p, circle, hovered) {
    p.noStroke();
    p.fill("lightblue");
    p.ellipseMode(p.CORNERS);
    const topLeftWorld = circle.transform.apply(newPoint(-1, 1));
    const bottomRightWorld = circle.transform.apply(newPoint(1, -1));
    const topLeftScreen = mat3_mul_vec(state.cameraTransform, topLeftWorld);
    const bottomRightScreen = mat3_mul_vec(state.cameraTransform, bottomRightWorld);
    p.ellipse(topLeftScreen.x, topLeftScreen.y, bottomRightScreen.x, bottomRightScreen.y);
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
        case "quad":
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
            else if (state.tool == "quad") {
                const newMirror = computePreviewQuad(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.entities.push(newMirror);
            }
            else if (state.tool == "circle") {
                const newCircle = computePreviewCircle(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.entities.push(newCircle);
            }
        }
        state.placementStart = null;
    }
    if (e.button == 1 || state.tool == "pan") {
        state.panStart = null;
    }
}
/* Returns the mirror that would be placed if the mouse were released after dragging a certain line on the screen */
function computePreviewQuad(placementStart, mousePos) {
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
        type: "quad",
        transform
    };
}
/**
 * Returns the circle (ellipse) that would be placed if the mouse were released after dragging a certain line on the screen.
 * The sphere is that which would fill the axis-aligned bounding box of which the drawn line is the diagonal.
 */
function computePreviewCircle(placementStart, mousePos) {
    const endWorld = mat3_mul_vec(state.cameraInverseTransform, mousePos);
    const startWorld = placementStart;
    const width = Math.abs(endWorld.x - startWorld.x);
    const height = Math.abs(endWorld.y - startWorld.y);
    const centre = vec_div(vec_add(startWorld, endWorld), 2);
    const transform = new Transform();
    transform.scale(width, height);
    transform.translate(centre.x, centre.y);
    return {
        type: "circle",
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
function rayIntersectShape(ray, shape) {
    // Transform the ray into the shape's local space.
    const r = transformRay(ray, shape.transform);
    switch (shape.type) {
        case "circle":
            return rayIntersectCircle(r);
        case "quad":
            return rayIntersectQuad(r, shape);
    }
}
function rayIntersectCircle(ray) {
    const sphereToRay = vec_sub(ray.start, newPoint(0, 0)); // Effectively just sets w = 0
    const a = vec_magnitude_sq(ray.direction);
    const b = 2 * vec_dot(ray.start, ray.direction);
    const c = vec_magnitude_sq(sphereToRay) - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
        return [];
    }
    const rootDisc = Math.sqrt(disc);
    const tlo = (-b - rootDisc) / (2 * a);
    const thi = (-b + rootDisc) / (2 * a);
    return [tlo, thi];
}
function rayIntersectQuad(ray, segment) {
    // NOTE: Currently actually the intersection logic for a line segment
    // In the segment's local space, it's a horizontal line of length 2 centred at the origin.
    // So we need to find the distance along the ray at which it intersects the x axis.
    if (ray.direction.x == 0) {
        return [];
    }
    const t = (-ray.start.y / ray.direction.y);
    const x = ray.start.x + t * ray.direction.x;
    // ray may have missed the segment
    if (Math.abs(x) > 1) {
        return [];
    }
    return [t];
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
