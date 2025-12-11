import "./CameraPanel.css";
import "../App.css";
import type { Transform, CameraSetup } from "../uiTypes";
import { FloatDisplay, VectorDisplay } from "./Inputs";

export interface CameraPanelProps {
    setup: CameraSetup;
    setSetup: (setup: CameraSetup) => void;
    transform: Transform;
    setTransform: (transform: Transform) => void;
}
export default function CameraPanel({
    setup,
    setSetup,
    transform,
    setTransform,
}: CameraPanelProps) {
    return <></>;
    return (
        <div>
            <h2>Camera</h2>
            <VectorDisplay
                name="Center"
                vector={setup.center}
                setVector={(v) => setSetup({ ...setup, center: v })}
            />
            <FloatDisplay
                name="Rotation"
                value={setup.rotation}
                setValue={(v) => setSetup({ ...setup, rotation: v })}
            />
            <VectorDisplay
                name="Size"
                vector={setup.size}
                setVector={(v) => setSetup({ ...setup, size: v })}
            />

            <hr></hr>
            <VectorDisplay
                name="Translation"
                vector={transform.translation}
                setVector={(v) =>
                    setTransform({ ...transform, translation: v })
                }
            />
            <FloatDisplay
                name="Rotation"
                value={transform.rotation}
                setValue={(v) => setTransform({ ...transform, rotation: v })}
                step={0.01}
            />
            <VectorDisplay
                name="Scale"
                vector={transform.scale}
                setVector={(v) => setTransform({ ...transform, scale: v })}
            />
        </div>
    );
}
