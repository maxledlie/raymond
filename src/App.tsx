import { useEffect, useRef, useState } from "react";
import type { Transform as UITransform } from "./uiTypes";
import Transform from "./transform";
import CameraPanel from "./components/CameraPanel";
import "./App.css";
import { RaymondCanvas } from "./canvas/raymondCanvas";

function defaultTransform(): Transform {
    return {
        scale: { x: 1, y: 1 },
        translation: { x: 0, y: 0 },
        rotation: 0,
    };
}

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [canvas, setCanvas] = useState<RaymondCanvas | null>(null);
    const [cameraTransform, setCameraTransform] =
        useState<Transform>(defaultTransform);

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
                <div
                    className="ui-panel"
                    style={{
                        position: "fixed",
                        bottom: 0,
                        right: 0,
                        height: "50vh",
                        maxWidth: "100vw",
                        textAlign: "right",
                        pointerEvents: "auto",
                    }}
                >
                    {/*
                    <CameraPanel
                        transform={cameraTransform}
                        setTransform={(t) => {
                            setCameraTransform(t);
                            canvas?.setCameraTransform(t);
                        }}
                    />
                    */}
                </div>
            </div>
        </div>
    );
}

export default App;
