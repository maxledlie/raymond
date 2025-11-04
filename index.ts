import { Vector, Mat2, vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";

interface Ray {
    start: Vector;
    direction: Vector;
}

interface LineSegment {
    start: Vector;
    end: Vector;
}

interface Node {
    id: number;
    point: Vector;
}

interface Edge {
    from: number;
    to: number;
}


type EditMode = "laser" | "mirror"


interface State {
    debug: boolean;
    placementStart: Vector | null;
    editMode: EditMode;
    rays: Ray[];
    mirrors: LineSegment[];
}

const state: State = {
    debug: false,
    placementStart: null,
    editMode: "laser",
    rays: [],
    mirrors: []
};

function p5_setup(p: p5) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}

function p5_draw(p: p5) {
    p.background("black");
    p.stroke("white");
    p.fill("white");
    p.noStroke();
    p.text(state.editMode == "laser" ? "> draw laser (L)" : "  draw laser (L)", 10, 20);
    p.text(state.editMode == "mirror" ? "> draw mirror (M)" : "  draw mirror (M)", 10, 40);

    p.stroke("yellow");
    for (const ray of state.rays) {
        // Find end point of line very far along the direction from mouse start to mouse end
        const endPoint = vec_add(ray.start, vec_mul(ray.direction, 10000));
        p.line(ray.start.x, ray.start.y, endPoint.x, endPoint.y);
    }

    p.stroke("lightblue");
    for (const { start, end } of state.mirrors) {
        p.line(start.x, start.y, end.x, end.y);
    }
    
    if (state.placementStart) {
        if (state.editMode == "laser") {
            p.stroke("yellow");
            const ray = drawnRay(p);
            // Find end point of line very far along the direction from mouse start to mouse end
            const endPoint = vec_add(ray.start, vec_mul(ray.direction, 10000));
            p.line(ray.start.x, ray.start.y, endPoint.x, endPoint.y);
        } else if (state.editMode == "mirror") {
            p.stroke("lightblue");
            p.line(state.placementStart.x, state.placementStart.y, p.mouseX, p.mouseY);
        }
    }
}

function drawnRay(p: p5): Ray {
    const mouse = { x: p.mouseX, y: p.mouseY };
    const direction = vec_normalize(vec_sub(mouse, state.placementStart));
    return { start: state.placementStart, direction };
}

function p5_mouse_pressed(p: p5) {
    state.placementStart = { x: p.mouseX, y: p.mouseY };
}

function p5_key_pressed(p: p5) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
    if (p.key == "l" || p.key == "L") {
        state.editMode = "laser";
    }
    if (p.key == "m" || p.key == "M") {
        state.editMode = "mirror";
    }
}

function p5_mouse_released(p: p5) {
    if (state.placementStart) {
        if (state.editMode == "laser") {
            const ray = drawnRay(p);
            state.rays.push(ray);
        } else if (state.editMode == "mirror") {
            state.mirrors.push({ start: state.placementStart, end: { x: p.mouseX, y: p.mouseY }});
        }
    }
    state.placementStart = null;
}

const s = (p: p5) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.keyPressed = () => p5_key_pressed(p);
    p.mousePressed = () => p5_mouse_pressed(p);
    p.mouseReleased = () => p5_mouse_released(p);
    p.touchStarted = () => p5_mouse_pressed(p);
    p.touchEnded = () => p5_mouse_released(p);
}

const sketch = new p5(s);


function rayIntersectEdge(ray: Ray, edge: Edge, nodes: Node[]): number | null {
    // Given a ray and a line segment defined by its start and end,
    // returns the t-value of intersection if it exists, else null.
    // The t-value is returned even if negative.
    const x1: Vector = ray.start;
    const x2: Vector = nodes[edge.from].point;
    const d1: Vector = vec_normalize(ray.direction);
    const d2: Vector = vec_sub(nodes[edge.to].point, nodes[edge.from].point);
    const length2 = vec_magnitude(d2);
    const v1: Vector = d1;
    const v2: Vector = vec_div(d2, length2);

    // t stores the distance of the point of intersection from the start of each line segment.
    // The intersection only exists if this is less than the length of each segment.
    const m: Mat2 = [
        [v1.x, -v2.x],
        [v1.y, -v2.y]
    ];
    const m_inv = mat_inverse(m);
    if (m_inv == undefined) {
        // Lines parallel
        return null;
    }

    const delta = vec_sub(x2, x1);
    const { x: t1, y: t2 } = mat_mul_vec(m_inv, delta);

    // No intersection if we miss the segment
    if (t2 < 0 || t2 > length2) {
        return null;
    }

    return t1;
}

function pointOnRay(ray: Ray, t: number): Vector {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
