import Camera from "./camera.js";
import { Vec3, vec_add, vec_sub, vec_mul, vec_normalize, newPoint, newVector, vec_div, vec_dot, vec_magnitude, rotation, scale } from "./math.js";
import { Shape, Intersection, Quad, Circle } from "./shapes.js";
import Transform from "./transform.js";
import { Ray, Laser } from "./types.js";


type ToolType = "laser" | "quad" | "circle" | "pan" | "select";

interface Tool { 
    type: ToolType;
    hotkey: string;
    name: string;
}

const tools: Tool[] = [
    { type: "laser", name: "Laser", hotkey: "l" },
    { type: "circle", name: "Circle", hotkey: "c" },
    { type: "quad", name: "Quad", hotkey: "q" },
    { type: "pan", name: "Pan", hotkey: "p" },
    { type: "select", name: "Select", hotkey: "s" }
];

interface RaySegment {
    start: Vec3;
    end: Vec3;
}

type HandleAction = "scale" | "rotate";

interface Handle {
    position: Vec3;
    action: HandleAction;
}

interface State {
    debug: boolean;
    lastMousePos: Vec3;
    isMouseDown: boolean;
    placementStartWorld: Vec3 | null;
    panStart: Vec3 | null;
    tool: ToolType;
    lasers: Laser[];
    shapes: Shape[];
    /** Which shape is currently selected, if any? */
    selectedShapeIndex: number | null;
    /** Is the currently selected shape being dragged? */
    shapeDragged: boolean;
    /** Which `handle` of the currently selected shape is being interacted with? By convention, 0 is the rotation handle, 1-8 the scale handles. */
    activeHandleIndex: number | null;
    camera: Camera;
    mousePosScreen: Vec3;
}


const state: State = {
    debug: false,
    lastMousePos: newPoint(0, 0),
    isMouseDown: false,
    placementStartWorld: null,
    panStart: null,
    tool: "laser",
    lasers: [],
    shapes: [],
    selectedShapeIndex: null,
    shapeDragged: false,
    activeHandleIndex: null,
    camera: new Camera(1, 1),  // We don't know the screen width and height yet.
    mousePosScreen: newPoint(0, 0)
};

const FRAMERATE = 60;


/** Draws a line described in world space using the current camera transform and canvas drawing state */
function drawLine(ctx: CanvasRenderingContext2D, start: Vec3, end: Vec3) {
    const startScreen = state.camera.worldToScreen(start);
    const endScreen = state.camera.worldToScreen(end);
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();
}

function color(r: number, g: number, b: number, a?: number): string {
    if (a == null) {
        return `rgb(${r} ${g} ${b})`;
    } else {
        return `rgb(${r} ${g} ${b} / ${a * 100 / 255}%)`
    }
}

function draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle="black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tool menu
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "14px monospace";
    for (let i = 0; i < tools.length; i++ ) {
        const tool = tools[i];
        const text = (state.tool == tool.type ? "> " : "  ") + tool.name + " (" + tool.hotkey.toUpperCase() + ")";
        ctx.fillText(text, 10, 20 * (i + 1));
    }

    const mouseScreen = state.mousePosScreen;
    const mouseWorld = state.camera.screenToWorld(state.mousePosScreen);

    // Draw status indicators
    ctx.textAlign = "right";
    ctx.fillText(`Debug ${state.debug ? "ON" : "OFF"} (D)`, canvas.width - 10, 20);
    if (state.debug) {
        ctx.fillText(`x: ${mouseWorld.x.toFixed(2)}, y: ${mouseWorld.y.toFixed(2)}`, canvas.width - 10, 40);
    }

    // Handle panning
    if (state.panStart != null) {
        const mouseDelta = vec_sub(mouseScreen, state.lastMousePos);
        state.camera.pan(mouseDelta);
    }

    // Draw coordinate grid
    const minorColor = "rgb(100 100 100 / 30%)";
    const majorColor = "rgb(255 255 255)";
    drawCoordinates(ctx, new Transform(), majorColor, minorColor, 100);

    // Draw preview entities
    let previewLaser = computePreviewLaser();
    let previewShape = computePreviewShape();

    const lasers = [...state.lasers];
    if (previewLaser) {
        lasers.push(previewLaser);
    }
    const shapes: Shape[] = [...state.shapes];
    if (previewShape) {
        shapes.push(previewShape);
    }

    // Draw lasers including preview laser
    for (const laser of lasers) {
        const hovered = hitTestLaser(laser, state.mousePosScreen);
        drawLaser(ctx, laser, hovered);
    }

    // Draw shapes including preview shape
    for (const [i, shape] of shapes.entries()) {
        const hovered = hitTestShape(shape, state.mousePosScreen);
        drawShape(ctx, shape, hovered, i === state.selectedShapeIndex);
    }

    // Work out the segments to actually draw
    const segments: RaySegment[] = [];
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
            const reflectv = reflect(ray.direction, normalv)
            const overPoint = vec_add(hitPoint, vec_mul(normalv, 0.001));
            segments.push({ start: ray.start, end: hitPoint });
            ray = {
                start: overPoint,
                direction: reflectv
            };
        }
    }

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 1.5;  // For some reason, a lineWidth of 1 or smaller causes the line to sometimes disappear.
    for (const segment of segments) {
        drawLine(ctx, segment.start, segment.end);
    }

    state.lastMousePos = mouseScreen;
    setTimeout(() => draw(canvas, ctx), 1000 / FRAMERATE);
}

