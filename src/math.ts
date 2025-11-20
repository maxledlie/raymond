/**
 * Transpose a 3x3 matrix.
 */
export function mat3_transpose(m: Mat3): Mat3 {
    return [
        [m[0][0], m[1][0], m[2][0]],
        [m[0][1], m[1][1], m[2][1]],
        [m[0][2], m[1][2], m[2][2]],
    ];
}
export interface Vec3 {
    x: number;
    y: number;
    w: number;
}

export type Mat2 = number[][];
export type Mat3 = number[][];

export function newVector(x: number, y: number): Vec3 {
    return { x, y, w: 0 };
}

export function newPoint(x: number, y: number): Vec3 {
    return { x, y, w: 1 };
}

export function vec_add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, w: a.w + b.w };
}

export function vec_sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, w: a.w - b.w };
}

export function vec_mul(a: Vec3, scalar: number): Vec3 {
    return { x: a.x * scalar, y: a.y * scalar, w: a.w * scalar };
}

export function vec_div(a: Vec3, scalar: number): Vec3 {
    return { x: a.x / scalar, y: a.y / scalar, w: a.w / scalar };
}

export function vec_magnitude(a: Vec3): number {
    return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2) + Math.pow(a.w, 2));
}

export function vec_magnitude_sq(a: Vec3): number {
    return Math.pow(a.x, 2) + Math.pow(a.y, 2) + Math.pow(a.w, 2);
}

export function vec_normalize(a: Vec3): Vec3 {
    return vec_div(a, vec_magnitude(a));
}

export function vec_dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.w * b.w;
}

export function mat2_mul(a: Mat2, scalar: number): Mat2 {
    return [
        [a[0][0] * scalar, a[0][1] * scalar],
        [a[1][0] * scalar, a[1][1] * scalar],
    ];
}

export function mat2_mul_mat2(a: Mat2, b: Mat2): Mat2 {
    return [
        [
            a[0][0] * b[0][0] + a[0][1] * b[1][0],
            a[0][0] * b[0][1] + a[0][1] * b[1][1],
        ],
        [
            a[1][0] * b[0][0] + a[1][1] * b[1][0],
            a[1][0] * b[0][1] + a[1][1] * b[1][1],
        ],
    ];
}

// 3x3 matrix (homogeneous coordinates) helpers for 2D affine transforms
export function mat3_identity(): Mat3 {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
}

export function mat3_equal(a: Mat3, b: Mat3) {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (a[i][j] !== b[i][j]) {
                return false;
            }
        }
    }
    return true;
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

export function scale(sx: number, sy?: number): Mat3 {
    const _sy = typeof sy === "number" ? sy : sx;
    return [
        [sx, 0, 0],
        [0, _sy, 0],
        [0, 0, 1],
    ];
}

/**
 * Shear in X and Y. shx is x shear (x' = x + shx * y). shy is y shear (y' = y + shy * x).
 */
export function shear(shx: number, shy: number): Mat3 {
    return [
        [1, shx, 0],
        [shy, 1, 0],
        [0, 0, 1],
    ];
}

export function mat3_mul_mat(a: Mat3, b: Mat3): Mat3 {
    const res: Mat3 = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
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

export function mat3_chain(matrices: Mat3[]): Mat3 {
    let ret = mat3_identity();
    for (let i = 0; i < matrices.length; i++) {
        ret = mat3_mul_mat(matrices[matrices.length - 1 - i], ret);
    }
    return ret;
}

export function mat3_mul(m: Mat3, scalar: number): Mat3 {
    const ret = [];
    for (let i = 0; i < 3; i++) {
        const row = [];
        for (let j = 0; j < 3; j++) {
            row.push(m[i][j] * scalar);
        }
        ret.push(row);
    }
    return ret;
}

/**
 * Apply a 3x3 affine matrix to a 2D vector (homogeneous coords).
 * Returns a Vector; if the resulting w is non-1, performs perspective divide.
 */
export function mat3_mul_vec(m: Mat3, v: Vec3): Vec3 {
    const x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.w;
    const y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.w;
    const w = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.w;
    return { x, y, w };
}

/**
 * Compute the inverse of a 3x3 matrix. Returns undefined if singular.
 */
export function mat3_inverse(m: Mat3): Mat3 | undefined {
    // Compute the determinant
    const a00 = m[0][0],
        a01 = m[0][1],
        a02 = m[0][2];
    const a10 = m[1][0],
        a11 = m[1][1],
        a12 = m[1][2];
    const a20 = m[2][0],
        a21 = m[2][1],
        a22 = m[2][2];

    const det =
        a00 * (a11 * a22 - a12 * a21) -
        a01 * (a10 * a22 - a12 * a20) +
        a02 * (a10 * a21 - a11 * a20);

    if (det === 0) return undefined;

    const invDet = 1 / det;

    // Compute adjugate (transpose of cofactor matrix)
    const b00 = (a11 * a22 - a12 * a21) * invDet;
    const b01 = -(a01 * a22 - a02 * a21) * invDet;
    const b02 = (a01 * a12 - a02 * a11) * invDet;

    const b10 = -(a10 * a22 - a12 * a20) * invDet;
    const b11 = (a00 * a22 - a02 * a20) * invDet;
    const b12 = -(a00 * a12 - a02 * a10) * invDet;

    const b20 = (a10 * a21 - a11 * a20) * invDet;
    const b21 = -(a00 * a21 - a01 * a20) * invDet;
    const b22 = (a00 * a11 - a01 * a10) * invDet;

    return [
        [b00, b01, b02],
        [b10, b11, b12],
        [b20, b21, b22],
    ];
}

export function mat_inverse(m: Mat2): Mat2 | undefined {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    const a: Mat2 = [
        [m[1][1], -m[0][1]],
        [-m[1][0], m[0][0]],
    ];
    return mat2_mul(a, 1 / det);
}
