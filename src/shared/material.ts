import type { Color } from "./color";

export interface Material {
    color: Color;
    reflectivity: number;
    transparency: number;
    refractiveIndex: number;
}

export function defaultMaterial(): Material {
    return {
        color: { r: 100 / 255, g: 150 / 255, b: 65 / 255 },
        reflectivity: 0,
        transparency: 0,
        refractiveIndex: 1.5,
    };
}
