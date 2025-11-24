import { create } from "zustand";
import { newPoint } from "./math";
import Camera from "./camera";
import type { RaymondState } from "./types";

export const useStore = create<RaymondState>((_) => ({
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
}));