function pointOnRay(ray: Ray, t: number): Vec3 {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}

/** The "hit" is the intersection with smallest non-negative t-value
 *  TODO: Keep intersection list sorted while inserting to optimise.
 **/
function findHit(intersections: Intersection[]): Intersection | null {
    const sorted = intersections.sort((a, b) => a.t - b.t);
    return sorted.find(x => x.t >= 0) ?? null;
}

function reflect(inVec: Vec3, normal: Vec3) {
    return vec_sub(inVec, vec_mul(normal, 2 * vec_dot(inVec, normal)))
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, hovered: boolean, selected: boolean) {
    // TODO: Should this be made an abstract method of the `Shape` class?

    // Draw actual shape
    ctx.strokeStyle = "white";
    ctx.lineWidth = selected ? 5 : 0;
    switch (shape.type()) {
        case "quad":
            drawQuad(ctx, shape as Quad, hovered, true);
            break;
        case "circle":
            drawCircle(ctx, shape as Circle, hovered);
            break;
    }

    // Draw annotations if selected
    if (selected) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        drawQuad(ctx, shape as Quad, false, false);

        const { rotation, scale } = computeHandles(shape);

        ctx.beginPath();
        ctx.moveTo(rotation.position.x, rotation.position.y);
        ctx.lineTo(rotation.position.x, rotation.position.y);
        ctx.stroke();
        ctx.strokeStyle = "black";
        for (const [i, p] of scale.entries()) {
            ctx.fillStyle = state.activeHandleIndex === i + 1 ? "green" : "white";
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        ctx.fillStyle = state.activeHandleIndex === 0 ? "green" : "white";
        ctx.beginPath();
        ctx.arc(rotation.position.x, rotation.position.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
}

/**
 * Returns the handles that should be drawn around the given shape, assuming it's selected
 */
function computeHandles(shape: Shape): { rotation: Handle, scale: Handle[] } {
    // Handles at each vertex and at the center of each line of the bounding box
    const handlesLocal = [
        newPoint(-1, 1),
        newPoint(0, 1),
        newPoint(1, 1),
        newPoint(1, 0),
        newPoint(1, -1),
        newPoint(0, -1),
        newPoint(-1, -1),
        newPoint(-1, 0)
    ];

    const scaleHandlesPos = handlesLocal.map(x => state.camera.worldToScreen(shape.transform.apply(x)));

    const centreScreen = state.camera.worldToScreen(shape.transform.apply(newPoint(0, 0)));
    const topScreen = state.camera.worldToScreen(shape.transform.apply(newPoint(0, 1)));
    const d = vec_normalize(vec_sub(topScreen, centreScreen));
    const rotationHandlePos = vec_add(topScreen, vec_mul(d, 30));

    const scale: Handle[] = scaleHandlesPos.map(x => ({ position: x, action: "scale" }));
    const rotation: Handle = { position: rotationHandlePos, action: "rotate" };
    return { rotation, scale };
}


function drawLaser(ctx: CanvasRenderingContext2D, laser: Laser, hovered: boolean) {
    // Drawing the apparatus as a polygon is probably suboptimal.
    // Maybe I should transform the canvas and use p.rect?
    const topLeft = newPoint(-0.4, -0.1);
    const topRight = newPoint(0, -0.1);
    const bottomRight = newPoint(0, 0.1);
    const bottomLeft = newPoint(-0.4, 0.1);

    if (hovered && state.debug) {
        // Draw local coordinate system of laser
        const minorColor = color(0, 100, 0, 100);
        const majorColor = color(0, 255, 0, 255);
        drawCoordinates(ctx, laser.transform, majorColor, minorColor, 2);
    }

    const points = [topLeft, topRight, bottomRight, bottomLeft].map(p => {
        const world = laser.transform.apply(p);
        return state.camera.worldToScreen(world);
    });

    ctx.lineWidth = 0;
    ctx.fillStyle = hovered ? "green" : "white";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) {
        ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawQuad(ctx: CanvasRenderingContext2D, quad: Quad, hovered: boolean, fill: boolean) {
    if (hovered && state.debug) {
        const majorColor = color(100, 100, 255, 255);
        const minorColor = color(100, 100, 255, 200);
        drawCoordinates(ctx, quad.transform, majorColor, minorColor, 2);
    }

    ctx.fillStyle = "lightblue";
    const points = [];
    for (const local of [newPoint(-1, 1), newPoint(1, 1), newPoint(1, -1), newPoint(-1, -1)]) {
        const world = quad.transform.apply(local);
        const screen = state.camera.worldToScreen(world);
        points.push(screen);
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, circle: Circle, hovered: boolean) {
    if (hovered && state.debug) {
        const majorColor = color(100, 100, 255, 255);
        const minorColor = color(100, 100, 255, 200);
        drawCoordinates(ctx, circle.transform, majorColor, minorColor, 2);
    }

    ctx.fillStyle = "lightblue";
    const centre = state.camera.worldToScreen(circle.transform.apply(newPoint(0, 0)));
    const radius = state.camera.worldToScreen(circle.transform._scale);
    
    // TODO: Subtract camera rotation once this is supported
    const rotation = circle.transform._rotation;

    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, Math.abs(radius.x), Math.abs(radius.y), -rotation, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
}

/**
 * Given a `transform` that maps points from one space to another, draws the coordinates
 * of this new space.
 */
function drawCoordinates(ctx: CanvasRenderingContext2D, transform: Transform, majorColor: string, minorColor: string, gridSize: number) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = minorColor;
    for (let i = -gridSize; i <= gridSize; i++) {
        const xStartWorld = transform.apply(newPoint(i, -gridSize));
        const xEndWorld = transform.apply(newPoint(i, gridSize));
        drawLine(ctx, xStartWorld, xEndWorld);

        const yStartWorld = transform.apply(newPoint(-gridSize, i));
        const yEndWorld = transform.apply(newPoint(gridSize, i));
        drawLine(ctx, yStartWorld, yEndWorld);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = majorColor;
    const xAxisEndLocal = newPoint(gridSize, 0);
    const yAxisEndLocal = newPoint(0, gridSize);
    const yAxisStartWorld = transform.apply(newPoint(0, -gridSize));
    const yAxisEndWorld = transform.apply(yAxisEndLocal);
    const xAxisStartWorld = transform.apply(newPoint(-gridSize, 0));
    const xAxisEndWorld = transform.apply(xAxisEndLocal);
    drawLine(ctx, yAxisStartWorld, yAxisEndWorld);
    drawLine(ctx, xAxisStartWorld, xAxisEndWorld);

    // Arrow heads indicating direction of axes
    const yAxisLeftLocal = vec_add(yAxisEndLocal, newVector(-0.1, -0.1));
    const yAxisRightLocal = vec_add(yAxisEndLocal, newVector(0.1, -0.1));
    const yAxisLeftWorld = transform.apply(yAxisLeftLocal);
    const yAxisRightWorld = transform.apply(yAxisRightLocal);
    drawLine(ctx, yAxisEndWorld, yAxisLeftWorld);
    drawLine(ctx, yAxisEndWorld, yAxisRightWorld);

    const xAxisLeftLocal = vec_add(xAxisEndLocal, newVector(-0.1, 0.1));
    const xAxisRightLocal = vec_add(xAxisEndLocal, newVector(-0.1, -0.1));
    const xAxisLeftWorld = transform.apply(xAxisLeftLocal);
    const xAxisRightWorld = transform.apply(xAxisRightLocal);
    drawLine(ctx, xAxisEndWorld, xAxisLeftWorld);
    drawLine(ctx, xAxisEndWorld, xAxisRightWorld);
}

function handleMouseDown(e: MouseEvent) {
    if (e.button === 0) {
        state.isMouseDown = true;
    }

    const mouseScreen = state.mousePosScreen;
    const mouseWorld = state.camera.screenToWorld(mouseScreen);

    if (e.button === 0) {
        if (state.tool === "select") {
            // Activate a handle if one is hovered
            if (state.selectedShapeIndex != null) {
                const selectedShape = state.shapes[state.selectedShapeIndex];
                const { rotation, scale } = computeHandles(selectedShape);
                for (const [index, handle] of [rotation, ...scale].entries()) {
                    if (vec_magnitude(vec_sub(handle.position, mouseScreen)) < 10) {
                        state.activeHandleIndex = index;
                        break;
                    }
                }
            }

            // Select the most-recently-placed object that we are currently hovering over
            let selectionIndex = -1;
            for (let i = state.shapes.length - 1; i >= 0; i--) {
                if (state.shapes[i].hitTest(mouseWorld)) {
                    selectionIndex = i;
                }
            }
            if (selectionIndex >= 0) {
                state.selectedShapeIndex = selectionIndex;
                state.shapeDragged = true;
            }
        } else {
            state.placementStartWorld = mouseWorld;
        }
    }
    if (e.button === 1 || state.tool === "pan") {
        state.panStart = mouseScreen;
    }
}

function handleKeyDown(e: KeyboardEvent) {
    if (e.key.toUpperCase() === "D") {
        state.debug = !state.debug;
    }
    if (e.key === "Delete" && state.selectedShapeIndex != null) {
        state.shapes.splice(state.selectedShapeIndex, 1);
        state.selectedShapeIndex = null;
    }
    for (const tool of tools) {
        if (e.key.toUpperCase() === tool.hotkey.toUpperCase())  {
            state.tool = tool.type;
        }
    }
}

/** Returns true if clicking at the given world point should highlight the entity */
function hitTestShape(shape: Shape, mouseVec: Vec3): boolean {
    const worldPoint = state.camera.screenToWorld(mouseVec);
    return shape.hitTest(worldPoint);
}

function hitTestLaser(laser: Laser, screenPoint: Vec3) {
    // Transform point from screen to world to local space
    const world = state.camera.screenToWorld(screenPoint);
    const local = laser.transform.applyInverse(world);

    // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
    if (local.x >= -0.4 && local.x <= 0 && local.y >= -0.1 && local.y <= 0.1) {
        return true;
    }
    return false;
}

function handleMouseUp(e: MouseEvent) {
    state.isMouseDown = false;
    state.shapeDragged = false;
    state.activeHandleIndex = null;
    if (e.button === 0) {
        if (state.tool === "laser") {
            const previewLaser = computePreviewLaser();
            state.lasers.push(previewLaser);
        } else {
            const previewShape = computePreviewShape();
            if (previewShape) {
                state.shapes.push(previewShape);
            }
        }
        state.placementStartWorld = null;
    }
    if (e.button == 1 || state.tool == "pan") {
        state.panStart = null;
    }
}

function computePreviewShape(): Shape | null {
    if (!state.placementStartWorld) {
        return null;
    }

    // Don't allow placing teeny tiny objects
    const placementStartScreen = state.camera.worldToScreen(state.placementStartWorld);
    if (vec_magnitude(vec_sub(placementStartScreen, state.mousePosScreen)) < 5) {
        return null;
    }

    switch (state.tool) {
        case "quad":
            return computePreviewQuad(state.placementStartWorld);
        case "circle":
            return computePreviewCircle(state.placementStartWorld);
    }
    return null;
}

/** 
 * Returns the quad that would be placed if the mouse were released after dragging a certain line on the screen.
 * The quad is that which would fill the axis-aligned bounding box of which the drawn line is the diagonal.
 **/ 
function computePreviewQuad(placementStart: Vec3): Shape | null {
    const endWorld = state.camera.screenToWorld(state.mousePosScreen);
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
function computePreviewCircle(placementStart: Vec3): Circle | null {
    const endWorld = state.camera.screenToWorld(state.mousePosScreen);
    const startWorld = placementStart;

    const width = Math.abs(endWorld.x - startWorld.x);
    const height = Math.abs(endWorld.y - startWorld.y);

    if (Math.min(width, height) === 0) {
        return null;
    }

    const centre = vec_div(vec_add(startWorld, endWorld), 2);
    const transform = new Transform();
    transform.scale(width, height);
    transform.translate(centre.x, centre.y);
    return new Circle(transform);
}

function computePreviewLaser(): Laser | null {
    if (state.placementStartWorld == null || state.tool !== "laser") {
        return null;
    }
    const end = state.camera.screenToWorld(state.mousePosScreen);
    const dir = vec_sub(end, state.placementStartWorld);
    const theta = Math.atan2(dir.y, dir.x);
    const transform = new Transform();
    transform.rotate(theta);
    transform.translate(state.placementStartWorld.x, state.placementStartWorld.y);
    return {
        type: "laser",
        transform
    };
}

function handleScroll(e: WheelEvent) {
    const zoomSpeed = 0.0001
    const zoomFrac = zoomSpeed * e.deltaY;
    state.camera.zoom(zoomFrac, state.mousePosScreen);
}

function handleResize(canvas: HTMLCanvasElement) {
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;
    state.camera = new Camera(canvas.width, canvas.height);
}

function handleMouseMove(e: MouseEvent) {
    // Track mouse position
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    state.mousePosScreen = newPoint(x, y);

    // Rotate or scale shape if dragging a handle
    if (state.selectedShapeIndex != null && state.activeHandleIndex == 0) {
        // We are rotating the shape. The centre of the shape, top of the shape, and mouse position should be collinear.
        const shape = state.shapes[state.selectedShapeIndex];
        const shapeCentreWorld = shape.transform.apply(newPoint(0, 0));
        const mouseWorld = state.camera.screenToWorld(state.mousePosScreen);
        const d = vec_sub(mouseWorld, shapeCentreWorld);
        const theta = Math.atan2(d.y, d.x);
        shape.transform._rotation = theta - Math.PI / 2;
    }

    // Drag selected shape
    if (
        state.isMouseDown &&
        state.tool === "select" &&
        state.selectedShapeIndex != null &&
        state.shapes.length > state.selectedShapeIndex &&
        state.shapeDragged
    ) {
        const selectedShape = state.shapes[state.selectedShapeIndex];

        const dragEndScreen = newPoint(e.offsetX, e.offsetY);
        const dragMovementScreen = newVector(e.movementX, e.movementY);
        const dragStartScreen = vec_sub(dragEndScreen, dragMovementScreen);
        const dragEndWorld = state.camera.screenToWorld(dragEndScreen);
        const dragStartWorld = state.camera.screenToWorld(dragStartScreen);
        const dragDelta = vec_sub(dragEndWorld, dragStartWorld);
        selectedShape.transform.translate(dragDelta.x, dragDelta.y);
    }
}

// Get HTML canvas to draw on
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

// Set canvas coordinates equal to pixel coordinates, and do this again on each resize.
canvas.onresize = () => handleResize(canvas);
handleResize(canvas);

canvas.onmousemove = (e: MouseEvent) => handleMouseMove(e);
canvas.onmousedown = (e: MouseEvent) => handleMouseDown(e);
canvas.onmouseup = (e: MouseEvent) => handleMouseUp(e);
canvas.onwheel = (e: WheelEvent) => handleScroll(e);
canvas.onkeydown = (e: KeyboardEvent) => handleKeyDown(e);

draw(canvas, ctx);
