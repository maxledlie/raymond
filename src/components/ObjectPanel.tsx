import "../App.css";
import type { Material } from "../shared/material";
import type { Transform } from "../uiTypes";
import ColorPicker from "./ColorPicker";
import { FloatDisplay, VectorDisplay } from "./Inputs";

export interface ObjectPanelProps {
    transform: Transform;
    setTransform: (transform: Transform) => void;
    material: Material;
    setMaterial: (material: Material) => void;
}
export default function ObjectPanel({
    transform,
    setTransform,
    material,
    setMaterial,
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
            <h3>Material</h3>
            <ColorPicker
                color={material.color}
                setColor={(c) => setMaterial({ ...material, color: c })}
            />
            <FloatDisplay
                name="Reflectivity"
                min={0}
                max={1}
                step={0.05}
                value={material.reflectivity}
                setValue={(v) => setMaterial({ ...material, reflectivity: v })}
            />
            <FloatDisplay
                name="Transparency"
                min={0}
                max={1}
                step={0.05}
                value={material.transparency}
                setValue={(v) => setMaterial({ ...material, transparency: v })}
            />
            <FloatDisplay
                name="Refractive Index"
                min={0.1}
                max={2.5}
                step={0.05}
                value={material.refractiveIndex}
                setValue={(v) =>
                    setMaterial({ ...material, refractiveIndex: v })
                }
            />
            <FloatDisplay
                name="Ambient"
                min={0}
                max={1}
                step={0.05}
                value={material.ambient}
                setValue={(v) => setMaterial({ ...material, ambient: v })}
            />
            <FloatDisplay
                name="Diffuse"
                min={0}
                max={1}
                step={0.05}
                value={material.diffuse}
                setValue={(v) => setMaterial({ ...material, diffuse: v })}
            />
            <FloatDisplay
                name="Specular"
                min={0}
                max={1}
                step={0.05}
                value={material.specular}
                setValue={(v) => setMaterial({ ...material, specular: v })}
            />
            <FloatDisplay
                name="Shininess"
                min={0}
                max={400}
                step={10}
                value={material.shininess}
                setValue={(v) => setMaterial({ ...material, shininess: v })}
            />
        </div>
    );
}
