import { Graph, draw_graph } from "./graph.js";

import { Vector, Mat2, vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
import Interval from "./interval.js";

interface LineSegment {
    id: number;
    start: Vector;
    end: Vector;
}

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

type Polygon = Vector[];

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
    debug: true,
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

    p.strokeWeight(0.5);
    p.textSize(14);
    p.text("Draw lines and make shapes!\nOn desktop? Press space for debug mode.", 10, 20);
    p.strokeWeight(1);

    // Draw saved segments
    for (const edge of state.graph) {
        const start = state.nodes[edge.from].point;
        const end = state.nodes[edge.to].point;
        p.line(start.x, start.y, end.x, end.y);
    }

    // Draw holes
    p.fill("black");
    for (const hole of state.holes) {
        p.beginShape();
        for (const vertex of hole) {
            p.vertex(vertex.x, vertex.y);
        }
        p.endShape();
    }

    // Draw the currently dragged segment
    if (state.draggedLineStart) {
        p.line(state.draggedLineStart.x, state.draggedLineStart.y, p.mouseX, p.mouseY);

        // // DEBUG: Cast a ray along the cut and, for each polygon, find the t-intervals during which the ray is inside that polygon
        // const ray = {
        //     start: state.draggedLineStart,
        //     direction: vec_normalize(vec_sub({ x: p.mouseX, y: p.mouseY }, state.draggedLineStart))
        // };
        // let holeIntervals: Interval[] = [];
        // for (const hole of state.holes) {
        //     const thisHoleIntervals = [];
        //     const ts = rayIntersectPolygon(ray, hole).sort((a, b) => a - b);
        //     const startIndex = ts.length % 2;
        //     if (startIndex == 1) {
        //         // Ray starts inside this hole
        //         thisHoleIntervals.push({ start: 0, end: ts[0] });
        //     }
        //     for (let i = startIndex; i < ts.length; i += 2) {
        //         thisHoleIntervals.push({ start: ts[i], end: ts[i + 1] });
        //     }
        //     holeIntervals = holeIntervals.concat(thisHoleIntervals);
        // }
        // holeIntervals.sort((a, b) => a.start - b.start);
        // holeIntervals = Interval.union(holeIntervals);
        // console.log("holeIntervals: ", holeIntervals);
        // const domain: Interval = { start: 0, end: cutLength };
        // const landIntervals = Interval.complement(holeIntervals, domain);
        // console.log("landIntervals: ", landIntervals);

        // p.stroke("white");
        // p.strokeWeight(5);
        // for (const iv of landIntervals) {
        //     const start = pointOnRay(ray, iv.start);
        //     const end = pointOnRay(ray, iv.end);
        //     p.line(start.x, start.y, end.x, end.y);
        // }
    }

    state.debugGraph.update(p.deltaTime);

    if (state.debug) {
        // Draw divider
        p.stroke("black");
        p.line(p.width / 2, 0, p.width / 2, p.height);

        // Draw graph edges. These should overlay the cuts but not extend beyond the intersections.
        p.stroke("white");
        p.strokeWeight(2);
        for (const edge of state.graph) {
            const from = state.nodes[edge.from];
            const to = state.nodes[edge.to];
            p.line(from.point.x, from.point.y, to.point.x, to.point.y);
        }

        // Draw intersections
        p.stroke("black");
        p.strokeWeight(1);
        p.fill("red");
        for (const ix of state.nodes) {
            p.circle(ix.point.x, ix.point.y, 10);
        }

        p.fill("green");
        p.stroke("green");
        p.textSize(16);
        for (const ix of state.nodes) {
            p.text(ix.id, ix.point.x - 12, ix.point.y - 6);
        }

        // Draw clearer view of underlying graph
        p.translate(3 * p.width / 4, p.height / 2);
        draw_graph(p, state.debugGraph);
    }
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
    const cutVec = vec_sub({ x: p.mouseX, y: p.mouseY }, state.draggedLineStart);
    const cutLength = vec_magnitude(cutVec);
    const cutRay: Ray = {
        start: state.draggedLineStart,
        direction: vec_div(cutVec, cutLength)
    };
    state.draggedLineStart = null;
    if (cutLength < MIN_SEGMENT_LENGTH) {
        return false;
    }

    // Find all intersections with existing line segments and sort in order of increasing distance from ray origin
    const intersections: Intersection[] = [];
    for (const edge of state.graph) {
        const t = rayIntersectEdge(cutRay, edge, state.nodes);
        if (t != null && 0 <= t && t <= cutLength) {
            intersections.push({ t, edge })
        }
    }
    intersections.sort((a, b) => a.t - b.t);
    console.log("intersections after sorting: ", intersections);

    // For each intersection with a segment, remove the edge between the endpoints and connect each endpoint
    // to the new midpoint instead.
    const newNodes: Node[] = [{ id: state.nodes.length, point: cutRay.start }];
    for (const ix of intersections) {
        const newNodeId = state.nodes.length + newNodes.length;
        newNodes.push({
            id: newNodeId,
            point: pointOnRay(cutRay, ix.t)
        });
        removeEdge(ix.edge.from, ix.edge.to);
        addEdge(ix.edge.from, newNodeId);
        addEdge(newNodeId, ix.edge.to);
    }
    newNodes.push({ id: state.nodes.length + newNodes.length, point: { x: p.mouseX, y: p.mouseY }});
    console.log("newNodes: ", newNodes);

    // Create graph edges between the newly created nodes.
    // They are already sorted at this point.
    for (let i = 0; i < newNodes.length - 1; i++) {
        addEdge(newNodes[i].id, newNodes[i + 1].id);
    }

    state.nodes = state.nodes.concat(newNodes);

    if (newNodes.length > 1) {
        // Find new cycles created by adding this segment. This will contain duplicates which we remove
        // to dampen the combinatorial explosion.
        let newCycles: number[][] = [];
        for (const ix of newNodes) {
            newCycles = newCycles.concat(detectCycles(state.graph, ix.id));
        }

        newCycles = dedupeCycles(newCycles);

        for (const cycle of newCycles) {
            state.holes.push(cycle.map(x => ({ x: state.nodes[x].point.x, y: state.nodes[x].point.y })));
        }
    }
}

