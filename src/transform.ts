import {
    mat3_chain,
    mat3_inverse,
    mat3_mul_vec,
    rotation,
    translation,
    scale,
    type Vec3,
    newVector,
    type Mat3,
    mat3_transpose,
} from "./math.js";

export default class Transform {
    _rotation: number = 0;
    _scale: Vec3 = newVector(1, 1);
    _translation: Vec3 = newVector(0, 0);

    rotate(theta: number) {
        this._rotation += theta;
    }

    scale(x: number, y?: number) {
        const _y = y ?? x;
        this._scale.x *= x;
        this._scale.y *= _y;
    }

    translate(x: number, y: number) {
        this._translation.x += x;
        this._translation.y += y;
    }

    setMatrix(matrix: Mat3) {
        const [a, b, tx] = [...matrix[0]];
        const [c, d, ty] = [...matrix[1]];

        // Extract translation, scale and rotation of new matrix
        this._rotation = Math.atan2(c, a);

        const scaleX = Math.sqrt(a * a + c * c);
        const scaleY = (a * d - b * c) / scaleX;
        this._scale = newVector(scaleX, scaleY);

        this._translation = newVector(tx, ty);
    }

    getMatrix(): Mat3 {
        return mat3_chain([
            translation(this._translation.x, this._translation.y),
            rotation(this._rotation),
            scale(this._scale.x, this._scale.y),
        ]);
    }

    apply(v: Vec3): Vec3 {
        return mat3_mul_vec(this.getMatrix(), v);
    }

    applyTranspose(v: Vec3): Vec3 {
        const mat = this.getMatrix();
        const transpose = mat3_transpose(mat);
        return mat3_mul_vec(transpose, v);
    }

    applyInverse(v: Vec3): Vec3 {
        const mat = this.getMatrix();
        const inv = mat3_inverse(mat);
        return inv ? mat3_mul_vec(inv, v) : v;
    }

    applyInverseTranspose(v: Vec3): Vec3 {
        const mat = this.getMatrix();
        const inv = mat3_inverse(mat);
        if (!inv) {
            return v;
        }

        const inv_transpose = mat3_transpose(inv);
        return mat3_mul_vec(inv_transpose, v);
    }
}
