import "./CameraPanel.css";
import "../App.css";
import type { ChangeEvent } from "react";

export interface CameraPanelProps {
    transform: Transform;
    setTransform: (transform: Transform) => void;
}
export default function CameraPanel({
    transform,
    setTransform,
}: CameraPanelProps) {
    function setTransformValue(
        e: ChangeEvent<HTMLInputElement>,
        attr: keyof Transform,
        subAttr: keyof Vec2
    ) {
        const currentAttr = transform[attr] as Vec2;
        const newTransform = {
            ...transform,
            [attr]: {
                ...currentAttr,
                [subAttr]: parseFloat(e.target.value),
            },
        };
        setTransform(newTransform);
    }

    return (
        <div>
            <h2>Camera</h2>
            <form>
                <div className="form-field">
                    <label>
                        Location X{" "}
                        <input
                            type="number"
                            name="location X"
                            value={transform.translation.x}
                            step={1}
                            onChange={(e) =>
                                setTransformValue(e, "translation", "x")
                            }
                        ></input>
                    </label>
                </div>
                <div className="form-field">
                    <label>
                        Y{" "}
                        <input
                            type="number"
                            name="location Y"
                            value={transform.translation.y}
                            step={1}
                            onChange={(e) =>
                                setTransformValue(e, "translation", "y")
                            }
                        ></input>
                    </label>
                </div>
            </form>
        </div>
    );
}
