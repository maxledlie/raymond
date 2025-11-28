import Camera from "../camera.js";
import {
    type Vec3,
    vec_add,
    vec_sub,
    vec_mul,
    vec_normalize,
    newPoint,
    newVector,
    vec_div,
    vec_dot,
    vec_magnitude,
    mat3_mul_mat,
    mat3_identity,
} from "../math.js";
import { Shape, type Intersection, Quad, Circle } from "../shapes.js";
import {
    type Transform,
    apply,
    interp,
    inverse,
    fromObjectTransform,
    toObjectTransform,
    transformObject,
    translateObject,
} from "../transform.js";
import type { Ray, Laser } from "../types.js";
import { Canvas } from "./canvas.js";

type ToolType = "laser" | "quad" | "circle" | "pan" | "select";

const FRAME_RATE = 60;

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
    { type: "select", name: "Select", hotkey: "s" },
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

interface Animation {
    from: Transform;
    to: Transform;
    time: number;
    end: number;
}

interface State {
    debug: boolean;
    camera: Camera;
    tool: ToolType;
    shapes: Shape[];
    selectedShapeIndex: number | null;
    lastMousePos: Vec3;
    isMouseDown: boolean;
    placementStartWorld: Vec3 | null;
    panStart: Vec3 | null;
    mousePosScreen: Vec3;
    lasers: Laser[];
    /** Is the currently selected shape being dragged? */
    shapeDragged: boolean;
    /** Which `handle` of the currently selected shape is being interacted with? By convention, 0 is the rotation handle, 1-8 the scale handles. */
    activeHandleIndex: number | null;
    cameraPath: Animation | null;
}

function defaultState(): State {
    return {
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
        camera: new Camera(1, 1), // We don't know the screen width and height yet.
        mousePosScreen: newPoint(0, 0),
        cameraPath: null,
    };
}

export class RaymondCanvas extends Canvas {
    state: State = defaultState();

    setup() {
        this.state.camera = new Camera(this.width, this.height);
    }

    keyPressed(e: KeyboardEvent): void {
        const { state } = this;
        if (e.key.toUpperCase() === "D") {
            state.debug = !state.debug;
        }
        if (e.key === "Delete" && state.selectedShapeIndex != null) {
            state.shapes.splice(state.selectedShapeIndex, 1);
            state.selectedShapeIndex = null;
        }
        for (const tool of tools) {
            if (e.key.toUpperCase() === tool.hotkey.toUpperCase()) {
                state.tool = tool.type;
            }
        }
    }

