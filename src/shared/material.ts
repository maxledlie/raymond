import type { Color } from "./color";

export interface Material {
    color: Color;
    reflectivity: number;
    transparency: number;
    refractiveIndex: number;

    ambient: number;
    diffuse: number;
    specular: number;
    shininess: number;
}

export function defaultMaterial(): Material {
    return {
        color: { r: 100 / 255, g: 150 / 255, b: 65 / 255 },
        reflectivity: 0,
        transparency: 0,
        refractiveIndex: 1.5,

        ambient: 0.1,
        diffuse: 0.9,
        specular: 0.9,
        shininess: 200,
    };
}
