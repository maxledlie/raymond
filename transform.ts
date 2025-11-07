import { mat3_chain, mat3_inverse, mat3_mul_vec, rotation, translation, scale, Vector } from "./math.js";

export default class Transform {
    _rotation: number = 0;
    _scale: Vector = { x: 1, y: 1 };
    _translation: Vector = { x: 0, y: 0 };

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

    apply(v: Vector): Vector {
        const mat = mat3_chain([
            translation(this._translation.x, this._translation.y),
            rotation(this._rotation),
            scale(this._scale.x, this._scale.y)
        ]);
        return mat3_mul_vec(mat, v);
    }

    applyInverse(v: Vector): Vector {
        const mat = mat3_chain([
            translation(this._translation.x, this._translation.y),
            rotation(this._rotation),
            scale(this._scale.x, this._scale.y)
        ]);
        const inv = mat3_inverse(mat);
        return mat3_mul_vec(inv, v);
    }
}