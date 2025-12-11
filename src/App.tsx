import { useEffect, useRef, useState } from "react";
import type { CameraSetup, Transform as UITransform } from "./uiTypes";
import {
    fromObjectTransform,
    toObjectTransform,
    type Transform,
} from "./transform";
import CameraPanel from "./components/CameraPanel";
import "./App.css";
import { RaymondCanvas } from "./canvas/raymondCanvas";
import { newPoint, newVector } from "./math";
import { Shape } from "./shapes";
import ObjectPanel from "./components/ObjectPanel";
import { PointLight } from "./canvas/PointLight";
import LightPanel from "./components/LightPanel";

function defaultTransform(): UITransform {
    return {
        scale: { x: 1, y: 1 },
        translation: { x: 0, y: 0 },
        rotation: 0,
    };
}

function defaultCameraSetup(): CameraSetup {
    return {
        center: { x: 0, y: 0 },
        rotation: 0,
        size: { x: 1, y: 1 },
    };
}

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [canvas, setCanvas] = useState<RaymondCanvas | null>(null);
    const [cameraTransform, setCameraTransform] =
        useState<UITransform>(defaultTransform);

    const [cameraSetup, setCameraSetup] =
        useState<CameraSetup>(defaultCameraSetup);

    const [selectedObject, setSelectedObject] = useState<Shape | null>(null);
    const [selectedLight, setSelectedLight] = useState<PointLight | null>(null);

    // Initialise the canvas once the DOM element is ready.
    // The canvas will independently draw its current state every frame, and update its current
    // state in response to DOM events on the canvas, like mouse clicks or movement.
    useEffect(() => {
        const canvasElement = canvasRef.current;
        if (!canvasElement) {
            throw Error("No canvas element found");
        }
        const c = new RaymondCanvas(canvasElement);
        c.start();
        setCanvas(c);
    }, []);

    // Once canvas is created, start a loop to periodically pull its state into React state
    useEffect(() => {
        if (!canvas) {
            return;
        }

        let cancelled = false;

        const loop = () => {
            if (cancelled || !canvas) {
                return;
            }
            const state = getCanvasState(canvas);
            setCameraTransform(state.cameraTransform);
            setCameraSetup(state.cameraSetup);
            setSelectedObject(state.selectedShape);
            setSelectedLight(state.selectedLight);
            window.setTimeout(loop, 1000 / 24);
        };
        loop();

        // Cleanup on unmount
        return () => {
            cancelled = true;
        };
    }, [canvas, setCameraTransform]);

    return (
        <div>
            {/* Main canvas */}
            <div
                style={{
                    position: "relative",
                    width: "100vw",
                    height: "100vh",
                }}
            >
                <canvas ref={canvasRef} tabIndex={1} />
            </div>

            {/* UI overlay */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    pointerEvents: "none",
                }}
            >
                {selectedObject && (
                    <div
                        className="ui-panel"
                        style={{
                            top: 0,
                            right: 0,
                            height: "50vh",
                        }}
                    >
                        <ObjectPanel
                            transform={serializeTransform(
                                selectedObject.transform
                            )}
                            setTransform={(t) => {
                                canvas?.setSelectedTransform(
                                    deserializeTransform(t)
                                );
                            }}
                            material={selectedObject.material}
                            setMaterial={(m) => canvas?.setSelectedMaterial(m)}
                        />
                    </div>
                )}
                {selectedLight && (
                    <div
                        className="ui-panel"
                        style={{
                            top: 0,
                            right: 0,
                            height: "50vh",
                        }}
                    >
                        <LightPanel
                            transform={serializeTransform(
                                selectedLight.transform
                            )}
                            setTransform={(t) =>
                                canvas?.setSelectedTransform(
                                    deserializeTransform(t)
                                )
                            }
                            color={selectedLight.color}
                            setColor={(c) => canvas?.setSelectedColor(c)}
                        />
                    </div>
                )}

                <div
                    className="ui-panel"
                    style={{
                        bottom: 0,
                        right: 0,
                        height: "50vh",
                    }}
                >
                    <CameraPanel
                        setup={cameraSetup}
                        setSetup={(setup) => {
                            setCameraSetup(setup);
                            canvas?.state.camera.setSetup({
                                center: newPoint(
                                    setup.center.x,
                                    setup.center.y
                                ),
                                rotation: setup.rotation,
                                size: newVector(setup.size.x, setup.size.y),
                            });
                        }}
                        transform={cameraTransform}
                        setTransform={(t) => {
                            setCameraTransform(t);
                            const transform = fromObjectTransform({
                                scale: newVector(t.scale.x, t.scale.y),
                                rotation: t.rotation,
                                translation: newVector(
                                    t.translation.x,
                                    t.translation.y
                                ),
                            });
                            canvas?.setCameraTransform(transform);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

interface CanvasState {
    cameraSetup: CameraSetup;
    cameraTransform: UITransform;
    selectedShape: Shape | null;
    selectedLight: PointLight | null;
}

function getCanvasState(canvas: RaymondCanvas): CanvasState {
    const {
        state: { camera },
    } = canvas;

    const selected = canvas.selectionLayer.getSelectedObject();

    return {
        cameraSetup: camera.getSetup(),
        cameraTransform: serializeTransform(camera.transform),
        selectedShape: selected instanceof Shape ? selected : null,
        selectedLight: selected instanceof PointLight ? selected : null,
    };
}

function serializeTransform(t: Transform): UITransform {
    const o = toObjectTransform(t);
    return {
        translation: {
            x: o.translation.x,
            y: o.translation.y,
        },
        rotation: o.rotation,
        scale: {
            x: o.scale.x,
            y: o.scale.y,
        },
    };
}

function deserializeTransform(t: UITransform): Transform {
    return fromObjectTransform({
        translation: newVector(t.translation.x, t.translation.y),
        rotation: t.rotation,
        scale: newVector(t.scale.x, t.scale.y),
    });
}

export default App;
