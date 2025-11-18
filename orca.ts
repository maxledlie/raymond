import Camera from "./camera.js";
import { newPoint, newVector, Vec3, vec_add, vec_magnitude, vec_magnitude_sq, vec_mul, vec_normalize, vec_sub } from "./math.js";
import { computeNewVelocity, computeOrcaLines, Line } from "./orca/Simulator.js";
import { Unit } from "./orca/types.js";
import Transform from "./transform.js";

interface Scenario {
    // A loadable game state
    name: string,
    units: () => Unit[],
}

interface State {
    units: Unit[];
    camera: Camera;
    mousePosScreen: Vec3;
    panStart: Vec3 | null;
    hasLogged: boolean;
};

const state: State = {
    units: [],
    camera: new Camera(0, 0),
    mousePosScreen: newPoint(0, 0),
    panStart: null,
    hasLogged: false
};

function unitsAroundCircle(): Unit[] {
    const nUnits = 20;
    const radius = 4;
    const dTheta = 2 * Math.PI / nUnits;
    const origin = newPoint(0, 0);
    const units = [];
    for (let i = 0; i < nUnits; i++) {
        const theta = i * dTheta;
        const vec = newVector(radius * Math.cos(theta), radius * Math.sin(theta));
        const position = vec_add(origin, vec);
        const destination = vec_sub(origin, vec);
        const velocity = newVector(0, 0);

        // Generate a random color for the unit
        const r = 55 + Math.random() * 200;
        const g = 55 + Math.random() * 200;
        const b = 55 + Math.random() * 200;
        units.push({ position, destination, velocity, radius: 0.1, speed: 0.001, color: `rgb(${r}, ${g}, ${b})` });
    }
    return units;
}

const FRAMERATE = 60;

const scenarios: Scenario[] = [
    {
        name: "circle",
        units: unitsAroundCircle
    }
]

function init() {
    state.units = scenarios[0].units();
}

function draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    // Assuming the target framerate is always reached for now.
    const dt = 1000 / FRAMERATE;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    // Find the new state of all units
    updateSimple(state.units, dt);

    drawCoordinates(ctx, new Transform(), "rgb(100 100 100 / 80%)", "rgb(100 100 100 / 80%)", 100);

    for (const unit of state.units) {
        // Draw current position
        ctx.fillStyle = unit.color;
        const centre = state.camera.worldToScreen(unit.position);
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, 10, 0, 2 * Math.PI);
        ctx.fill();

        // Draw destination
        if (unit.destination) {
            ctx.strokeStyle = unit.color;
            const dest = state.camera.worldToScreen(unit.destination);
            ctx.beginPath();
            ctx.arc(dest.x, dest.y, 10, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }
    
    window.setTimeout(() => draw(canvas, ctx), 1000 / FRAMERATE);
}

/** Draws a line described in world space using the current camera transform and canvas drawing state */
function drawLine(ctx: CanvasRenderingContext2D, start: Vec3, end: Vec3) {
    const startScreen = state.camera.worldToScreen(start);
    const endScreen = state.camera.worldToScreen(end);
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();
}

/**
 * Given a `transform` that maps points from one space to another, draws the coordinates
 * of this new space.
 */
