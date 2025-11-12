import { Vec3 } from "./math";
import Transform from "./transform";

export interface Ray {
    start: Vec3;
    direction: Vec3;
}

export interface Laser {
    type: "laser";
    transform: Transform;  // Maps a point from the laser's local space to world space
}
