import {
    mat3_chain,
    mat3_identity,
    mat3_inverse,
    newPoint,
    newVector,
    vec_magnitude,
    vec_sub,
    type Vec3,
} from "./math.js";
import {
    type Transform,
    apply,
    inverse,
    fromObjectTransform,
    rotation,
    scaling,
    toObjectTransform,
    translation,
    translateObject,
} from "./transform.js";

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
        return fromObjectTransform({
            scale: newVector(100, -100),
            rotation: 0,
            translation: newVector(screenWidth / 2, screenHeight / 2),
        });
    }

    /**
     * Given a point in world space, returns the pixel coordinates at which it should appear on the screen.
     */
    worldToScreen(point: Vec3): Vec3 {
        return apply(this.transform, point);
    }

    setSetup(s: CameraSetup) {
        // Guard against nonsense sizes
        if (s.size.x === 0 || s.size.y === 0) {
            return;
        }

        // --- 1. Choose scale (pixels per world unit) ---
        // We keep *uniform* scale so the camera doesn't shear.
        // This assumes s.size keeps the same aspect ratio as the screen
        // (which getSetup always does).

        const sx = this.screenWidth / s.size.x;
        const sy = -this.screenHeight / s.size.y;

        // --- 2. World→screen rotation ---
        // Camera rotation is opposite the world→screen rotation.
        const worldToScreenRotation = s.rotation;

        // --- 3. Build the matrix: M = T_screenCenter * R * S * T(-center) ---
        const screenCenter = translation(
            this.screenWidth / 2,
            this.screenHeight / 2
        );

        const moveWorldCenterToOrigin = translation(-s.center.x, -s.center.y);

        const rot = rotation(worldToScreenRotation);
        const scl = scaling(sx, sy);

        const mat = mat3_chain([
            screenCenter, // move origin to screen centre
            rot, // rotate world to screen orientation
            scl, // scale world units → pixels (and flip Y)
            moveWorldCenterToOrigin, // put camera centre at origin first
        ]);

        this.transform = mat;
    }

    getSetup(): CameraSetup {
        const centerScreen = newPoint(
            this.screenWidth / 2,
            this.screenHeight / 2
        );
        const centerWorld = apply(inverse(this.transform), centerScreen);
        const { rotation } = toObjectTransform(this.transform);

        const topLeftWorld = apply(inverse(this.transform), newPoint(0, 0));
        const topRightWorld = apply(
            inverse(this.transform),
            newPoint(this.screenWidth, 0)
        );
        const width = vec_magnitude(vec_sub(topRightWorld, topLeftWorld));

        const bottomLeftWorld = apply(
            inverse(this.transform),
            newPoint(0, this.screenHeight)
        );
        const height = vec_magnitude(vec_sub(bottomLeftWorld, topLeftWorld));

        return {
            center: centerWorld,
            rotation: rotation,
            size: newVector(width, height),
        };
    }

    /**
     * Given a point on the screen in pixel coordinates, returns the point in world space this represents.
     */
    screenToWorld(point: Vec3): Vec3 {
        return apply(inverse(this.transform), point);
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
        this.transform = mat3_chain([
            this.transform,
            trans,
            scaling(1 - fraction),
            transInv,
        ]);
    }

    /**
     * Pans the camera the given distance in screen space
     */
    pan(delta: Vec3) {
        this.transform = translateObject(this.transform, delta);
    }
}
