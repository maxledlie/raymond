import { newPoint, newVector, vec_dot, vec_magnitude_sq, vec_normalize, vec_sub } from "./math.js";
const EPS = 0.00001;
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
    _checkAxis(start, direction) {
        const tminNumerator = (-1 - start);
        const tmaxNumerator = (+1 - start);
        let tmin, tmax;
        if (Math.abs(direction) >= EPS) {
            tmin = tminNumerator / direction;
            tmax = tmaxNumerator / direction;
        }
        else {
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
    _intersectLocal(ray) {
        const [xtmin, xtmax] = this._checkAxis(ray.start.x, ray.direction.x);
        const [ytmin, ytmax] = this._checkAxis(ray.start.y, ray.direction.y);
        const tmin = Math.max(xtmin, ytmin);
        const tmax = Math.min(xtmax, ytmax);
        return tmin < tmax ? [tmin, tmax] : [];
    }
    _normalAtLocal(point) {
        const maxc = Math.max(Math.abs(point.x), Math.abs(point.y));
        if (maxc == Math.abs(point.x)) {
            return newVector(point.x, 0);
        }
        else {
            return newVector(0, point.y);
        }
    }
    _hitTest(point) {
        return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
    }
}
