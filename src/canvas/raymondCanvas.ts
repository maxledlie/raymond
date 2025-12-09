import Camera, { type CameraSetup } from "../camera.js";
import {
    type Vec3,
    vec_add,
    vec_sub,
    newPoint,
    newVector,
    vec_div,
    vec_magnitude,
    mat3_mul_mat,
    mat3_identity,
} from "../math.js";
import { Shape, Quad, Circle } from "../shapes.js";
import { color_add, color_html, color_mul } from "../shared/color.js";
import type { Material } from "../shared/material.js";
import {
    type Transform,
    apply,
    fromObjectTransform,
    toObjectTransform,
} from "../transform.js";
import { Canvas } from "./canvas.js";
import { Eye } from "./Eye.js";
import { computeSegments, toggleSchlick } from "./optics.js";
import SelectionLayer from "./selection.js";

type ToolType = "eye" | "quad" | "circle" | "pan" | "select" | "light";

const FRAME_RATE = 60;

interface Tool {
    type: ToolType;
    hotkey: string;
    name: string;
}

const tools: Tool[] = [
    { type: "eye", name: "Eye", hotkey: "e" },
    { type: "circle", name: "Circle", hotkey: "c" },
    { type: "quad", name: "Quad", hotkey: "q" },
    { type: "pan", name: "Pan", hotkey: "p" },
    { type: "select", name: "Select", hotkey: "s" },
    { type: "light", name: "Light", hotkey: "l" },
];

interface Animation {
    from: CameraSetup;
    to: CameraSetup;
    time: number;
    end: number;
}

interface State {
    debug: boolean;
    camera: Camera;
    tool: ToolType;
    shapes: Shape[];
    lastMousePos: Vec3;
    isMouseDown: boolean;
    placementStartWorld: Vec3 | null;
    panStart: Vec3 | null;
    eyes: Eye[];
    cameraPath: Animation | null;
}

function defaultState(): State {
    return {
        debug: false,
        lastMousePos: newPoint(0, 0),
        isMouseDown: false,
        placementStartWorld: null,
        panStart: null,
        tool: "eye",
        eyes: [],
        shapes: [],
        camera: new Camera(1, 1), // We don't know the screen width and height yet.
        cameraPath: null,
    };
}

export class RaymondCanvas extends Canvas {
    state: State = defaultState();
    selectionLayer: SelectionLayer = new SelectionLayer(this.state.camera);

    setup() {
        // We have to set these again once things are initialised.
        this.state.camera = new Camera(this.width, this.height);
        this.selectionLayer = new SelectionLayer(this.state.camera);
    }

