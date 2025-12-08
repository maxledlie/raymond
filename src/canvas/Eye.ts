import { newPoint, vec_sub, type Vec3 } from "../math";
import { apply, inverse, transformObject, type Transform } from "../transform";

const MAX_RAYS = 30;

export class Eye {
    transform: Transform;
    numRays: number = 1;
    fov: number = Math.PI / 4;

    constructor(transform: Transform) {
        this.transform = transform;
    }

    hitTest(worldPoint: Vec3): boolean {
        const local = apply(inverse(this.transform), worldPoint);

        // The drawn rectangle is at local coords x in [-40, 0], y in [-10, 10]
        if (
            local.x >= -0.4 &&
            local.x <= 0 &&
            local.y >= -0.1 &&
            local.y <= 0.1
        ) {
            return true;
        }
        return false;
    }

    // Returns the relative positions in local space of the object's handle
    handlePositions(): Vec3[] {
        const rotation = newPoint(0, 1.2);

        // FOV of pi <-> x = 0
        // FOV of 0  <-> x = 1
        const lensX = 1 - this.fov / Math.PI;

        // 1 ray    <-> y = 0
        // max rays <-> y = 1
        const lensY = (this.numRays - 1) / MAX_RAYS;

        return [rotation, newPoint(lensX, lensY)];
    }

    // TODO: Would be cleaner for shapes not to know about their handles
    handleMoved(handleIndex: number, _: Vec3, newPos: Vec3) {
        if (handleIndex === 0) {
            // We are rotating the shape. The centre of the shape, top of the shape, and mouse position should be collinear.
            const shapeCentreWorld = apply(this.transform, newPoint(0, 0));
            const d = vec_sub(newPos, shapeCentreWorld);
            const theta = Math.atan2(d.y, d.x);
            this.transform = transformObject(this.transform, (o) => ({
                ...o,
                rotation: theta - Math.PI / 2,
            }));
        } else {
            const posLocal = apply(inverse(this.transform), newPos);

            this.fov = Math.max(
                0,
                Math.min(Math.PI, (1 - posLocal.x) * Math.PI)
            );
            this.numRays = Math.max(
                1,
                Math.min(MAX_RAYS, 1 + posLocal.y * MAX_RAYS)
            );
        }
    }
}
