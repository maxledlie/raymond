import {
    type Mat3,
    mat3_chain,
    mat3_identity,
    mat3_inverse,
    mat3_mul_mat,
    scale,
    translation,
    type Vec3,
} from "./math.js";
import Transform from "./transform.js";

export default class Camera {
    transform: Transform

    constructor(screenWidth: number, screenHeight: number) {
        this.transform = this._initialTransform(screenWidth, screenHeight);
    }

    _initialTransform(screenWidth: number, screenHeight: number): Transform {
        // Flip so y axis points upwards and stretch so each unit is much larger than one pixel.
        // Translate so origin is at centre of screen.
        const transform = new Transform();
        transform.scale(100, -100);
        transform.translate(screenWidth / 2, screenHeight / 2);
        return transform;
    }

    /**
     * Given a point in world space, returns the pixel coordinates at which it should appear on the screen.
     */
    worldToScreen(point: Vec3): Vec3 {
        return this.transform.apply(point);
    }

    /**
     * Given a point on the screen in pixel coordinates, returns the point in world space this represents.
     */
    screenToWorld(point: Vec3): Vec3 {
        return this.transform.applyInverse(point);
    }

    /**
     * Zooms the camera in or out.
     * @param fraction The fraction by which to zoom in or out. E.g. +0.1 zooms in 10%. -0.1 zooms out 10%.
     * @param invariantPoint Typically the mouse position. The point in screen space which should be unaffected by this zoom transformation.
     */
    zoom(fraction: number, invariantPoint: Vec3) {
        const invariantWorld = this.screenToWorld(invariantPoint);
        const trans = translation(invariantWorld.x, invariantWorld.y);
        const transInv = mat3_inverse(trans) ?? mat3_identity();
        const newMat = mat3_chain([this.transform.getMatrix(), trans, scale(1 - fraction), transInv]);
        this.transform.setMatrix(newMat);
    }

    /**
     * Pans the camera the given distance in screen space
     */
    pan(delta: Vec3) {
        this.transform.translate(delta.x, delta.y);
    }
}
