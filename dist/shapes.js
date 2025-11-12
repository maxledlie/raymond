import { newPoint, newVector, vec_dot, vec_magnitude_sq, vec_normalize, vec_sub } from "./math.js";
export class Shape {
    constructor(transform) {
        this.transform = transform;
    }
    intersect(ray) {
        // Transform the ray to the shape's local space
        const rayLocal = {
            start: this.transform.applyInverse(ray.start),
            direction: this.transform.applyInverse(ray.direction)
        };
        return this._intersectLocal(rayLocal);
    }
    normalAt(pointWorld) {
        // Transform point from world space to local space, then normal from local back to world
        const pointLocal = this.transform.applyInverse(pointWorld);
        const normalLocal = this._normalAtLocal(pointLocal);
        normalLocal.w = 0;
        return vec_normalize(normalLocal);
    }
    hitTest(pointWorld) {
        const pointLocal = this.transform.applyInverse(pointWorld);
        return this._hitTest(pointLocal);
    }
}
export class Circle extends Shape {
    type() {
        return "circle";
    }
    _intersectLocal(ray) {
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
    _normalAtLocal(point) {
        return vec_sub(point, newPoint(0, 0));
    }
    _hitTest(point) {
        return vec_magnitude_sq(vec_sub(point, newPoint(0, 0))) <= 1;
    }
}
export class Quad extends Shape {
    type() {
        return "quad";
    }
    _intersectLocal(ray) {
        // NOTE: Currently actually the intersection logic for a line segment
        // In the segment's local space, it's a horizontal line of length 2 centred at the origin.
        // So we need to find the distance along the ray at which it intersects the x axis.
        if (ray.direction.x == 0) {
            return [];
        }
        const t = (-ray.start.y / ray.direction.y);
        const x = ray.start.x + t * ray.direction.x;
        // ray may have missed the segment
        if (Math.abs(x) > 1) {
            return [];
        }
        return [t];
    }
    _normalAtLocal(point) {
        return newVector(0, 1);
    }
    _hitTest(point) {
        return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 0.1; // TODO: Make square
    }
}
