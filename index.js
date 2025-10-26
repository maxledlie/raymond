const DEBUG = true;
const state = {
    segments: [],
    intersections: [],
    draggedLineStart: null,
    graph: [],
};
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}
function p5_draw(p) {
    p.background("orange");
    p.fill(255);
    // Draw saved segments
    for (const segment of state.segments) {
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
    // Draw the currently dragged segment
    if (state.draggedLineStart) {
        p.line(state.draggedLineStart.x, state.draggedLineStart.y, p.mouseX, p.mouseY);
    }
    if (DEBUG) {
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
        for (const intersection of state.intersections) {
            p.circle(intersection.point.x, intersection.point.y, 10);
        }
    }
}
function p5_mouse_pressed(p) {
    state.draggedLineStart = p.createVector(p.mouseX, p.mouseY);
}
function p5_mouse_released(p) {
    const newSegment = {
        id: state.segments.length,
        start: state.draggedLineStart,
        end: p.createVector(p.mouseX, p.mouseY)
    };
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
    const newIntersections = [];
    for (let iSegment = 0; iSegment < state.segments.length; iSegment++) {
        const segment = state.segments[iSegment];
        const ix = segmentIntersection(newSegment, segment);
        if (ix) {
            newIntersections.push(Object.assign(Object.assign({}, ix), { id: state.intersections.length + newIntersections.length }));
        }
    }
    // Create graph edges between the newly created intersections.
    // We *could* create an edge for every pair of new intersections.
    // But that would make the graph bigger and slow down the cycle search.
    // So we sort the intersections by distance along the new segment and only connect sequential intersections.
    const sorted = newIntersections.sort((ix) => ix.t1);
    for (let i = 0; i < sorted.length - 1; i++) {
        state.graph.push({ from: sorted[i].id, to: sorted[i + 1].id });
    }
    // Each newly created intersection, ix, connects the new segment, A, to some other segment, B.
    // We need to add edges to the graph connecting ix to the closest existing intersections to either side on B.
    // NOTE: The current implementation *keeps* the graph edge between these closest existing intersections,
    // making the graph a little more complex than necessary but keeping the edge list append-only.
    for (const ix of newIntersections) {
        const oldSegmentId = ix.segment2Id;
        const intersectionSequence = sortedIntersectionsOnSegment(oldSegmentId);
        // Find index where new intersection would sit if inserted in the intersection sequence, maintaining sort order
        let j = 0;
        for (let i = 0; i < intersectionSequence.length; i++) {
            if (intersectionSequence[i].t > ix.t2) {
                j = i;
                break;
            }
        }
        if (j > 0) {
            const prevIntersectionId = intersectionSequence[j - 1].intersectionId;
            state.graph.push({ from: prevIntersectionId, to: ix.id });
        }
        if (j < intersectionSequence.length) {
            const nextIntersectionId = intersectionSequence[j].intersectionId;
            state.graph.push({ from: ix.id, to: nextIntersectionId });
        }
    }
    state.segments.push(newSegment);
    state.intersections = state.intersections.concat(newIntersections);
    state.draggedLineStart = null;
}
function sortedIntersectionsOnSegment(segmentId) {
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
    return ixs.sort(x => x.t);
}
const s = (p) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.mousePressed = () => p5_mouse_pressed(p);
    p.mouseReleased = () => p5_mouse_released(p);
    p.touchStarted = () => p5_mouse_pressed(p);
    p.touchEnded = () => p5_mouse_released(p);
};
const sketch = new p5(s);
// -------
// MATH
// -------
function vec_add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
function vec_sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function vec_mul(a, scalar) {
    return { x: a.x * scalar, y: a.y * scalar };
}
function vec_div(a, scalar) {
    return { x: a.x / scalar, y: a.y / scalar };
}
function vec_magnitude(a) {
    return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2));
}
function vec_normalize(a) {
    return vec_div(a, vec_magnitude(a));
}
function mat_mul(a, scalar) {
    return [
        [a[0][0] * scalar, a[0][1] * scalar],
        [a[1][0] * scalar, a[1][1] * scalar]
    ];
}
function mat_mul_vec(a, v) {
    return {
        x: a[0][0] * v.x + a[0][1] * v.y,
        y: a[1][0] * v.x + a[1][1] * v.y
    };
}
function mat_inverse(m) {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    const a = [
        [m[1][1], -m[0][1]],
        [-m[1][0], m[0][0]]
    ];
    return mat_mul(a, 1 / det);
}
function segmentIntersection(segment1, segment2) {
    // Given two line segments:
    // - Returns the point of intersection if they intersect
    // - Returns null if they have no intersection or infinitely many intersection points (parallel and overlapping)
    const x1 = segment1.start;
    const x2 = segment2.start;
    const d1 = vec_sub(segment1.end, segment1.start);
    const d2 = vec_sub(segment2.end, segment2.start);
    const length1 = vec_magnitude(d1);
    const length2 = vec_magnitude(d2);
    const v1 = vec_div(d1, length1);
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
    };
}
function lineContainingSegment(segment) {
    // Find gradient and y-intercept of the infinite line containing the segment.
    if (segment.start.x == segment.end.x) {
        return { m: Infinity, c: segment.start.x };
    }
    const m = (segment.end.y - segment.start.y) / (segment.end.x - segment.start.x);
    const c = segment.start.y - m * segment.start.x;
    return { m, c };
}
function segmentLength(segment) {
    return vec_magnitude(vec_sub(segment.end, segment.start));
}
function detectCycles(graph, startIndex, visited) {
    if (visited.includes(startIndex)) {
        return [visited];
    }
    let ret = [];
    for (const edge of graph) {
        if (edge.from == startIndex) {
            const newVisited = [...visited, startIndex];
            ret = ret.concat(detectCycles(graph, edge.to, newVisited));
        }
    }
    return ret;
}
