import {
    mat3_chain,
    mat3_identity,
    mat3_inverse,
    newPoint,
    newVector,
    scale,
    translation,
    vec_magnitude,
    vec_sub,
    type Vec3,
} from "./math.js";
import Transform from "./transform.js";

/* Describes the position, size and orientation of the viewport in world space */
export interface CameraSetup {
    center: Vec3;
    size: Vec3;
    rotation: number;
}

export default class Camera {
    screenWidth: number;
    screenHeight: number;
    transform: Transform;

    constructor(screenWidth: number, screenHeight: number) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
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
    
    getSetup(): CameraSetup {
        const centerScreen = newPoint(
            this.screenWidth / 2,
            this.screenHeight / 2
        );
        const centerWorld = this.transform.applyInverse(centerScreen);
        const rotation = -this.transform._rotation;

        const topLeftWorld = this.transform.applyInverse(newPoint(0, 0));
        const topRightWorld = this.transform.applyInverse(
            newPoint(this.screenWidth, 0)
        );
        const width = vec_magnitude(vec_sub(topRightWorld, topLeftWorld));

        const bottomLeftWorld = this.transform.applyInverse(
            newPoint(0, this.screenHeight)
        );
        const height = vec_magnitude(vec_sub(bottomLeftWorld, topLeftWorld));

        return {
            center: centerWorld,
            rotation,
            size: newVector(width, height),
        };
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
        const newMat = mat3_chain([
            this.transform.getMatrix(),
            trans,
            scale(1 - fraction),
            transInv,
        ]);
        this.transform.setMatrix(newMat);
    }

    /**
     * Pans the camera the given distance in screen space
     */
    pan(delta: Vec3) {
        this.transform.translate(delta.x, delta.y);
    }
}
