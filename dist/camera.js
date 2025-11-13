import { mat3_chain, mat3_identity, mat3_inverse, mat3_mul_mat, mat3_mul_vec, scale, translation } from "./math.js";
export default class Camera {
    constructor(screenWidth, screenHeight) {
        this.mat = this._initialTransform(screenWidth, screenHeight);
        this.inv = mat3_inverse(this.mat);
    }
    _initialTransform(screenWidth, screenHeight) {
        let transform = mat3_identity();
        // Flip so y axis points upwards and stretch so each unit is much larger than one pixel
        transform = mat3_mul_mat(scale(100, -100), transform);
        // Translate so origin is at centre of screen
        transform = mat3_mul_mat(translation(screenWidth / 2, screenHeight / 2), transform);
        return transform;
    }
    _setMatrix(mat) {
        this.mat = mat;
        this.inv = mat3_inverse(mat);
    }
    /**
     * Given a point in world space, returns the pixel coordinates at which it should appear on the screen.
     */
    worldToScreen(point) {
        return mat3_mul_vec(this.mat, point);
    }
    /**
     * Given a point on the screen in pixel coordinates, returns the point in world space this represents.
     */
    screenToWorld(point) {
        return mat3_mul_vec(this.inv, point);
    }
    /**
     * Zooms the camera in or out.
     * @param fraction The fraction by which to zoom in or out. E.g. +0.1 zooms in 10%. -0.1 zooms out 10%.
     * @param invariantPoint Typically the mouse position. The point in screen space which should be unaffected by this zoom transformation.
     */
    zoom(fraction, invariantPoint) {
        const invariantWorld = this.screenToWorld(invariantPoint);
        const trans = translation(invariantWorld.x, invariantWorld.y);
        const transInv = mat3_inverse(trans);
        const newMat = mat3_chain([this.mat, trans, scale(1 - fraction), transInv]);
        this._setMatrix(newMat);
    }
    /**
     * Pans the camera the given distance in screen space
     */
    pan(delta) {
        const newMat = mat3_mul_mat(translation(delta.x, delta.y), this.mat);
        this._setMatrix(newMat);
    }
}
