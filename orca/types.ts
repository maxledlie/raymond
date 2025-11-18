import { Vec3 } from "../math.js";

export interface Unit {
    position: Vec3;
    velocity: Vec3;
    radius: number;
    destination: Vec3 | null;
    speed: number;
    color: string;
}