    mousePressed(e: MouseEvent): void {
        const { state } = this;
        if (e.button === 0) {
            state.isMouseDown = true;
        }

        const mouseScreen = newPoint(this.mouseX, this.mouseY);
        const mouseWorld = state.camera.screenToWorld(mouseScreen);

        if (e.button === 0) {
            if (state.tool === "select") {
                // Activate a handle if one is hovered
                if (state.selectedShapeIndex != null) {
                    const selectedShape =
                        state.shapes[state.selectedShapeIndex];
                    const { rotation, scale } = this.computeHandles(
                        state,
                        selectedShape
                    );
                    for (const [index, handle] of [
                        rotation,
                        ...scale,
                    ].entries()) {
                        if (
                            vec_magnitude(
                                vec_sub(handle.position, mouseScreen)
                            ) < 10
                        ) {
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
            console.log("pan start");
            state.panStart = mouseScreen;
        }
    }

    mouseWheel(e: WheelEvent): void {
        console.log("wheel event: ", e);
        const { state } = this;
        const zoomSpeed = 0.0001;
        const zoomFrac = zoomSpeed * e.deltaY;
        state.camera.zoom(zoomFrac, state.mousePosScreen);
    }

    mouseReleased(e: MouseEvent): void {
        const { state } = this;
        state.isMouseDown = false;
        state.shapeDragged = false;
        state.activeHandleIndex = null;
        if (e.button === 0) {
            if (state.tool === "laser") {
                const previewLaser = this.computePreviewLaser();
                if (previewLaser) {
                    state.lasers.push(previewLaser);
                }
            } else {
                const previewShape = this.computePreviewShape();
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

    mouseMoved(e: MouseEvent): void {
        const { state } = this;

        state.mousePosScreen = newPoint(this.mouseX, this.mouseY);

        // Rotate or scale shape if dragging a handle
        if (state.selectedShapeIndex != null && state.activeHandleIndex == 0) {
            // We are rotating the shape. The centre of the shape, top of the shape, and mouse position should be collinear.
            const shape = state.shapes[state.selectedShapeIndex];
            const shapeCentreWorld = apply(shape.transform, newPoint(0, 0));
            const mouseWorld = state.camera.screenToWorld(state.mousePosScreen);
            const d = vec_sub(mouseWorld, shapeCentreWorld);
            const theta = Math.atan2(d.y, d.x);
            shape.transform = transformObject(shape.transform, (o) => ({
                ...o,
                rotation: theta - Math.PI / 2,
            }));
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
            selectedShape.transform = translateObject(
                selectedShape.transform,
                dragDelta
            );
        }
    }

    doubleClicked() {
        const { state } = this;
        const shape = state.shapes[state.selectedShapeIndex ?? -1];

        if (shape) {
            // Position the camera such that the shape's bounding box appears to be a unit square at the center of the screen
            const centerWorld = apply(shape.transform, newPoint(0, 0));

            const aspectRatio = this.width / this.height;
            const worldSize = apply(shape.transform, newVector(aspectRatio, 1));

            const o = toObjectTransform(shape.transform);

            // HACK: Work out the transform for a camera at the desired orientation
            const c = new Camera(this.width, this.height);
            c.setSetup({
                ...state.camera.getSetup(),
                center: centerWorld,
                rotation: -o.rotation,
                size: vec_mul(worldSize, 5),
            });

            // TODO: This is just an awkward way of copying. Remove once Transform is no longer a class.
            const from = fromObjectTransform(
                toObjectTransform(state.camera.transform)
            );
            state.cameraPath = { from, to: c.transform, time: 0, end: 1.5 };
        }
    }

    smoothstep(x: number): number {
        return 3 * Math.pow(x, 2) - 2 * Math.pow(x, 3);
    }

    draw() {
        const { ctx, width, height, state } = this;

        // Update camera path if active
        if (state.cameraPath) {
            const path = state.cameraPath;
            if (path.time >= path.end) {
                state.cameraPath = null;
            } else {
                path.time += 1 / FRAME_RATE;
                const frac = path.time / path.end;
                const smoothX = this.smoothstep(frac);
                state.camera.transform = interp(path.from, path.to, smoothX);
            }
        }

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // Draw tool menu
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "14px monospace";
        for (let i = 0; i < tools.length; i++) {
            const tool = tools[i];
            const text =
                (state.tool == tool.type ? "> " : "  ") +
                tool.name +
                " (" +
                tool.hotkey.toUpperCase() +
                ")";
            ctx.fillText(text, 10, 20 * (i + 1));
        }

        const mouseScreen = newPoint(this.mouseX, this.mouseY);
        const mouseWorld = state.camera.screenToWorld(state.mousePosScreen);

        // Draw status indicators
        ctx.textAlign = "right";
        ctx.fillText(`Debug ${state.debug ? "ON" : "OFF"} (D)`, width - 10, 20);
        if (state.debug) {
            ctx.fillText(
                `World: x: ${mouseWorld.x.toFixed(
                    2
                )}, y: ${mouseWorld.y.toFixed(2)}`,
                width - 10,
                40
            );
            ctx.fillText(
                `Screen: x: ${mouseScreen.x.toFixed(
                    2
                )}, y: ${mouseScreen.y.toFixed(2)}`,
                width - 10,
                60
            );
        }

        // Handle panning
        if (state.panStart != null) {
            const mouseDelta = vec_sub(mouseScreen, state.lastMousePos);
            state.camera.pan(mouseDelta);
        }

        // Draw coordinate grid
        const minorColor = "rgb(100 100 100 / 30%)";
        const majorColor = "rgb(255 255 255)";
        this.drawCoordinates(mat3_identity(), majorColor, minorColor, 100);

        // Draw preview entities
        let previewLaser = this.computePreviewLaser();
        let previewShape = this.computePreviewShape();

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
            const hovered = this.hitTestLaser(laser, state.mousePosScreen);
            this.drawLaser(ctx, laser, hovered);
        }

        // Draw shapes including preview shape
        for (const [i, shape] of shapes.entries()) {
            const hovered = this.hitTestShape(shape, state.mousePosScreen);
            this.drawShape(ctx, shape, hovered, i === state.selectedShapeIndex);
        }

        // Work out the segments to actually draw
        const segments: RaySegment[] = [];
        for (const laser of lasers) {
            const fullDir = vec_sub(
                apply(laser.transform, newPoint(1, 0)),
                apply(laser.transform, newPoint(0, 0))
            );
            let ray = {
                start: apply(laser.transform, newPoint(0, 0)),
                direction: vec_normalize(fullDir),
            };
            for (let iReflect = 0; iReflect < 100; iReflect++) {
                const intersections = shapes.flatMap((shape) =>
                    shape.intersect(ray).map((t) => ({ t, shape }))
                );
                const hit = this.findHit(intersections);
                if (!hit) {
                    // No intersection: Find end point of line very far along the direction from mouse start to mouse end
                    segments.push({
                        start: ray.start,
                        end: this.pointOnRay(ray, 10000),
                    });
                    break;
                }
                const hitPoint = this.pointOnRay(ray, hit.t);
                const normalv = hit.shape.normalAt(hitPoint);
                const reflectv = this.reflect(ray.direction, normalv);
                const overPoint = vec_add(hitPoint, vec_mul(normalv, 0.001));
                segments.push({ start: ray.start, end: hitPoint });
                ray = {
                    start: overPoint,
                    direction: reflectv,
                };
            }
        }

        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 1.5; // For some reason, a lineWidth of 1 or smaller causes the line to sometimes disappear.
        for (const segment of segments) {
            this.drawLine(segment.start, segment.end);
        }

        state.lastMousePos = mouseScreen;
    }

    /** Draws a line described in world space using the current camera transform and canvas drawing state */
    drawLine(start: Vec3, end: Vec3) {
        const { state, ctx } = this;
        const startScreen = state.camera.worldToScreen(start);
        const endScreen = state.camera.worldToScreen(end);
        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(endScreen.x, endScreen.y);
        ctx.stroke();
    }

    color(r: number, g: number, b: number, a?: number): string {
        if (a == null) {
            return `rgb(${r} ${g} ${b})`;
        } else {
            return `rgb(${r} ${g} ${b} / ${(a * 100) / 255}%)`;
        }
    }

    pointOnRay(ray: Ray, t: number): Vec3 {
        return vec_add(ray.start, vec_mul(ray.direction, t));
    }

    /** The "hit" is the intersection with smallest non-negative t-value
     *  TODO: Keep intersection list sorted while inserting to optimise.
     **/
    findHit(intersections: Intersection[]): Intersection | null {
        const sorted = intersections.sort((a, b) => a.t - b.t);
        return sorted.find((x) => x.t >= 0) ?? null;
    }

    reflect(inVec: Vec3, normal: Vec3) {
        return vec_sub(inVec, vec_mul(normal, 2 * vec_dot(inVec, normal)));
    }

    drawShape(
        ctx: CanvasRenderingContext2D,
        shape: Shape,
        hovered: boolean,
        selected: boolean
    ) {
        // TODO: Should this be made an abstract method of the `Shape` class?

        const { state } = this;

        // Draw actual shape
        ctx.strokeStyle = "white";
        ctx.lineWidth = selected ? 5 : 0;
        switch (shape.type()) {
            case "quad":
                this.drawQuad(shape as Quad, hovered, true);
                break;
            case "circle":
                this.drawCircle(shape as Circle, hovered);
                break;
        }

        // Draw annotations if selected
        if (selected) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            this.drawQuad(shape as Quad, false, false);

            const { rotation, scale } = this.computeHandles(state, shape);

            ctx.beginPath();
            ctx.moveTo(rotation.position.x, rotation.position.y);
            ctx.lineTo(rotation.position.x, rotation.position.y);
            ctx.stroke();
            ctx.strokeStyle = "black";
            for (const [i, p] of scale.entries()) {
                ctx.fillStyle =
                    state.activeHandleIndex === i + 1 ? "green" : "white";
                ctx.beginPath();
                ctx.arc(p.position.x, p.position.y, 5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }

            ctx.fillStyle = state.activeHandleIndex === 0 ? "green" : "white";
            ctx.beginPath();
            ctx.arc(
                rotation.position.x,
                rotation.position.y,
                5,
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * Returns the handles that should be drawn around the given shape, assuming it's selected
     */
    computeHandles(
        state: State,
        shape: Shape
    ): { rotation: Handle; scale: Handle[] } {
        // Handles at each vertex and at the center of each line of the bounding box
        const handlesLocal = [
            newPoint(-1, 1),
            newPoint(0, 1),
            newPoint(1, 1),
            newPoint(1, 0),
            newPoint(1, -1),
            newPoint(0, -1),
            newPoint(-1, -1),
            newPoint(-1, 0),
        ];

        const scaleHandlesPos = handlesLocal.map((x) =>
            state.camera.worldToScreen(apply(shape.transform, x))
        );

        const centreScreen = state.camera.worldToScreen(
            apply(shape.transform, newPoint(0, 0))
        );
        const topScreen = state.camera.worldToScreen(
            apply(shape.transform, newPoint(0, 1))
        );
        const d = vec_normalize(vec_sub(topScreen, centreScreen));
        const rotationHandlePos = vec_add(topScreen, vec_mul(d, 30));

        const scale: Handle[] = scaleHandlesPos.map((x) => ({
            position: x,
            action: "scale",
        }));
        const rotation: Handle = {
            position: rotationHandlePos,
            action: "rotate",
        };
        return { rotation, scale };
    }

    drawLaser(ctx: CanvasRenderingContext2D, laser: Laser, hovered: boolean) {
        const { state } = this;

        // Drawing the apparatus as a polygon is probably suboptimal.
        // Maybe I should transform the canvas and use p.rect?
        const topLeft = newPoint(-0.4, -0.1);
        const topRight = newPoint(0, -0.1);
        const bottomRight = newPoint(0, 0.1);
        const bottomLeft = newPoint(-0.4, 0.1);

        if (hovered && state.debug) {
            // Draw local coordinate system of laser
            const minorColor = this.color(0, 100, 0, 100);
            const majorColor = this.color(0, 255, 0, 255);
            this.drawCoordinates(laser.transform, majorColor, minorColor, 2);
        }

        const points = [topLeft, topRight, bottomRight, bottomLeft].map((p) => {
            const world = apply(laser.transform, p);
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

    drawQuad(quad: Quad, hovered: boolean, fill: boolean) {
        const { state, ctx } = this;
        if (hovered && state.debug) {
            const majorColor = this.color(100, 100, 255, 255);
            const minorColor = this.color(100, 100, 255, 200);
            this.drawCoordinates(quad.transform, majorColor, minorColor, 2);
        }

        ctx.fillStyle = "lightblue";
        const points = [];
        for (const local of [
            newPoint(-1, 1),
            newPoint(1, 1),
            newPoint(1, -1),
            newPoint(-1, -1),
        ]) {
            const world = apply(quad.transform, local);
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

    drawCircle(circle: Circle, hovered: boolean) {
        const { state, ctx } = this;
        if (hovered && state.debug) {
            const majorColor = this.color(100, 100, 255, 255);
            const minorColor = this.color(100, 100, 255, 200);
            this.drawCoordinates(circle.transform, majorColor, minorColor, 2);
        }

        ctx.fillStyle = "lightblue";
        const oldTransform = ctx.getTransform();

        // Get the combination of object and camera transforms
        const mat = mat3_mul_mat(state.camera.transform, circle.transform);
        ctx.setTransform(
            mat[0][0],
            mat[1][0],
            mat[0][1],
            mat[1][1],
            mat[0][2],
            mat[1][2]
        );

        ctx.beginPath();
        ctx.ellipse(0, 0, 1, 1, 0, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.setTransform(oldTransform);
    }

    /**
     * Given a `transform` that maps points from one space to another, draws the coordinates
     * of this new space.
     */
    drawCoordinates(
        transform: Transform,
        majorColor: string,
        minorColor: string,
        gridSize: number
    ) {
        const { ctx } = this;
        ctx.lineWidth = 1;
        ctx.strokeStyle = minorColor;
        for (let i = -gridSize; i <= gridSize; i++) {
            const xStartWorld = apply(transform, newPoint(i, -gridSize));
            const xEndWorld = apply(transform, newPoint(i, gridSize));
            this.drawLine(xStartWorld, xEndWorld);

            const yStartWorld = apply(transform, newPoint(-gridSize, i));
            const yEndWorld = apply(transform, newPoint(gridSize, i));
            this.drawLine(yStartWorld, yEndWorld);
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = majorColor;
        const xAxisEndLocal = newPoint(gridSize, 0);
        const yAxisEndLocal = newPoint(0, gridSize);
        const yAxisStartWorld = apply(transform, newPoint(0, -gridSize));
        const yAxisEndWorld = apply(transform, yAxisEndLocal);
        const xAxisStartWorld = apply(transform, newPoint(-gridSize, 0));
        const xAxisEndWorld = apply(transform, xAxisEndLocal);
        this.drawLine(yAxisStartWorld, yAxisEndWorld);
        this.drawLine(xAxisStartWorld, xAxisEndWorld);

        // Arrow heads indicating direction of axes
        const yAxisLeftLocal = vec_add(yAxisEndLocal, newVector(-0.1, -0.1));
        const yAxisRightLocal = vec_add(yAxisEndLocal, newVector(0.1, -0.1));
        const yAxisLeftWorld = apply(transform, yAxisLeftLocal);
        const yAxisRightWorld = apply(transform, yAxisRightLocal);
        this.drawLine(yAxisEndWorld, yAxisLeftWorld);
        this.drawLine(yAxisEndWorld, yAxisRightWorld);

        const xAxisLeftLocal = vec_add(xAxisEndLocal, newVector(-0.1, 0.1));
        const xAxisRightLocal = vec_add(xAxisEndLocal, newVector(-0.1, -0.1));
        const xAxisLeftWorld = apply(transform, xAxisLeftLocal);
        const xAxisRightWorld = apply(transform, xAxisRightLocal);
        this.drawLine(xAxisEndWorld, xAxisLeftWorld);
        this.drawLine(xAxisEndWorld, xAxisRightWorld);
    }

    /** Returns true if clicking at the given world point should highlight the entity */
    hitTestShape(shape: Shape, mouseVec: Vec3): boolean {
        const { state } = this;
        const worldPoint = state.camera.screenToWorld(mouseVec);
        return shape.hitTest(worldPoint);
    }

    hitTestLaser(laser: Laser, screenPoint: Vec3) {
        const { state } = this;

        // Transform point from screen to world to local space
        const world = state.camera.screenToWorld(screenPoint);
        const local = apply(inverse(laser.transform), world);

        // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
        if (
            local.x >= -0.4 &&
            local.x <= 0 &&
            local.y >= -0.1 &&
            local.y <= 0.1
        ) {
            return true;
        }
        return false;
    }

    computePreviewShape(): Shape | null {
        const { state } = this;
        if (!state.placementStartWorld) {
            return null;
        }

        // Don't allow placing teeny tiny objects
        const placementStartScreen = state.camera.worldToScreen(
            state.placementStartWorld
        );
        if (
            vec_magnitude(vec_sub(placementStartScreen, state.mousePosScreen)) <
            5
        ) {
            return null;
        }

        switch (state.tool) {
            case "quad":
                return this.computePreviewQuad(state.placementStartWorld);
            case "circle":
                return this.computePreviewCircle(state.placementStartWorld);
        }
        return null;
    }

    /**
     * Returns the quad that would be placed if the mouse were released after dragging a certain line on the screen.
     * The quad is that which would fill the axis-aligned bounding box of which the drawn line is the diagonal.
     **/
    computePreviewQuad(placementStart: Vec3): Shape | null {
        const { state } = this;
        const endWorld = state.camera.screenToWorld(state.mousePosScreen);
        const startWorld = placementStart;

        const width = Math.abs(endWorld.x - startWorld.x);
        const height = Math.abs(endWorld.y - startWorld.y);

        const centre = vec_div(vec_add(startWorld, endWorld), 2);
        const transform = fromObjectTransform({
            scale: newVector(width, height),
            rotation: 0,
            translation: newVector(centre.x, centre.y),
        });
        return new Quad(transform);
    }

    /**
     * Returns the circle (ellipse) that would be placed if the mouse were released after dragging a certain line on the screen.
     * The sphere is that which would fill the axis-aligned bounding box of which the drawn line is the diagonal.
     */
    computePreviewCircle(placementStart: Vec3): Circle | null {
        const { state } = this;
        const endWorld = state.camera.screenToWorld(state.mousePosScreen);
        const startWorld = placementStart;

        const width = Math.abs(endWorld.x - startWorld.x);
        const height = Math.abs(endWorld.y - startWorld.y);

        if (Math.min(width, height) === 0) {
            return null;
        }

        const centre = vec_div(vec_add(startWorld, endWorld), 2);
        const transform = fromObjectTransform({
            scale: newVector(width, height),
            rotation: 0,
            translation: newVector(centre.x, centre.y),
        });
        return new Circle(transform);
    }

    computePreviewLaser(): Laser | null {
        const { state } = this;
        if (state.placementStartWorld == null || state.tool !== "laser") {
            return null;
        }
        const end = state.camera.screenToWorld(state.mousePosScreen);
        const dir = vec_sub(end, state.placementStartWorld);
        const theta = Math.atan2(dir.y, dir.x);
        const transform = fromObjectTransform({
            scale: newVector(1, 1),
            rotation: theta,
            translation: newVector(
                state.placementStartWorld.x,
                state.placementStartWorld.y
            ),
        });
        return {
            type: "laser",
            transform,
        };
    }

    // Functions for updates via UI

    setCameraTransform(transform: Transform) {
        this.state.camera.transform = transform;
    }
}
