import type Camera from "./camera";
import { newPoint, vec_sub, type Vec3 } from "./math";
import type { Shape } from "./shapes";
import { apply, inverse, transformObject, type Transform } from "./transform";

export interface RaymondState {
    debug: boolean;
    lastMousePos: Vec3;
    isMouseDown: boolean;
    placementStartWorld: Vec3 | null;
    panStart: Vec3 | null;
    tool: ToolType;
    eyes: Eye[];
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

export interface Ray {
    start: Vec3;
    direction: Vec3;
}

export class Eye {
    transform: Transform;
    numRays: number = 1;

    constructor(transform: Transform) {
        this.transform = transform;
    }

    hitTest(worldPoint: Vec3): boolean {
        const local = apply(inverse(this.transform), worldPoint);

        // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
        if (
            local.x >= -0.4 &&
            local.x <= 0 &&
            local.y >= -0 &&
            local.y <= 0.1
        ) {
            return true;
        }
        return false;
    }

    // Returns the relative positions in local space of the object's handle
    handlePositions(): Vec3[] {
        return [newPoint(0, 1.2)];
    }

    // TODO: Would be cleaner for shapes not to know about their handles
    handleMoved(handleIndex: number, _: Vec3, newPos: Vec3) {
        if (handleIndex !== 0) {
            return; // Scaling not implemented yet
        }
        // We are rotating the shape. The centre of the shape, top of the shape, and mouse position should be collinear.
        const shapeCentreWorld = apply(this.transform, newPoint(0, 0));
        const d = vec_sub(newPos, shapeCentreWorld);
        const theta = Math.atan2(d.y, d.x);
        this.transform = transformObject(this.transform, (o) => ({
            ...o,
            rotation: theta - Math.PI / 2,
        }));
    }
}

export type ToolType = "eye" | "quad" | "circle" | "pan" | "select";

export interface Tool {
    type: ToolType;
    hotkey: string;
    name: string;
}
