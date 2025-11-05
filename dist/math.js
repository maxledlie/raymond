export function vec_add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
export function vec_sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
export function vec_mul(a, scalar) {
    return { x: a.x * scalar, y: a.y * scalar };
}
export function vec_div(a, scalar) {
    return { x: a.x / scalar, y: a.y / scalar };
}
export function vec_magnitude(a) {
    return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2));
}
export function vec_normalize(a) {
    return vec_div(a, vec_magnitude(a));
}
export function mat2_mul(a, scalar) {
    return [
        [a[0][0] * scalar, a[0][1] * scalar],
        [a[1][0] * scalar, a[1][1] * scalar]
    ];
}
export function mat_mul_vec(a, v) {
    return {
        x: a[0][0] * v.x + a[0][1] * v.y,
        y: a[1][0] * v.x + a[1][1] * v.y
    };
}
export function mat_mul_mat(a, b) {
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]
    ];
}
// 3x3 matrix (homogeneous coordinates) helpers for 2D affine transforms
export function mat3_identity() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}
export function translation(tx, ty) {
    return [
        [1, 0, tx],
        [0, 1, ty],
        [0, 0, 1]
    ];
}
export function rotation(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1]
    ];
}
export function scale(sx, sy) {
    const _sy = (typeof sy === 'number') ? sy : sx;
    return [
        [sx, 0, 0],
        [0, _sy, 0],
        [0, 0, 1]
    ];
}
/**
 * Shear in X and Y. shx is x shear (x' = x + shx * y). shy is y shear (y' = y + shy * x).
 */
export function shear(shx, shy) {
    return [
        [1, shx, 0],
        [shy, 1, 0],
        [0, 0, 1]
    ];
}
export function mat3_mul_mat(a, b) {
    const res = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let v = 0;
            for (let k = 0; k < 3; k++) {
                v += a[i][k] * b[k][j];
            }
            res[i][j] = v;
        }
    }
    return res;
}
/**
 * Apply a 3x3 affine matrix to a 2D vector (homogeneous coords).
 * Returns a Vector; if the resulting w is non-1, performs perspective divide.
 */
export function mat3_mul_vec(m, v) {
    const x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * 1;
    const y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * 1;
    const w = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * 1;
    if (w === 0) {
        return { x, y };
    }
    return { x: x / w, y: y / w };
}
export function mat_inverse(m) {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    const a = [
        [m[1][1], -m[0][1]],
        [-m[1][0], m[0][0]]
    ];
    return mat2_mul(a, 1 / det);
}
