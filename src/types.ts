import type Camera from "./camera";
import type { Vec3 } from "./math";
import type { Shape } from "./shapes";
import { type Transform } from "./transform";

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

export interface Eye {
    type: "eye";
    transform: Transform; // Maps a point from the eye's local space to world space
}

export type ToolType = "eye" | "quad" | "circle" | "pan" | "select";

export interface Tool {
    type: ToolType;
    hotkey: string;
    name: string;
}
