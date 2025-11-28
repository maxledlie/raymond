import {
    mat3_chain,
    mat3_inverse,
    mat3_mul_vec,
    type Vec3,
    newVector,
    type Mat3,
    vec_add,
    vec_mul,
} from "./math.js";

export interface ObjectTransform {
    scale: Vec3;
    rotation: number;
    translation: Vec3;
}

export type Transform = Mat3;

/** Converts an object transform to the more general form of a matrix transform. */
export function fromObjectTransform(t: ObjectTransform): Transform {
    return mat3_chain([
        translation(t.translation.x, t.translation.y),
        rotation(t.rotation),
        scaling(t.scale.x, t.scale.y),
    ]);
}

/** Converts a general matrix transform to an object transform, assuming no shear. */
export function toObjectTransform(t: Transform): ObjectTransform {
    const [a, b, tx] = [...t[0]];
    const [c, d, ty] = [...t[1]];

    // Extract translation, scale and rotation of new matrix
    const rotation = Math.atan2(c, a);

    const scaleX = Math.sqrt(a * a + c * c);
    const scaleY = (a * d - b * c) / scaleX;
    const scale = newVector(scaleX, scaleY);

    const translation = newVector(tx, ty);

    return {
        scale,
        rotation,
        translation,
    };
}

export function inverse(transform: Transform): Transform {
    return mat3_inverse(transform) ?? transform;
}

export function apply(transform: Transform, vec: Vec3): Vec3 {
    return mat3_mul_vec(transform, vec);
}

/** Linearly interpolates the scale, translation and rotations of the two transforms,
 *  allowing for smooth animation between the two. **/
export function interp(a: Transform, b: Transform, x: number) {
    const oa = toObjectTransform(a);
    const ob = toObjectTransform(b);
    const rotation = (1 - x) * oa.rotation + x * ob.rotation;
    const scale = vec_add(vec_mul(oa.scale, 1 - x), vec_mul(ob.scale, x));
    const translation = vec_add(
        vec_mul(oa.translation, 1 - x),
        vec_mul(ob.translation, x)
    );
    return fromObjectTransform({ scale, rotation, translation });
}

export function translation(tx: number, ty: number): Mat3 {
    return [
        [1, 0, tx],
        [0, 1, ty],
        [0, 0, 1],
    ];
}

export function rotation(theta: number): Mat3 {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1],
    ];
}

export function scaling(sx: number, sy?: number): Mat3 {
    const _sy = typeof sy === "number" ? sy : sx;
    return [
        [sx, 0, 0],
        [0, _sy, 0],
        [0, 0, 1],
    ];
}

// Helpers for rotating, scaling and translating object transforms.
export function transformObject(
    t: Transform,
    f: (o: ObjectTransform) => ObjectTransform
) {
    const o = toObjectTransform(t);
    const oNew = f(o);
    return fromObjectTransform(oNew);
}

export function rotateObject(t: Transform, theta: number): Transform {
    return transformObject(t, (o) => ({ ...o, rotation: o.rotation + theta }));
}

export function translateObject(t: Transform, delta: Vec3): Transform {
    return transformObject(t, (o) => ({
        ...o,
        translation: vec_add(o.translation, delta),
    }));
}

export function scaleObject(t: Transform, scale: Vec3): Transform {
    return transformObject(t, (o) => ({
        ...o,
        scale: newVector(o.scale.x * scale.x, o.scale.y * scale.y),
    }));
}
