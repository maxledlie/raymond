import "../App.css";
import type { Color } from "../shared/color";
import type { Transform } from "../uiTypes";
import ColorPicker from "./ColorPicker";
import { VectorDisplay } from "./Inputs";

export interface LightPanelProps {
    transform: Transform;
    setTransform: (transform: Transform) => void;
    color: Color;
    setColor: (c: Color) => void;
}
export default function LightPanel({
    transform,
    setTransform,
    color,
    setColor,
}: LightPanelProps) {
    return (
        <div>
            <h2>Selected Light</h2>
            <VectorDisplay
                name="Position"
                vector={transform.translation}
                setVector={(v) =>
                    setTransform({ ...transform, translation: v })
                }
            />
            <ColorPicker color={color} setColor={setColor} />
        </div>
    );
}
