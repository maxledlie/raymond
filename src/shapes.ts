import {
    mat3_inverse,
    mat3_mul_vec,
    mat3_transpose,
    newPoint,
    newVector,
    type Vec3,
    vec_dot,
    vec_magnitude_sq,
    vec_normalize,
    vec_sub,
} from "./math.js";
import Transform from "./transform.js";
import type { Ray } from "./types.js";

const EPS = 0.00001;

export interface Intersection {
    t: number;
    shape: Shape;
}

export type ShapeType = "quad" | "circle";

export abstract class Shape {
    transform: Transform;

    constructor(transform: Transform) {
        this.transform = transform;
    }

    abstract type(): string;

    /* Returns the t-values at which a given ray intersects the canonical version of this shape */
    abstract _intersectLocal(ray: Ray): number[];

    /* Returns the normal vector at the given point on the surface of the canonical version of this shape */
    abstract _normalAtLocal(point: Vec3): Vec3;

    /* Returns true if the given point in local space is within the shape's boundary */
    abstract _hitTest(point: Vec3): boolean;

    intersect(ray: Ray): number[] {
        // Transform the ray to the shape's local space
        const rayLocal: Ray = {
            start: this.transform.applyInverse(ray.start),
            direction: this.transform.applyInverse(ray.direction),
        };
        return this._intersectLocal(rayLocal);
    }

    normalAt(pointWorld: Vec3): Vec3 {
        // Transform point from world space to local space, then normal from local back to world
        const pointLocal = this.transform.applyInverse(pointWorld);
        const normalLocal = this._normalAtLocal(pointLocal);

        const mat = this.transform.getMatrix();
        const inv = mat3_inverse(mat);

        let normalWorld: Vec3 = { ...normalLocal };
        if (inv) {
            const inv_transpose = mat3_transpose(inv);
            normalWorld = mat3_mul_vec(inv_transpose, normalLocal);
        }

        normalWorld.w = 0;
        return vec_normalize(normalWorld);
    }

    hitTest(pointWorld: Vec3): boolean {
        const pointLocal = this.transform.applyInverse(pointWorld);
        return this._hitTest(pointLocal);
    }
}

export class Circle extends Shape {
    type(): string {
        return "circle";
    }

    _intersectLocal(ray: Ray): number[] {
        const sphereToRay = vec_sub(ray.start, newPoint(0, 0)); // Effectively just sets w = 0
        const a = vec_magnitude_sq(ray.direction);
        const b = 2 * vec_dot(ray.start, ray.direction);
        const c = vec_magnitude_sq(sphereToRay) - 1;

        const disc = b * b - 4 * a * c;
        if (disc < 0) {
            return [];
        }

        const rootDisc = Math.sqrt(disc);
        const tlo = (-b - rootDisc) / (2 * a);
        const thi = (-b + rootDisc) / (2 * a);
        return [tlo, thi];
    }

    _normalAtLocal(point: Vec3): Vec3 {
        return vec_sub(point, newPoint(0, 0));
    }

    _hitTest(point: Vec3): boolean {
        return vec_magnitude_sq(vec_sub(point, newPoint(0, 0))) <= 1;
    }
}

export class Quad extends Shape {
    type(): string {
        return "quad";
    }

    _checkAxis(start: number, direction: number): number[] {
        const tminNumerator = -1 - start;
        const tmaxNumerator = +1 - start;

        let tmin, tmax;
        if (Math.abs(direction) >= EPS) {
            tmin = tminNumerator / direction;
            tmax = tmaxNumerator / direction;
        } else {
            tmin = tminNumerator * Infinity;
            tmax = tmaxNumerator * Infinity;
        }

        if (tmin > tmax) {
            const temp = tmax;
            tmax = tmin;
            tmin = temp;
        }
        return [tmin, tmax];
    }

    _intersectLocal(ray: Ray): number[] {
        const [xtmin, xtmax] = this._checkAxis(ray.start.x, ray.direction.x);
        const [ytmin, ytmax] = this._checkAxis(ray.start.y, ray.direction.y);
        const tmin = Math.max(xtmin, ytmin);
        const tmax = Math.min(xtmax, ytmax);

        return tmin < tmax ? [tmin, tmax] : [];
    }

    _normalAtLocal(point: Vec3): Vec3 {
        const maxc = Math.max(Math.abs(point.x), Math.abs(point.y));
        if (maxc == Math.abs(point.x)) {
            return newVector(point.x, 0);
        } else {
            return newVector(0, point.y);
        }
    }

    _hitTest(point: Vec3): boolean {
        return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
    }
}
