import type Camera from "../camera";
import {
    newPoint,
    vec_magnitude,
    vec_sub,
    type Vec3,
} from "../math";
import { apply, translateObject, type Transform } from "../transform";

interface Selectable {
    transform: Transform;
    hitTest(worldPoint: Vec3): boolean;
    handlePositions(): Vec3[];
    handleMoved(handleIndex: number, oldPos: Vec3, newPos: Vec3): void;
}

export default class SelectionLayer {
    objects: Selectable[] = [];
    camera: Camera;
    selectedObjectIndex: number | null = null;
    activeHandleIndex: number | null = null;
    shapeDragged: boolean = false;

    constructor(camera: Camera) {
        this.camera = camera;
    }

    addSelectable(obj: Selectable) {
        this.objects.push(obj);
    }

    removeSelectable(obj: Selectable) {
        const ix = this.objects.findIndex((o) => o === obj);
        this.objects.splice(ix, 1);
        if (ix === this.selectedObjectIndex) {
            this.selectedObjectIndex = null;
        }
    }

    mouseDown(screenPoint: Vec3) {
        // Activate a handle if one is hovered
        if (this.selectedObjectIndex != null) {
            const selected = this.objects[this.selectedObjectIndex];
            const handles = selected.handlePositions();
            for (const [i, p] of handles.entries()) {
                const pScreen = this.camera.worldToScreen(
                    apply(selected.transform, p)
                );
                if (vec_magnitude(vec_sub(pScreen, screenPoint)) < 10) {
                    this.activeHandleIndex = i;
                    break;
                }
            }
        }

        // Select the most-recently-placed object that we are currently hovering over
        let selectionIndex = -1;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const worldPoint = this.camera.screenToWorld(screenPoint);

            if (this.objects[i].hitTest(worldPoint)) {
                selectionIndex = i;
            }
        }
        if (selectionIndex >= 0) {
            this.selectedObjectIndex = selectionIndex;
            this.shapeDragged = true;
        } else {
            if (this.activeHandleIndex == null) {
                this.selectedObjectIndex = null;
            }
        }
    }

    mouseUp() {
        this.shapeDragged = false;
        this.activeHandleIndex = null;
    }

    mouseMoved(from: Vec3, to: Vec3) {
        // Rotate or scale shape if dragging a handle
        const selected = this.getSelectedObject();
        if (selected && this.activeHandleIndex != null) {
            selected.handleMoved(
                this.activeHandleIndex,
                this.camera.screenToWorld(from),
                this.camera.screenToWorld(to)
            );
        }

        // Drag selected shape
        if (selected && this.shapeDragged) {
            const dragEndWorld = this.camera.screenToWorld(to);
            const dragStartWorld = this.camera.screenToWorld(from);
            const dragDelta = vec_sub(dragEndWorld, dragStartWorld);
            selected.transform = translateObject(selected.transform, dragDelta);
        }
    }

    getSelectedObject(): Selectable | null {
        return this.objects[this.selectedObjectIndex ?? -1] ?? null;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.selectedObjectIndex == null) {
            return;
        }

        const shape = this.objects[this.selectedObjectIndex];
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

        const handles = shape.handlePositions();

        ctx.strokeStyle = "black";
        for (const [i, p] of handles.entries()) {
            const pScreen = this.camera.worldToScreen(
                apply(shape.transform, p)
            );
            ctx.fillStyle = this.activeHandleIndex === i ? "green" : "white";
            ctx.beginPath();
            ctx.arc(pScreen.x, pScreen.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke()
        }
    }
}