function addEdge(from: number, to: number) {
    console.log(`Adding edge from ${from} to ${to}`);
    state.graph.push({ from, to });
    state.debugGraph.addEdge({ from, to });
}

function removeEdge(from: number, to: number) {
    function match(edge: Edge): boolean {
        return edge.from == from && edge.to == to || edge.to == from && edge.from == to;
    }
    state.graph = state.graph.filter(x => !match(x));
    state.debugGraph.removeEdge({ from, to });
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

/**
 * Convert a cycle into a canonical representation.
 * Handles rotation and direction reversal deduplication.
 */
function canonicalizeCycle(cycle: number[]): string {
    const core = cycle.slice(); // copy

    // Find index of lexicographically smallest node
    let minIndex = 0;
    for (let i = 1; i < core.length; i++) {
        if (core[i] < core[minIndex]) {
            minIndex = i;
        }
    }

    // Rotate so smallest node comes first
    const rotated = core.slice(minIndex).concat(core.slice(0, minIndex));

    // Create forward and reversed forms
    const reverse = [rotated[0], ...rotated.slice(1).reverse()];

    const forward_str = rotated.map(toString).join(",");
    const reverse_str = reverse.map(toString).join(",");

    // Choose canonical: lexicographically smallest representation
    return rotated < reverse ? forward_str : reverse_str;
}

/**
 * Remove duplicate cycles.
 */
function dedupeCycles(cycles: number[][]): number[][] {
    const seen = new Map<string, number[]>();
    for (const cycle of cycles) {
        const key = canonicalizeCycle(cycle);
        if (!seen.has(key)) {
            seen.set(key, cycle);
        }
    }
    return [...seen.values()];
}

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
    console.log("t1, t2", t1, t2);

    // No intersection if we miss the segment
    if (t2 < 0 || t2 > length2) {
        console.log("miss!");
        return null;
    }

    return t1;
}

// function rayIntersectPolygon(ray: Ray, polygon: Polygon): number[] {
//     const ret = [];
// 
//     // Construct segments for each edge of the polygon
//     const polygonSegments: LineSegment[] = [];
//     for (let i = 0; i < polygon.length - 1; i++) {
//         polygonSegments.push({
//             id: -1,
//             start: polygon[i],
//             end: polygon[i+1]
//         });
//     }
//     polygonSegments.push({
//         id: -1,
//         start: polygon[polygon.length - 1],
//         end: polygon[0]
//     });
// 
//     for (const polygonSegment of polygonSegments) {
//         const t = rayIntersectEdge(ray, polygonSegment.start, polygonSegment.end);
//         if (t) {
//             ret.push(t);
//         }
//     }
//     return ret;
// }

function pointOnRay(ray: Ray, t: number): Vector {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}

function detectCycles(graph: Edge[], root: number): number[][] {
    const cycles: number[][] = [];
    const path: number[] = [root];

    function dfs(current: number, visited: Set<number>) {
        // Find neighbours of current node
        let neighbours: number[] = [];
        neighbours = neighbours.concat(graph.filter(x => x.from == current).map(x => x.to));
        neighbours = neighbours.concat(graph.filter(x => x.to == current).map(x => x.from));

        for (const neighbour of neighbours) {
            if (neighbour == root) {
                if (path.length > 2) {
                    cycles.push([...path]);
                }
                continue;
            }

            if (!visited.has(neighbour)) {
                path.push(neighbour);
                visited.add(neighbour);
                dfs(neighbour, visited);
                visited.delete(neighbour);
                path.pop();
            }
        }
    }

    // Start DFS with a visited set containing only the root
    const visited = new Set<number>();
    visited.add(root);
    dfs(root, visited);
    return cycles;
}