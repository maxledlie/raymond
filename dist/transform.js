import { mat3_chain, mat3_inverse, mat3_mul_vec, rotation, translation, scale, newVector, mat3_transpose } from "./math.js";
export default class Transform {
    constructor() {
        this._rotation = 0;
        this._scale = newVector(1, 1);
        this._translation = newVector(0, 0);
    }
    rotate(theta) {
        this._rotation += theta;
    }
    scale(x, y) {
        const _y = y !== null && y !== void 0 ? y : x;
        this._scale.x *= x;
        this._scale.y *= _y;
    }
    translate(x, y) {
        this._translation.x += x;
        this._translation.y += y;
    }
    _matrix() {
        return mat3_chain([
            translation(this._translation.x, this._translation.y),
            rotation(this._rotation),
            scale(this._scale.x, this._scale.y)
        ]);
    }
    apply(v) {
        return mat3_mul_vec(this._matrix(), v);
    }
    applyTranspose(v) {
        const mat = this._matrix();
        const transpose = mat3_transpose(mat);
        return mat3_mul_vec(transpose, v);
    }
    applyInverse(v) {
        const mat = this._matrix();
        const inv = mat3_inverse(mat);
        return inv ? mat3_mul_vec(inv, v) : v;
    }
    applyInverseTranspose(v) {
        const mat = this._matrix();
        const inv = mat3_inverse(mat);
        if (!inv) {
            return v;
        }
        const inv_transpose = mat3_transpose(inv);
        return mat3_mul_vec(inv_transpose, v);
    }
}
