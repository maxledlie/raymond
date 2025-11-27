export interface Vec2 {
    x: number;
    y: number;
}

export interface CameraSetup {
    center: Vec2;
    rotation: number;
    size: Vec2;
}

export interface Transform {
    scale: Vec2;
    rotation: number;
    translation: Vec2;
}
