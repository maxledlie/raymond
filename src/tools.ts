import type { ToolType } from "./types";

export interface Tool {
    type: ToolType;
    hotkey: string;
    name: string;
}

export function tools(): Tool[] {
    return [
        { type: "laser", name: "Laser", hotkey: "l" },
        { type: "circle", name: "Circle", hotkey: "c" },
        { type: "quad", name: "Quad", hotkey: "q" },
        { type: "pan", name: "Pan", hotkey: "p" },
        { type: "select", name: "Select", hotkey: "s" },
    ];
}