    keyPressed(e: KeyboardEvent): void {
        const { state } = this;
        if (e.key.toUpperCase() === "D") {
            state.debug = !state.debug;
        }
        if (e.key.toUpperCase() === "P") {
            toggleSchlick();
        }
        if (
            e.key === "Delete" &&
            this.selectionLayer.selectedObjectIndex != null
        ) {
            state.shapes.splice(this.selectionLayer.selectedObjectIndex, 1);
            const selectedObject = this.selectionLayer.getSelectedObject();
            this.selectionLayer.removeSelectable(selectedObject!);
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
                this.selectionLayer.mouseDown(mouseScreen);
            } else {
                state.placementStartWorld = mouseWorld;
            }
        }
        if (e.button === 1 || state.tool === "pan") {
            state.panStart = mouseScreen;
        }
    }

    mouseWheel(e: WheelEvent): void {
        const { state } = this;
        const zoomSpeed = 0.0001;
        const zoomFrac = zoomSpeed * e.deltaY;
        state.camera.zoom(zoomFrac, newPoint(this.mouseX, this.mouseY));
    }

    mouseReleased(e: MouseEvent): void {
        const { state } = this;
        state.isMouseDown = false;
        this.selectionLayer.mouseUp();
        if (e.button === 0) {
            if (state.tool === "eye") {
                const previewEye = this.computePreviewEye();
                if (previewEye) {
                    state.eyes.push(previewEye);
                    this.selectionLayer.addSelectable(previewEye);
                }
            } else {
                const previewShape = this.computePreviewShape();
                if (previewShape) {
                    state.shapes.push(previewShape);
                    this.selectionLayer.addSelectable(previewShape);
                }
            }
            state.placementStartWorld = null;
        }
        if (e.button == 1 || state.tool == "pan") {
            state.panStart = null;
        }
    }

    mouseMoved(e: MouseEvent): void {
        const dragEndScreen = newPoint(e.offsetX, e.offsetY);
        const dragStartScreen = vec_sub(
            dragEndScreen,
            newVector(e.movementX, e.movementY)
        );
        this.selectionLayer.mouseMoved(dragStartScreen, dragEndScreen);
    }

    doubleClicked() {
        const { state } = this;
        const shape = this.selectionLayer.getSelectedObject();

        if (shape) {
            // Position the camera such that the shape's bounding box appears to be a unit square at the center of the screen
            const aspectRatio = this.width / this.height;
            const worldCenter = apply(shape.transform, newPoint(0, 0));
            const o = toObjectTransform(shape.transform);
            const target: CameraSetup = {
                center: worldCenter,
                rotation: o.rotation,
                size: newVector(o.scale.x * aspectRatio * 10, o.scale.y * 10),
            };
            state.cameraPath = {
                from: { ...state.camera.getSetup() },
                to: target,
                time: 0,
                end: 2,
            };
        }
    }

    smoothstep(x: number): number {
        const f = 3 * Math.pow(x, 2) - 2 * Math.pow(x, 3);
        return Math.max(0, Math.min(1, f));
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
                state.camera.setSetup(
                    Camera.interpSetup(path.from, path.to, smoothX)
                );
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
        const mouseWorld = state.camera.screenToWorld(mouseScreen);

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
        let previewEye = this.computePreviewEye();
        let previewShape = this.computePreviewShape();

        const eyes = [...state.eyes];
        if (previewEye) {
            eyes.push(previewEye);
        }
        const shapes: Shape[] = [...state.shapes];
        if (previewShape) {
            shapes.push(previewShape);
        }

        // Draw eyes including preview eye
        for (const eye of eyes) {
            const hovered = eye.hitTest(mouseWorld);
            this.drawEye(ctx, eye, hovered);
        }

        // Draw shapes including preview shape
        for (const shape of shapes) {
            const hovered = shape.hitTest(mouseWorld);
            this.drawShape(shape, hovered);
        }

        // Draw selection box and handles for selected shape
        this.selectionLayer.draw(this.ctx);

        // Work out the segments to actually draw
        const { segments } = computeSegments(eyes, shapes);

        ctx.lineWidth = 2;
        for (const { start, end, color, attenuation } of segments) {
            ctx.strokeStyle = color_html(color, attenuation);
            this.drawLine(start, end);
        }

        // Draw what the eye sees!
        // const pad = 40;
        // const eye = this.state.eyes[0];
        // if (eye) {
        //     const xStep = (this.width - 2 * pad) / eye.numRays;
        //     for (let i = 0; i < eye.numRays; i++) {
        //         console.log("vision: ", vision);
        //         ctx.fillStyle = color_html(
        //             vision[i] ?? { r: 0, g: 0, b: 0 },
        //             1
        //         );
        //         ctx.fillRect(
        //             pad + i * xStep,
        //             this.height - 110,
        //             xStep + 1,
        //             100
        //         );
        //     }
        // }

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

    drawShape(shape: Shape, hovered: boolean) {
        const { state, ctx } = this;
        if (hovered && state.debug) {
            const majorColor = this.color(100, 100, 255, 255);
            const minorColor = this.color(100, 100, 255, 200);
            this.drawCoordinates(shape.transform, majorColor, minorColor, 2);
        }
        const oldTransform = ctx.getTransform();

        // Get the combination of object and camera transforms
        const mat = mat3_mul_mat(state.camera.transform, shape.transform);
        ctx.setTransform(
            mat[0][0],
            mat[1][0],
            mat[0][1],
            mat[1][1],
            mat[0][2],
            mat[1][2]
        );

        const trueColor = color_html(
            shape.material.color,
            1 - shape.material.transparency
        );
        if (shape.material.reflectivity > 0) {
            const gradient = ctx.createLinearGradient(-1, -1, 1, 1);
            const specularColor = color_html(
                color_add(
                    shape.material.color,
                    color_mul({ r: 1, g: 1, b: 1 }, shape.material.reflectivity)
                ),
                1 - shape.material.transparency
            );
            gradient.addColorStop(0, trueColor);
            gradient.addColorStop(0.25, trueColor);
            gradient.addColorStop(0.5, specularColor);
            gradient.addColorStop(0.75, trueColor);
            gradient.addColorStop(1, trueColor);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = trueColor;
        }

        switch (shape.type()) {
            case "quad":
                this.drawQuad();
                break;
            case "circle":
                this.drawCircle();
                break;
        }

        ctx.setTransform(oldTransform);
    }

    drawEye(ctx: CanvasRenderingContext2D, eye: Eye, hovered: boolean) {
        const { state } = this;

        // Drawing the apparatus as a polygon is probably suboptimal.
        // Maybe I should transform the canvas and use p.rect?
        const topLeft = newPoint(-0.4, -0.1);
        const topRight = newPoint(0, -0.1);
        const bottomRight = newPoint(0, 0.1);
        const bottomLeft = newPoint(-0.4, 0.1);

        if (hovered && state.debug) {
            // Draw local coordinate system of eye
            const minorColor = this.color(0, 100, 0, 100);
            const majorColor = this.color(0, 255, 0, 255);
            this.drawCoordinates(eye.transform, majorColor, minorColor, 2);
        }

        const points = [topLeft, topRight, bottomRight, bottomLeft].map((p) => {
            const world = apply(eye.transform, p);
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

    drawQuad() {
        this.ctx.fillRect(-1, -1, 2, 2);
    }

    drawCircle() {
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 1, 1, 0, 0, 2 * Math.PI);
        this.ctx.closePath();
        this.ctx.fill();
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
            vec_magnitude(
                vec_sub(
                    placementStartScreen,
                    newPoint(this.mouseX, this.mouseY)
                )
            ) < 5
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
        const endWorld = state.camera.screenToWorld(
            newPoint(this.mouseX, this.mouseY)
        );
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
        const endWorld = state.camera.screenToWorld(
            newPoint(this.mouseX, this.mouseY)
        );
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

    computePreviewEye(): Eye | null {
        const { state } = this;
        if (state.placementStartWorld == null || state.tool !== "eye") {
            return null;
        }
        const end = state.camera.screenToWorld(
            newPoint(this.mouseX, this.mouseY)
        );
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
        return new Eye(transform);
    }

    // Functions for updates via UI

    setCameraTransform(transform: Transform) {
        this.state.camera.transform = transform;
    }

    setSelectedShapeTransform(transform: Transform) {
        const shape = this.selectionLayer.getSelectedObject();
        if (shape) {
            shape.transform = transform;
        }
    }

    setSelectedShapeMaterial(material: Material) {
        const selected = this.selectionLayer.getSelectedObject();
        if (selected instanceof Shape) {
            selected.material = material;
        }
    }
}