function drawCoordinates(ctx: CanvasRenderingContext2D, transform: Transform, majorColor: string, minorColor: string, gridSize: number) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = minorColor;
    for (let i = -gridSize; i <= gridSize; i++) {
        const xStartWorld = transform.apply(newPoint(i, -gridSize));
        const xEndWorld = transform.apply(newPoint(i, gridSize));
        drawLine(ctx, xStartWorld, xEndWorld);

        const yStartWorld = transform.apply(newPoint(-gridSize, i));
        const yEndWorld = transform.apply(newPoint(gridSize, i));
        drawLine(ctx, yStartWorld, yEndWorld);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = majorColor;
    const xAxisEndLocal = newPoint(gridSize, 0);
    const yAxisEndLocal = newPoint(0, gridSize);
    const yAxisStartWorld = transform.apply(newPoint(0, -gridSize));
    const yAxisEndWorld = transform.apply(yAxisEndLocal);
    const xAxisStartWorld = transform.apply(newPoint(-gridSize, 0));
    const xAxisEndWorld = transform.apply(xAxisEndLocal);
    drawLine(ctx, yAxisStartWorld, yAxisEndWorld);
    drawLine(ctx, xAxisStartWorld, xAxisEndWorld);

    // Arrow heads indicating direction of axes
    const yAxisLeftLocal = vec_add(yAxisEndLocal, newVector(-0.1, -0.1));
    const yAxisRightLocal = vec_add(yAxisEndLocal, newVector(0.1, -0.1));
    const yAxisLeftWorld = transform.apply(yAxisLeftLocal);
    const yAxisRightWorld = transform.apply(yAxisRightLocal);
    drawLine(ctx, yAxisEndWorld, yAxisLeftWorld);
    drawLine(ctx, yAxisEndWorld, yAxisRightWorld);

    const xAxisLeftLocal = vec_add(xAxisEndLocal, newVector(-0.1, 0.1));
    const xAxisRightLocal = vec_add(xAxisEndLocal, newVector(-0.1, -0.1));
    const xAxisLeftWorld = transform.apply(xAxisLeftLocal);
    const xAxisRightWorld = transform.apply(xAxisRightLocal);
    drawLine(ctx, xAxisEndWorld, xAxisLeftWorld);
    drawLine(ctx, xAxisEndWorld, xAxisRightWorld);
}

function handleResize(canvas: HTMLCanvasElement) {
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;
    state.camera = new Camera(canvas.width, canvas.height);
}

function handleWheel(e: WheelEvent) {
    const zoomSpeed = 0.0001
    const zoomFrac = zoomSpeed * e.deltaY;
    state.camera.zoom(zoomFrac, state.mousePosScreen);
}

function handleMouseDown(e: MouseEvent) {
    if (e.button === 1) {
        state.panStart = state.mousePosScreen;
    }
}

function handleMouseMove(e: MouseEvent) {
    const lastMousePos = state.mousePosScreen;

    // Track mouse position
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    state.mousePosScreen = newPoint(x, y);

    // Handle panning
    if (state.panStart != null) {
        const mouseDelta = vec_sub(state.mousePosScreen, lastMousePos);
        state.camera.pan(mouseDelta);
    }
}

function handleMouseUp(e: MouseEvent) {
    state.panStart = null;
}

// Get HTML canvas to draw on
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.onwheel = (e: WheelEvent) => handleWheel(e);
canvas.onmousemove = (e: MouseEvent) => handleMouseMove(e);
canvas.onmousedown = (e: MouseEvent) => handleMouseDown(e);
canvas.onmouseup = (e: MouseEvent) => handleMouseUp(e);

// Set canvas coordinates equal to pixel coordinates, and do this again on each resize.
canvas.onresize = () => handleResize(canvas);
handleResize(canvas);


init();
draw(canvas, ctx);


// ------------------------
// Pathfinding logic
// ------------------------

function updateSimple(units: Unit[], dt: number) {
    // Simplest reasonable policy. Just move every unit towards its destination at a constant pace, then
    // stop once it's reached.
    for (const u of units) {
        if (u.destination == null) {
            continue;
        }
        const delta = vec_sub(u.destination, u.position);
        const direction = vec_normalize(delta);
        u.velocity = vec_mul(direction, u.speed);
    }

    // ORCA magic
    const u0 = units[0];
    const orcaLines = computeOrcaLines(u0, units.slice(1));
    
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.lineWidth = 2;

    for(let line of orcaLines) {
        const startWorld = vec_mul(line.point, 1);
        const endWorld = vec_add(line.point, line.direction);
        drawLine(ctx, startWorld, endWorld)
    }

    if (!state.hasLogged) {
        for (const line of orcaLines) {
            const startWorld = vec_mul(line.point, 11);
            const endWorld = vec_add(line.point, line.direction);
            console.log("startWorld: ", startWorld);
            console.log("endWorld: ", endWorld);
        }
        state.hasLogged = true;
    }

    // Update positions based on velocities
    for (const u of units) {
        u.position = vec_add(u.position, vec_mul(u.velocity, dt))
    }
}


function updateRVO2(units: Unit[], dt: number) {
    for (let i = 0; i < units.length; i++) {
        // Later, use a KD tree to only find nearby neighbours for efficiency.
        const neighbours = [...units];
        neighbours.splice(i, 1);
        const newVel = computeNewVelocity(units[i], neighbours);
        units[i].velocity = newVel;
    }
}
