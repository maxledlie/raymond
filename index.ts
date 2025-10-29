import { Graph, draw_graph } from "./graph.js";

import { Vector, Mat2, vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
import Interval from "./interval.js";

// Represents a mathematical infinite line, defined by its gradient and y-intercept.
// For vertical lines, the y-intercept is Infinity, and the y-intercept stores the x-coordinate instead.
interface Line {
    m: number;
    c: number;
}

interface LineSegment {
    id: number;
    start: Vector;
    end: Vector;
}

interface Ray {
    start: Vector;
    direction: Vector;
}

// Represents an intersection between two line segments.
// Stores the indexes of the segments and the distance of the point along each of the lines.
interface Intersection {
    id: number;
    point: Vector;
    segment1Id: number;
    segment2Id: number;
    t1: number;
    t2: number;
}

// An edge on the graph of connected intersection points
interface Edge {
    from: number;
    to: number;
}

type Polygon = Vector[];

// Config
const MIN_SEGMENT_LENGTH = 10;

interface State {
    debug: boolean;
    segments: LineSegment[];
    intersections: Intersection[];
    draggedLineStart: Vector | null;
    holes: Polygon[];
    graph: Edge[];
    debugGraph: Graph;
}

const state: State = {
    debug: true,
    segments: [],
    intersections: [],
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
    for (const segment of state.segments) {
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
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
        const draggedSegment: LineSegment = {
            id: state.segments.length,
            start: state.draggedLineStart,
            end: p.createVector(p.mouseX, p.mouseY)
        };

        p.line(state.draggedLineStart.x, state.draggedLineStart.y, p.mouseX, p.mouseY);

        // DEBUG: Cast a ray along the cut and, for each polygon, find the t-intervals during which the ray is inside that polygon
        const ray = {
            start: state.draggedLineStart,
            direction: vec_normalize(vec_sub({ x: p.mouseX, y: p.mouseY }, state.draggedLineStart))
        };
        let holeIntervals: Interval[] = [];
        for (const hole of state.holes) {
            const thisHoleIntervals = [];
            const ts = rayPolygonIntersection(ray, hole).map(x => x.t1).sort();

            console.log("ts: ", ts);

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
        const domain: Interval = { start: 0, end: segmentLength(draggedSegment) };
        const landIntervals = Interval.complement(holeIntervals, domain);

        p.stroke("white");
        p.strokeWeight(5);
        for (const iv of landIntervals) {
            const start = pointOnRay(ray, iv.start);
            const end = pointOnRay(ray, iv.end);
            p.line(start.x, start.y, end.x, end.y);
        }
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
            const from = state.intersections[edge.from];
            const to = state.intersections[edge.to];
            p.line(from.point.x, from.point.y, to.point.x, to.point.y);
        }

        // Draw intersections
        p.stroke("black");
        p.strokeWeight(1);
        p.fill("red");
        for (const ix of state.intersections) {
            p.circle(ix.point.x, ix.point.y, 10);
        }

        p.fill("green");
        p.stroke("green");
        p.textSize(16);
        for (const ix of state.intersections) {
            p.text(ix.id, ix.point.x - 12, ix.point.y - 6);
        }

        // Draw clearer view of underlying graph
        p.translate(3 * p.width / 4, p.height / 2);
        draw_graph(p, state.debugGraph);
    }
}

function p5_mouse_pressed(p: p5) {
    state.draggedLineStart = p.createVector(p.mouseX, p.mouseY);
}

function p5_key_pressed(p: p5) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
}

function p5_mouse_released(p: p5) {
    const newSegment: LineSegment = {
        id: state.segments.length,
        start: state.draggedLineStart,
        end: p.createVector(p.mouseX, p.mouseY)
    };
    state.draggedLineStart = null;
    if (segmentLength(newSegment) < MIN_SEGMENT_LENGTH) {
        return false;
    }

    // As a debugging aid, if SHIFT is held, snap lines to horizontal or vertical if they are close enough
    if (p.keyIsDown(p.SHIFT)) {
        const rawLine = lineContainingSegment(newSegment);
        if (Math.abs(rawLine.m) > 50) {
            const sign = newSegment.end.y > newSegment.start.y ? 1 : -1;
            newSegment.end = {
                x: newSegment.start.x,
                y: newSegment.start.y + sign * segmentLength(newSegment)
            };
        }
        if (Math.abs(rawLine.m) < 1 / 50) {
            const sign = newSegment.end.x > newSegment.start.x ? 1 : -1;
            newSegment.end = {
                x: newSegment.start.x + sign * segmentLength(newSegment),
                y: newSegment.start.y
            };
        }
    }


    // Check for intersections with existing line segments
    const newIntersections: Intersection[] = [];
    for (let iSegment = 0; iSegment < state.segments.length; iSegment++) {
        const segment = state.segments[iSegment];
        const ix = segmentSegmentIntersection(newSegment, segment);
        if (ix) {
            newIntersections.push({ ...ix, id: state.intersections.length + newIntersections.length });
        }
    }

    // Create graph edges between the newly created intersections.
    // We *could* create an edge for every pair of new intersections.
    // But that would make the graph bigger and slow down the cycle search.
    // So we sort the intersections by distance along the new segment and only connect sequential intersections.
    const sorted = newIntersections.sort((ix) => ix.t1);
    for (let i = 0; i < sorted.length - 1; i++) {
        addEdge(sorted[i].id, sorted[i + 1].id);
    }

    // Each newly created intersection, ix, connects the new segment, A, to some other segment, B.
    // We need to add edges to the graph connecting ix to the closest existing intersections to either side on B.
    for (const ix of newIntersections) {
        console.log("ix.t2: ", ix.t2);
        const oldSegmentId = ix.segment2Id;
        const intersectionSequence = sortedIntersectionsOnSegment(oldSegmentId);
        console.log("intersectionSequence: ", intersectionSequence);

        // Find index where new intersection would sit if inserted in the intersection sequence, maintaining sort order
        let j = intersectionSequence.findIndex(x => x.t > ix.t2);
        if (j == -1) {
            j = intersectionSequence.length;
        }
        console.log("insertion index: ", j);
        if (j > 0) {
            const prevIntersectionId = intersectionSequence[j - 1].intersectionId;
            addEdge(prevIntersectionId, ix.id);
        }
        if (j < intersectionSequence.length) {
            const nextIntersectionId = intersectionSequence[j].intersectionId;
            addEdge(ix.id, nextIntersectionId);
        }

        // Remove original edge between the nodes on either side
        if (j > 0 && j < intersectionSequence.length) {
            const prevIntersectionId = intersectionSequence[j - 1].intersectionId;
            const nextIntersectionId = intersectionSequence[j].intersectionId;
            removeEdge(prevIntersectionId, nextIntersectionId);
        }

    }

    state.intersections = state.intersections.concat(newIntersections);

    if (newIntersections.length > 1) {
        // Find new cycles created by adding this segment. This will contain duplicates which we remove
        // to dampen the combinatorial explosion.
        let newCycles: number[][] = [];
        for (const ix of newIntersections) {
            newCycles = newCycles.concat(detectCycles(state.graph, ix.id));
        }

        newCycles = dedupeCycles(newCycles);

        for (const cycle of newCycles) {
            state.holes.push(cycle.map(x => ({ x: state.intersections[x].point.x, y: state.intersections[x].point.y })));
        }
    }
    state.segments.push(newSegment);
}

