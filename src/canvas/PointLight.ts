import { newPoint, vec_magnitude, vec_sub, type Vec3 } from "../math";
import type { Color } from "../shared/color";
import { apply, inverse, type Transform } from "../transform";

export class PointLight {
    color: Color;
    transform: Transform;

    constructor(color: Color, transform: Transform) {
        this.color = color;
        this.transform = transform;
    }

    hitTest(pointWorld: Vec3): boolean {
        const pointLocal = apply(inverse(this.transform), pointWorld);
        console.log(pointLocal);
        return vec_magnitude(vec_sub(pointLocal, newPoint(0, 0))) < 0.3;
    }

    // Returns the relative positions in local space of the object's handle
    handlePositions(): Vec3[] {
        return [];
    }

    handleMoved() {}
}
