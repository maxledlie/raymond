export interface Vector {
    x: number;
    y: number;
}

export type Mat2 = number[][];

export function vec_add(a: Vector, b: Vector): Vector {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function vec_sub(a: Vector, b: Vector): Vector {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function vec_mul(a: Vector, scalar: number): Vector {
    return { x: a.x * scalar, y: a.y * scalar };
}

export function vec_div(a: Vector, scalar: number): Vector {
    return { x: a.x / scalar, y: a.y / scalar };
}

export function vec_magnitude(a: Vector): number {
    return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2));
}

export function vec_normalize(a: Vector): Vector {
    return vec_div(a, vec_magnitude(a));
}

export function mat_mul(a: Mat2, scalar: number): Mat2 {
    return [
        [ a[0][0] * scalar, a[0][1] * scalar ],
        [ a[1][0] * scalar, a[1][1] * scalar ]
    ];
}

export function mat_mul_vec(a: Mat2, v: Vector | Vector): Vector | Vector {
    return { 
        x: a[0][0] * v.x + a[0][1] * v.y,
        y: a[1][0] * v.x + a[1][1] * v.y
    };
}

export function mat_inverse(m: Mat2): Mat2 | undefined {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    const a: Mat2 = [
        [ m[1][1], -m[0][1] ],
        [ -m[1][0], m[0][0] ]
    ];
    return mat_mul(a, 1 / det);
}
    