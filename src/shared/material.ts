import type { Color } from "./color";

export interface Material {
    color: Color;
    reflectivity: number;
    transparency: number;
    refractiveIndex: number;
}

export function defaultMaterial(): Material {
    return {
        color: { r: 173, g: 216, b: 230 },
        reflectivity: 1,
        transparency: 0,
        refractiveIndex: 1.5,
    };
}
