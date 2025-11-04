import { Graph, draw_graph } from "./graph.js";

import { Vector, Mat2, vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
import Interval from "./interval.js";

interface Ray {
    start: Vector;
    direction: Vector;
}

interface Node {
    id: number;
    point: Vector;
}

interface Edge {
    from: number;
    to: number;
}

interface Intersection {
    t: number;
    edge: Edge
}

type Polygon = Edge[];

// Config
const MIN_SEGMENT_LENGTH = 10;

interface State {
    debug: boolean;
    nodes: Node[];
    draggedLineStart: Vector | null;
    holes: Polygon[];
    graph: Edge[];
    debugGraph: Graph;
}

const state: State = {
    debug: false,
    nodes: [],
    draggedLineStart: null,
    graph: [],
    debugGraph: new Graph([], 50),
    holes: []
};

function p5_setup(p: p5) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}

function p5_draw(p: p5) {
    p.background("orange");
    p.stroke("black");
    p.fill("black");
}

function p5_mouse_pressed(p: p5) {
    state.draggedLineStart = { x: p.mouseX, y: p.mouseY };
}

function p5_key_pressed(p: p5) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
}

function p5_mouse_released(p: p5) {
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

function rayIntersectPolygon(ray: Ray, polygon: Polygon): number[] {
    const ret = [];

    for (const edge of polygon) {
        const t = rayIntersectEdge(ray, edge, state.nodes);
        if (t) {
            ret.push(t);
        }
    }
    return ret;
}

function pointOnRay(ray: Ray, t: number): Vector {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
