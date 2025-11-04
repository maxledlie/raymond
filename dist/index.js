import { Graph } from "./graph.js";
import { vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
// Config
const MIN_SEGMENT_LENGTH = 10;
const state = {
    debug: false,
    nodes: [],
    draggedLineStart: null,
    graph: [],
    debugGraph: new Graph([], 50),
    holes: []
};
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}
function p5_draw(p) {
    p.background("orange");
    p.stroke("black");
    p.fill("black");
}
function p5_mouse_pressed(p) {
    state.draggedLineStart = { x: p.mouseX, y: p.mouseY };
}
function p5_key_pressed(p) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
}
function p5_mouse_released(p) {
}
const s = (p) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.keyPressed = () => p5_key_pressed(p);
    p.mousePressed = () => p5_mouse_pressed(p);
    p.mouseReleased = () => p5_mouse_released(p);
    p.touchStarted = () => p5_mouse_pressed(p);
    p.touchEnded = () => p5_mouse_released(p);
};
const sketch = new p5(s);
function rayIntersectEdge(ray, edge, nodes) {
    // Given a ray and a line segment defined by its start and end,
    // returns the t-value of intersection if it exists, else null.
    // The t-value is returned even if negative.
    const x1 = ray.start;
    const x2 = nodes[edge.from].point;
    const d1 = vec_normalize(ray.direction);
    const d2 = vec_sub(nodes[edge.to].point, nodes[edge.from].point);
    const length2 = vec_magnitude(d2);
    const v1 = d1;
    const v2 = vec_div(d2, length2);
    // t stores the distance of the point of intersection from the start of each line segment.
    // The intersection only exists if this is less than the length of each segment.
    const m = [
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
function rayIntersectPolygon(ray, polygon) {
    const ret = [];
    for (const edge of polygon) {
        const t = rayIntersectEdge(ray, edge, state.nodes);
        if (t) {
            ret.push(t);
        }
    }
    return ret;
}
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