function addEdge(from: number, to: number) {
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

function sortedIntersectionsOnSegment(segmentId: number): { intersectionId: number; t: number; }[] {
    // Returns all intersections that lie on the given segment, sorted by increasing t-value.
    // OPT: I expect this function will take up the bulk of calculation time. Could optimise with some hash tables or something.
    const ixs = [];
    for (const ix of state.intersections) {
        if (ix.segment1Id == segmentId) {
            ixs.push({ intersectionId: ix.id, t: ix.t1 });
        }
        if (ix.segment2Id == segmentId) {
            ixs.push({ intersectionId: ix.id, t: ix.t2 });
        }
    }
    return ixs.sort((x, y) => {
        if (x.t < y.t) {
            return -1;
        } else if (x.t === y.t) {
            return 0;
        } else {
            return 1;
        }
    });
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

function segmentSegmentIntersection(segment1: LineSegment, segment2: LineSegment): Omit<Intersection, "id"> | null {
    // Given two line segments:
    // - Returns the point of intersection if they intersect
    // - Returns null if they have no intersection or infinitely many intersection points (parallel and overlapping)

    const x1: Vector = segment1.start;
    const x2: Vector = segment2.start;
    const d1: Vector = vec_sub(segment1.end, segment1.start);
    const d2: Vector = vec_sub(segment2.end, segment2.start);
    const length1 = vec_magnitude(d1);
    const length2 = vec_magnitude(d2);
    const v1: Vector = vec_div(d1, length1);
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

    if (t1 < 0 || t1 > length1 || t2 < 0 || t2 > length2) {
        return null;
    }

    const point = vec_add(x1, vec_mul(v1, t1));
    return {
        point,
        segment1Id: segment1.id,
        segment2Id: segment2.id,
        t1,
        t2
    }
}

function segmentPolygonIntersection(segment: LineSegment, polygon: Polygon): Omit<Intersection, "id">[] {
    const ret = [];

    // Construct segments for each edge of the polygon
    const polygonSegments: LineSegment[] = [];
    for (let i = 0; i < polygon.length - 1; i++) {
        polygonSegments.push({
            id: -1,
            start: polygon[i],
            end: polygon[i+1]
        });
    }
    polygonSegments.push({
        id: -1,
        start: polygon[polygon.length - 1],
        end: polygon[0]
    });

    for (const polygonSegment of polygonSegments) {
        const ix = segmentSegmentIntersection(segment, polygonSegment);
        if (ix) {
            ret.push(ix);
        }
    }
    return ret;
}

function rayPolygonIntersection(ray: Ray, polygon: Polygon): Omit<Intersection, "id">[] {
    // Construct a very long segment representing the ray.
    const raySegment = {
        id: -1,
        start: ray.start,
        end: vec_add(ray.start, vec_mul(ray.direction, 10000))
    }
    return segmentPolygonIntersection(raySegment, polygon);
}

function pointOnRay(ray: Ray, t: number) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}

function isPointInsidePolygon(point: Vector, polygon: Polygon) {
    const testRay = {
        id: -1,
        start: point,
        end: { id: -1, x: point.x + 1000000, y: point.y }
    };
    const intersections = segmentPolygonIntersection(testRay, polygon);
    return intersections.length % 2 === 1;
}

function lineContainingSegment(segment: LineSegment): Line {
    // Find gradient and y-intercept of the infinite line containing the segment.
    if (segment.start.x == segment.end.x) {
        return { m: Infinity, c: segment.start.x };
    }
    const m = (segment.end.y - segment.start.y) / (segment.end.x - segment.start.x);
    const c = segment.start.y - m * segment.start.x;
    return { m, c };
}

function segmentLength(segment: LineSegment): number {
    return vec_magnitude(vec_sub(segment.end, segment.start));
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