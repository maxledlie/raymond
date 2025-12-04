import {
    mat3_chain,
    mat3_identity,
    mat3_inverse,
    newVector,
    vec_add,
    vec_mul,
    type Vec3,
} from "./math.js";
import {
    type Transform,
    apply,
    inverse,
    fromObjectTransform,
    scaling,
    translation,
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
        const cos = Math.cos(s.rotation);
        const sin = Math.sin(s.rotation);

        // scale from world-units-in-camera-space to pixels
        const sx = this.screenWidth / s.size.x; // world width -> viewport width
        const sy = this.screenHeight / s.size.y; // world height -> viewport height

        const m00 = sx * cos;
        const m01 = sx * sin;
        const m02 = -s.center.x * m00 - s.center.y * m01 + this.screenWidth / 2;

        const m10 = sy * sin;
        const m11 = -sy * cos; // minus to flip Y so screen y is down
        const m12 =
            -s.center.x * m10 - s.center.y * m11 + this.screenHeight / 2;

        this.transform = [
            [m00, m01, m02],
            [m10, m11, m12],
            [0, 0, 1],
        ];
    }

    getSetup(): CameraSetup {
        const [[m00, m01, m02], [m10, m11, m12], [_m20, _m21, _m22]] =
            this.transform;

        // Extract scales (sx, sy) from the rotation+scale part.
        const sx = Math.hypot(m00, m01); // = viewportWidth / size.x
        const sy = Math.hypot(m10, m11); // = viewportHeight / size.y

        if (sx === 0 || sy === 0) {
            throw new Error("Non-invertible camera matrix: zero scale.");
        }

        // Recover rotation.
        const rotation = Math.atan2(m01, m00);

        // Recover size from scales.
        const sizeX = this.screenWidth / sx;
        const sizeY = this.screenHeight / sy;

        // Solve for center:
        const b0 = this.screenWidth / 2 - m02;
        const b1 = this.screenHeight / 2 - m12;

        const det = m00 * m11 - m01 * m10;
        const eps = 1e-12;
        if (Math.abs(det) < eps) {
            throw new Error(
                "Non-invertible camera matrix: rotation/scale block is singular."
            );
        }

        const cx = (b0 * m11 - b1 * m01) / det;
        const cy = (m00 * b1 - m10 * b0) / det;

        return {
            center: { x: cx, y: cy, w: 1 },
            size: { x: sizeX, y: sizeY, w: 0 },
            rotation,
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
        const deltaWorld = this.screenToWorld(vec_mul(delta, -1));
        const setup = this.getSetup();
        this.setSetup({ ...setup, center: vec_add(setup.center, deltaWorld) });
    }

    static interpSetup(a: CameraSetup, b: CameraSetup, x: number): CameraSetup {
        // Clamp x to [0, 1]
        const t = Math.max(0, Math.min(1, x));

        // Decompose both cameras into CameraSetup parameters

        // Interpolate rotation safely (optionally handle wrap-around)
        let dRot = b.rotation - a.rotation;
        // Wrap shortest path around ±π
        if (dRot > Math.PI) dRot -= 2 * Math.PI;
        else if (dRot < -Math.PI) dRot += 2 * Math.PI;

        const rotation = a.rotation + t * dRot;

        // Interpolate position and size
        const center = {
            x: a.center.x + t * (b.center.x - a.center.x),
            y: a.center.y + t * (b.center.y - a.center.y),
            w: 1,
        };
        const size = {
            x: a.size.x + t * (b.size.x - a.size.x),
            y: a.size.y + t * (b.size.y - a.size.y),
            w: 0,
        };

        return { center, size, rotation };
    }
}
