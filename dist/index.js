import { Graph, draw_graph } from "./graph.js";
import { vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
import Interval from "./interval.js";
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
    p.strokeWeight(0.5);
    p.textSize(14);
    p.text("Draw lines and make shapes!\nOn desktop? Press space for debug mode.", 10, 20);
    p.strokeWeight(1);
    // Draw holes
    if (state.debug) {
        p.fill(163, 95, 0);
    }
    else {
        p.fill("black");
    }
    for (const hole of state.holes) {
        p.beginShape();
        for (const edge of hole) {
            const start = state.nodes[edge.from];
            p.vertex(start.point.x, start.point.y);
        }
        p.endShape();
    }
    // Draw saved segments
    for (const edge of state.graph) {
        const start = state.nodes[edge.from].point;
        const end = state.nodes[edge.to].point;
        p.line(start.x, start.y, end.x, end.y);
    }
    const previewStrokeColor = p.color(0, 0, 0, 120);
    // Draw the currently dragged segment
    if (state.draggedLineStart) {
        p.stroke(previewStrokeColor);
        p.line(state.draggedLineStart.x, state.draggedLineStart.y, p.mouseX, p.mouseY);
        // DEBUG: Cast a ray along the cut and, for each polygon, find the t-intervals during which the ray is inside that polygon
        const cutStart = state.draggedLineStart;
        const cutEnd = { x: p.mouseX, y: p.mouseY };
        const cutRay = {
            start: state.draggedLineStart,
            direction: vec_normalize(vec_sub(cutEnd, cutStart))
        };
        let holeIntervals = [];
        for (const hole of state.holes) {
            const thisHoleIntervals = [];
            const ts = rayIntersectPolygon(cutRay, hole).sort((a, b) => a - b);
            const startIndex = ts.length % 2;
            if (startIndex == 1) {
                // Ray starts inside this hole
                thisHoleIntervals.push({ start: 0, end: ts[0] });
            }
            for (let i = startIndex; i < ts.length; i += 2) {
                thisHoleIntervals.push({ start: ts[i], end: ts[i + 1] });
            }
            holeIntervals = holeIntervals.concat(thisHoleIntervals);
        }
        holeIntervals.sort((a, b) => a.start - b.start);
        holeIntervals = Interval.union(holeIntervals);
        const domain = { start: 0, end: vec_magnitude(vec_sub(cutEnd, cutStart)) };
        const landIntervals = Interval.complement(holeIntervals, domain);
        for (const iv of landIntervals) {
            const start = pointOnRay(cutRay, iv.start);
            const end = pointOnRay(cutRay, iv.end);
            p.line(start.x, start.y, end.x, end.y);
        }
        // Draw preview nodes
        if (state.debug) {
            const intersections = cutIntersectWorld(state, cutStart, cutEnd);
            p.fill(p.color(255, 0, 0, 120));
            for (const ix of intersections) {
                const point = pointOnRay(cutRay, ix.t);
                p.circle(point.x, point.y, 10);
            }
            p.circle(cutStart.x, cutStart.y, 10);
            p.circle(cutEnd.x, cutEnd.y, 10);
        }
    }
    state.debugGraph.update(p.deltaTime);
    if (state.debug) {
        // Draw divider
        p.stroke("black");
        p.line(p.width / 2, 0, p.width / 2, p.height);
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
function p5_mouse_pressed(p) {
    state.draggedLineStart = { x: p.mouseX, y: p.mouseY };
}
function p5_key_pressed(p) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
}
function p5_mouse_released(p) {
    const cutStart = state.draggedLineStart;
    const cutEnd = { x: p.mouseX, y: p.mouseY };
    const cutVec = vec_sub(cutEnd, state.draggedLineStart);
    const cutLength = vec_magnitude(cutVec);
    const cutRay = {
        start: state.draggedLineStart,
        direction: vec_div(cutVec, cutLength)
    };
    state.draggedLineStart = null;
    if (cutLength < MIN_SEGMENT_LENGTH) {
        return false;
    }
    const intersections = cutIntersectWorld(state, cutStart, cutEnd);
    // For each intersection with a segment, remove the edge between the endpoints and connect each endpoint
    // to the new midpoint instead.
    const newNodes = [{ id: state.nodes.length, point: cutRay.start }];
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
    newNodes.push({ id: state.nodes.length + newNodes.length, point: { x: p.mouseX, y: p.mouseY } });
    // Create graph edges between the newly created nodes, but only if the centre of each edge is not in a polygon!
    // They are already sorted at this point.
    for (let i = 0; i < newNodes.length - 1; i++) {
        const start = newNodes[i];
        const end = newNodes[i + 1];
        const midPoint = vec_mul(vec_add(start.point, end.point), 0.5);
        console.log("midPoint: ", midPoint);
        let inHole = false;
        for (const hole of state.holes) {
            console.log("hole: ", hole);
            if (isPointInPolygon(midPoint, hole)) {
                inHole = true;
                break;
            }
        }
        if (!inHole) {
            addEdge(newNodes[i].id, newNodes[i + 1].id);
        }
    }
    state.nodes = state.nodes.concat(newNodes);
    if (newNodes.length > 1) {
        // Find new cycles created by adding this segment. This will contain duplicates which we remove
        // to dampen the combinatorial explosion.
        let newCycles = [];
        for (const ix of newNodes) {
            newCycles = newCycles.concat(detectCycles(state.graph, ix.id));
        }
        newCycles = dedupeCycles(newCycles);
        for (const cycle of newCycles) {
            const holeEdges = [];
            for (let i = 0; i < cycle.length - 1; i++) {
                holeEdges.push({ from: cycle[i], to: cycle[i + 1] });
            }
            holeEdges.push({ from: cycle[cycle.length - 1], to: cycle[0] });
            state.holes.push(holeEdges);
        }
    }
}
function isPointInPolygon(point, polygon) {
    const ray = {
        start: point,
        direction: { x: 1, y: 0 }
    };
    const intersections = rayIntersectPolygon(ray, polygon).filter(x => x >= 0);
    return intersections.length % 2 === 1;
}
function addEdge(from, to) {
    state.graph.push({ from, to });
    state.debugGraph.addEdge({ from, to });
}
function removeEdge(from, to) {
    function match(edge) {
        return edge.from == from && edge.to == to || edge.to == from && edge.from == to;
    }
    state.graph = state.graph.filter(x => !match(x));
    state.debugGraph.removeEdge({ from, to });
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
/**
 * Convert a cycle into a canonical representation.
 * Handles rotation and direction reversal deduplication.
 */
function canonicalizeCycle(cycle) {
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
function dedupeCycles(cycles) {
    const seen = new Map();
    for (const cycle of cycles) {
        const key = canonicalizeCycle(cycle);
        if (!seen.has(key)) {
            seen.set(key, cycle);
        }
    }
    return [...seen.values()];
}
function cutIntersectWorld(state, cutStart, cutEnd) {
    const cutVec = vec_sub(cutEnd, cutStart);
    const cutLength = vec_magnitude(cutVec);
    const cutRay = {
        start: cutStart,
        direction: vec_div(cutVec, cutLength)
    };
    // Find all intersections with existing edges and sort in order of increasing distance from ray origin.
    // Edges inside 
    const intersections = [];
    for (const edge of state.graph) {
        const t = rayIntersectEdge(cutRay, edge, state.nodes);
        if (t != null && 0 <= t && t <= cutLength) {
            intersections.push({ t, edge });
        }
    }
    intersections.sort((a, b) => a.t - b.t);
    return intersections;
}
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
function detectCycles(graph, root) {
    const cycles = [];
    const path = [root];
    function dfs(current, visited) {
        // Find neighbours of current node
        let neighbours = [];
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
    const visited = new Set();
    visited.add(root);
    dfs(root, visited);
    return cycles;
}
