import { type Color } from "../shared/color";

export interface ColorPickerProps {
    color: Color;
    setColor: (c: Color) => void;
}
export default function ColorPicker({ color, setColor }: ColorPickerProps) {
    return (
        <label>
            R{" "}
            <input
                type="number"
                min={0}
                max={255}
                step={1}
                value={color.r * 255}
                onChange={(e) =>
                    setColor({ ...color, r: parseFloat(e.target.value) / 255 })
                }
            />
            G{" "}
            <input
                type="number"
                min={0}
                max={255}
                step={1}
                value={color.g * 255}
                onChange={(e) =>
                    setColor({ ...color, g: parseFloat(e.target.value) / 255 })
                }
            />
            B{" "}
            <input
                type="number"
                min={0}
                max={255}
                step={1}
                value={color.b * 255}
                onChange={(e) =>
                    setColor({ ...color, b: parseFloat(e.target.value) / 255 })
                }
            />
        </label>
    );
}
