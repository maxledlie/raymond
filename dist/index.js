import { vec_add, vec_sub, vec_mul, vec_normalize, translation, mat3_mul_mat, mat3_mul_vec, mat3_inverse, scale, mat3_identity, mat3_chain, newPoint, newVector, vec_div, vec_dot } from "./math.js";
import { Quad, Circle } from "./shapes.js";
import Transform from "./transform.js";
const tools = [
    { type: "laser", name: "Laser", hotkey: "l" },
    { type: "circle", name: "Circle", hotkey: "c" },
    { type: "quad", name: "Quad", hotkey: "q" },
    { type: "pan", name: "Pan", hotkey: "p" },
    { type: "select", name: "Select", hotkey: "s" }
];
const state = {
    lastMousePos: newPoint(0, 0),
    placementStart: null,
    panStart: null,
    tool: "laser",
    lasers: [],
    shapes: [],
    selectedShapeIndex: null,
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
    // Draw preview entities
    let previewLaser = null;
    let previewShape = null;
    if (state.placementStart) {
        const mouse = newPoint(p.mouseX, p.mouseY);
        if (state.tool == "laser") {
            previewLaser = computePreviewLaser(state.placementStart, mouse);
        }
        else if (state.tool == "quad") {
            previewShape = computePreviewQuad(state.placementStart, mouse);
        }
        else if (state.tool == "circle") {
            previewShape = computePreviewCircle(state.placementStart, mouse);
        }
    }
    const lasers = [...state.lasers];
    if (previewLaser) {
        lasers.push(previewLaser);
    }
    const shapes = [...state.shapes];
    if (previewShape) {
        shapes.push(previewShape);
    }
    // Draw lasers including preview laser
    for (const laser of lasers) {
        const hovered = hitTestLaser(laser, newPoint(p.mouseX, p.mouseY));
        drawLaser(p, laser, hovered);
    }
    // Draw shapes including preview shape
    for (const [i, shape] of shapes.entries()) {
        const hovered = hitTestShape(shape, newPoint(p.mouseX, p.mouseY));
        drawShape(p, shape, hovered, i === state.selectedShapeIndex);
    }
    // Work out the segments to actually draw
    const segments = [];
    for (const laser of lasers) {
        const fullDir = vec_sub(laser.transform.apply(newPoint(1, 0)), laser.transform.apply(newPoint(0, 0)));
        let ray = {
            start: laser.transform.apply(newPoint(0, 0)),
            direction: vec_normalize(fullDir)
        };
        for (let iReflect = 0; iReflect < 100; iReflect++) {
            const intersections = shapes.flatMap(shape => shape.intersect(ray).map(t => ({ t, shape })));
            const hit = findHit(intersections);
            if (!hit) {
                // No intersection: Find end point of line very far along the direction from mouse start to mouse end
                segments.push({ start: ray.start, end: pointOnRay(ray, 10000) });
                break;
            }
            const hitPoint = pointOnRay(ray, hit.t);
            const normalv = hit.shape.normalAt(hitPoint);
            const reflectv = reflect(ray.direction, normalv);
            const overPoint = vec_add(hitPoint, vec_mul(normalv, 0.001));
            segments.push({ start: ray.start, end: hitPoint });
            ray = {
                start: overPoint,
                direction: reflectv
            };
        }
    }
    p.stroke("yellow");
    for (const segment of segments) {
        drawLine(p, segment.start, segment.end);
    }
    state.lastMousePos = mouseScreen;
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
/** The "hit" is the intersection with smallest non-negative t-value
 *  TODO: Keep intersection list sorted while inserting to optimise.
 **/
function findHit(intersections) {
    var _a;
    const sorted = intersections.sort((a, b) => a.t - b.t);
    return (_a = sorted.find(x => x.t >= 0)) !== null && _a !== void 0 ? _a : null;
}
function reflect(inVec, normal) {
    return vec_sub(inVec, vec_mul(normal, 2 * vec_dot(inVec, normal)));
}
function drawShape(p, shape, hovered, selected) {
    // TODO: Should this be made an abstract method of the `Shape` class?
    if (selected) {
        p.strokeWeight(2);
        p.stroke("white");
    }
    else {
        p.noStroke();
    }
    switch (shape.type()) {
        case "quad":
            drawQuad(p, shape, hovered);
            break;
        case "circle":
            drawCircle(p, shape, hovered);
            break;
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
    p.stroke(1);
}
function drawQuad(p, quad, hovered) {
    if (hovered) {
        const majorColor = p.color(100, 100, 255, 255);
        const minorColor = p.color(100, 100, 255, 200);
        drawCoordinates(p, quad.transform, majorColor, minorColor, 2);
    }
    p.fill("lightblue");
    const topLeftWorld = quad.transform.apply(newPoint(-1, 1));
    const bottomRightWorld = quad.transform.apply(newPoint(1, -1));
    const topLeftScreen = mat3_mul_vec(state.cameraTransform, topLeftWorld);
    const bottomRightScreen = mat3_mul_vec(state.cameraTransform, bottomRightWorld);
    p.rect(topLeftScreen.x, topLeftScreen.y, bottomRightScreen.x - topLeftScreen.x, bottomRightScreen.y - topLeftScreen.y);
}
function drawCircle(p, circle, hovered) {
    if (hovered) {
        const majorColor = p.color(100, 100, 255, 255);
        const minorColor = p.color(100, 100, 255, 200);
        drawCoordinates(p, circle.transform, majorColor, minorColor, 2);
    }
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
    const mouseScreen = newPoint(p.mouseX, p.mouseY);
    const mouseWorld = mat3_mul_vec(state.cameraInverseTransform, mouseScreen);
    if (e.button === 0) {
        if (state.tool === "select") {
            // Select the most-recently-placed object that we are currently hovering over
            let selectionIndex = -1;
            for (let i = state.shapes.length - 1; i >= 0; i--) {
                if (state.shapes[i].hitTest(mouseWorld)) {
                    selectionIndex = i;
                }
            }
            if (selectionIndex >= 0) {
                console.log(`Selected shape ${selectionIndex}`);
                state.selectedShapeIndex = selectionIndex;
            }
        }
        else {
            state.placementStart = mat3_mul_vec(state.cameraInverseTransform, mouseScreen);
        }
    }
    if (e.button === 1 || state.tool === "pan") {
        state.panStart = mouseScreen;
    }
}
function p5_key_pressed(p) {
    if (p.keyCode === p.DELETE && state.selectedShapeIndex != null) {
        state.shapes.splice(state.selectedShapeIndex, 1);
        state.selectedShapeIndex = null;
    }
    for (const tool of tools) {
        if (p.key == tool.hotkey || p.key == tool.hotkey.toUpperCase()) {
            state.tool = tool.type;
        }
    }
}
/** Returns true if clicking at the given world point should highlight the entity */
function hitTestShape(shape, mouseVec) {
    const worldPoint = mat3_mul_vec(state.cameraInverseTransform, mouseVec);
    return shape.hitTest(worldPoint);
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
function p5_mouse_released(p, e) {
    if (e.button == 0) {
        if (state.placementStart) {
            if (state.tool == "laser") {
                const newLaser = computePreviewLaser(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.lasers.push(newLaser);
            }
            else if (state.tool == "quad") {
                const newQuad = computePreviewQuad(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.shapes.push(newQuad);
            }
            else if (state.tool == "circle") {
                const newCircle = computePreviewCircle(state.placementStart, newPoint(p.mouseX, p.mouseY));
                state.shapes.push(newCircle);
            }
        }
        state.placementStart = null;
    }
    if (e.button == 1 || state.tool == "pan") {
        state.panStart = null;
    }
}
/**
 * Returns the quad that would be placed if the mouse were released after dragging a certain line on the screen.
 * The quad is that which would fill the axis-aligned bounding box of which the drawn line is the diagonal.
 **/
function computePreviewQuad(placementStart, mousePos) {
    const endWorld = mat3_mul_vec(state.cameraInverseTransform, mousePos);
    const startWorld = placementStart;
    const width = Math.abs(endWorld.x - startWorld.x);
    const height = Math.abs(endWorld.y - startWorld.y);
    const centre = vec_div(vec_add(startWorld, endWorld), 2);
    const transform = new Transform();
    transform.scale(width, height);
    transform.translate(centre.x, centre.y);
    return new Quad(transform);
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
    return new Circle(transform);
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
new p5(s);
