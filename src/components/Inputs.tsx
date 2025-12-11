import type { Vec2 } from "../uiTypes";

interface FloatDisplayProps {
    name: string;
    value: number;
    setValue: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
}
export function FloatDisplay({
    name,
    value,
    setValue,
    min,
    max,
    step,
}: FloatDisplayProps) {
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
                        onChange={(e) => {
                            let val = parseFloat(e.target.value);
                            if (min != null) {
                                val = Math.max(min, val);
                            }
                            if (max != null) {
                                val = Math.min(max, val);
                            }
                            setValue(val);
                        }}
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
export function VectorDisplay({ name, vector, setVector }: VectorDisplayProps) {
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
