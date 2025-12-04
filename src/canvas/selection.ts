import type Camera from "../camera";
import {
    newPoint,
    vec_add,
    vec_magnitude,
    vec_mul,
    vec_normalize,
    vec_sub,
    type Vec3,
} from "../math";
import type { Shape } from "../shapes";
import {
    apply,
    toObjectTransform,
    transformObject,
    translateObject,
} from "../transform";

type HandleAction = "scale" | "rotate";

interface Handle {
    position: Vec3;
    action: HandleAction;
}

export default class SelectionLayer {
    shapes: Shape[];
    camera: Camera;
    selectedShapeIndex: number | null = null;
    activeHandleIndex: number | null = null;
    shapeDragged: boolean = false;

    constructor(shapes: Shape[], camera: Camera) {
        this.shapes = shapes;
        this.camera = camera;
    }

    mouseDown(screenPoint: Vec3) {
        // Activate a handle if one is hovered
        if (this.selectedShapeIndex != null) {
            const selectedShape = this.shapes[this.selectedShapeIndex];
            const { rotation, scale } = this.computeHandles(selectedShape);
            for (const [index, handle] of [rotation, ...scale].entries()) {
                if (vec_magnitude(vec_sub(handle.position, screenPoint)) < 10) {
                    this.activeHandleIndex = index;
                    break;
                }
            }
        }

        // Select the most-recently-placed object that we are currently hovering over
        let selectionIndex = -1;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const worldPoint = this.camera.screenToWorld(screenPoint);

            if (this.shapes[i].hitTest(worldPoint)) {
                selectionIndex = i;
            }
        }
        if (selectionIndex >= 0) {
            this.selectedShapeIndex = selectionIndex;
            this.shapeDragged = true;
        }
    }

    mouseUp() {
        this.shapeDragged = false;
        this.activeHandleIndex = null;
    }

    mouseMoved(from: Vec3, to: Vec3) {
        // Rotate or scale shape if dragging a handle
        if (this.selectedShapeIndex != null && this.activeHandleIndex == 0) {
            // We are rotating the shape. The centre of the shape, top of the shape, and mouse position should be collinear.
            const shape = this.shapes[this.selectedShapeIndex];
            const shapeCentreWorld = apply(shape.transform, newPoint(0, 0));
            const mouseWorld = this.camera.screenToWorld(to);
            const d = vec_sub(mouseWorld, shapeCentreWorld);
            const theta = Math.atan2(d.y, d.x);
            shape.transform = transformObject(shape.transform, (o) => ({
                ...o,
                rotation: theta - Math.PI / 2,
            }));
        }

        // Drag selected shape
        if (
            this.selectedShapeIndex != null &&
            this.shapes.length > this.selectedShapeIndex &&
            this.shapeDragged
        ) {
            const selectedShape = this.shapes[this.selectedShapeIndex];

            const dragEndWorld = this.camera.screenToWorld(to);
            const dragStartWorld = this.camera.screenToWorld(from);
            const dragDelta = vec_sub(dragEndWorld, dragStartWorld);
            selectedShape.transform = translateObject(
                selectedShape.transform,
                dragDelta
            );
        }
    }

    getSelectedShape(): Shape | null {
        return this.shapes[this.selectedShapeIndex ?? -1] ?? null;
    }

    shapeDeleted() {
        this.selectedShapeIndex = null;
    }

    /**
     * Returns the handles that should be drawn around the given shape, assuming it's selected
     */
    computeHandles(shape: Shape): { rotation: Handle; scale: Handle[] } {
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
            this.camera.worldToScreen(apply(shape.transform, x))
        );

        const centreScreen = this.camera.worldToScreen(
            apply(shape.transform, newPoint(0, 0))
        );
        const topScreen = this.camera.worldToScreen(
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

    draw(ctx: CanvasRenderingContext2D) {
        if (this.selectedShapeIndex == null) {
            return;
        }

        const shape = this.shapes[this.selectedShapeIndex];
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;

        // Draw bounding box around shape
        const points = [];
        for (const local of [
            newPoint(-1, 1),
            newPoint(1, 1),
            newPoint(1, -1),
            newPoint(-1, -1),
        ]) {
            const world = apply(shape.transform, local);
            const screen = this.camera.worldToScreen(world);
            points.push(screen);
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        const { rotation, scale } = this.computeHandles(shape);

        const topScreen = this.camera.worldToScreen(
            apply(shape.transform, newPoint(0, 1))
        );

        ctx.beginPath();
        ctx.moveTo(rotation.position.x, rotation.position.y);
        ctx.lineTo(topScreen.x, topScreen.y);
        ctx.stroke();

        ctx.strokeStyle = "black";
        for (const [i, p] of scale.entries()) {
            ctx.fillStyle =
                this.activeHandleIndex === i + 1 ? "green" : "white";
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        ctx.fillStyle = this.activeHandleIndex === 0 ? "green" : "white";
        ctx.beginPath();
        ctx.arc(rotation.position.x, rotation.position.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
}
