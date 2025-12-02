import "../App.css";
import type { Transform, Vec2 } from "../uiTypes";

export interface ObjectPanelProps {
    transform: Transform;
    setTransform: (transform: Transform) => void;
}
export default function ObjectPanel({
    transform,
    setTransform,
}: ObjectPanelProps) {
    return (
        <div>
            <h2>Selected Object</h2>
            <VectorDisplay
                name="Position"
                vector={transform.translation}
                setVector={(v) =>
                    setTransform({ ...transform, translation: v })
                }
            />
            <FloatDisplay
                name="Rotation"
                value={transform.rotation}
                setValue={(v) => setTransform({ ...transform, rotation: v })}
            />
            <VectorDisplay
                name="Scale"
                vector={transform.scale}
                setVector={(v) => setTransform({ ...transform, scale: v })}
            />
        </div>
    );
}

interface FloatDisplayProps {
    name: string;
    value: number;
    setValue: (v: number) => void;
    step?: number;
}
function FloatDisplay({ name, value, setValue, step }: FloatDisplayProps) {
    return (
        <div style={{ margin: "6px" }}>
            <div className="form-field">
                <label>
                    {name}
                    <input
                        type="number"
                        name={`${name} x`}
                        value={truncateFloat(value, 2)}
                        step={step ?? 0.01}
                        onChange={(e) => setValue(parseFloat(e.target.value))}
                    ></input>
                </label>
            </div>
        </div>
    );
}

interface VectorDisplayProps {
    name: string;
    vector: Vec2;
    setVector: (v: Vec2) => void;
}
function VectorDisplay({ name, vector, setVector }: VectorDisplayProps) {
    return (
        <div style={{ margin: "6px" }}>
            <div className="form-field">
                <label>
                    {name} X{" "}
                    <input
                        type="number"
                        name={`${name} x`}
                        value={truncateFloat(vector.x, 2)}
                        step={1}
                        onChange={(e) =>
                            setVector({
                                x: parseFloat(e.target.value),
                                y: vector.y,
                            })
                        }
                    ></input>
                </label>
            </div>
            <div className="form-field">
                <label>
                    Y{" "}
                    <input
                        type="number"
                        name={`${name} y`}
                        value={truncateFloat(vector.y, 2)}
                        step={1}
                        onChange={(e) =>
                            setVector({
                                x: vector.x,
                                y: parseFloat(e.target.value),
                            })
                        }
                    ></input>
                </label>
            </div>
        </div>
    );
}

function truncateFloat(n: number, numDecimalPlaces: number): number {
    return (
        Math.round(n * Math.pow(10, numDecimalPlaces)) /
        Math.pow(10, numDecimalPlaces)
    );
}
