import { mat3_chain, mat3_inverse, mat3_mul_vec, rotation, translation, scale, Vec3, newPoint, newVector, Mat3, mat3_transpose } from "./math.js";

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

    _matrix(): Mat3 {
        return mat3_chain([
            translation(this._translation.x, this._translation.y),
            rotation(this._rotation),
            scale(this._scale.x, this._scale.y)
        ]);
    }

    apply(v: Vec3): Vec3 {
        return mat3_mul_vec(this._matrix(), v);
    }

    applyTranspose(v: Vec3): Vec3 {
        const mat = this._matrix();
        const transpose = mat3_transpose(mat);
        return mat3_mul_vec(transpose, v);
    }

    applyInverse(v: Vec3): Vec3 {
        const mat = this._matrix();
        const inv = mat3_inverse(mat);
        return inv ? mat3_mul_vec(inv, v) : v;
    }

    applyInverseTranspose(v: Vec3): Vec3 {
        const mat = this._matrix();
        const inv = mat3_inverse(mat);
        if (!inv) {
            return v;
        }

        const inv_transpose = mat3_transpose(inv);
        return mat3_mul_vec(inv_transpose, v);
    }
}