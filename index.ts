const DEBUG = true;

interface Vector {
    x: number;
    y: number;
}

type Mat2 = number[][];

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

// Represents an intersection between two line segments.
// Stores the indexes of the segments and the distance of the point along each of the lines.
interface Intersection {
    point: Vector;
    segment1Id: number;
    segment2Id: number;
    t1: number;
    t2: number;
}

interface State {
    segments: LineSegment[];
    intersections: Intersection[];
    draggedLineStart: Vector | null;
}

const state: State = {
    segments: [],
    intersections: [],
    draggedLineStart: null
};

function p5_setup(p: p5) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}

function p5_draw(p: p5) {
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
        p.fill("red");
        for (const intersection of state.intersections) {
            p.circle(intersection.point.x, intersection.point.y, 10);
        }
    }

}

function p5_mouse_pressed(p: p5) {
    state.draggedLineStart = p.createVector(p.mouseX, p.mouseY);
}

function p5_mouse_released(p: p5) {
    const newSegment: LineSegment = {
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
    const newIntersections: Intersection[] = [];
    for (let iSegment = 0; iSegment < state.segments.length; iSegment++) {
        const segment = state.segments[iSegment];
        const intersection = segmentIntersections(segment, newSegment);
        if (intersection) {
            state.intersections.push(intersection);
        }
    }

    state.segments.push(newSegment);
    state.intersections = state.intersections.concat(newIntersections);
    state.draggedLineStart = null;
}

const s = ( p: p5 ) => {
    p.setup = () => p5_setup(p);
    p.draw = () => p5_draw(p);
    p.mousePressed = () => p5_mouse_pressed(p);
    p.mouseReleased = () => p5_mouse_released(p);
    p.touchStarted = () => p5_mouse_pressed(p);
    p.touchEnded = () => p5_mouse_released(p);
}

const sketch = new p5(s);

// -------
// MATH
// -------

function vec_add(a: Vector, b: Vector): Vector {
    return { x: a.x + b.x, y: a.y + b.y };
}

function vec_sub(a: Vector, b: Vector): Vector {
    return { x: a.x - b.x, y: a.y - b.y };
}

function vec_mul(a: Vector, scalar: number): Vector {
    return { x: a.x * scalar, y: a.y * scalar };
}

function vec_div(a: Vector, scalar: number): Vector {
    return { x: a.x / scalar, y: a.y / scalar };
}

function vec_magnitude(a: Vector): number {
    return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2));
}

function vec_normalize(a: Vector): Vector {
    return vec_div(a, vec_magnitude(a));
}

function mat_mul(a: Mat2, scalar: number): Mat2 {
    return [
        [ a[0][0] * scalar, a[0][1] * scalar ],
        [ a[1][0] * scalar, a[1][1] * scalar ]
    ];
}

function mat_mul_vec(a: Mat2, v: Vector | Vector): Vector | Vector {
    return { 
        x: a[0][0] * v.x + a[0][1] * v.y,
        y: a[1][0] * v.x + a[1][1] * v.y
    };
}

function mat_inverse(m: Mat2): Mat2 | undefined {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    const a: Mat2 = [
        [ m[1][1], -m[0][1] ],
        [ -m[1][0], m[0][0] ]
    ];
    return mat_mul(a, 1 / det);
}
    
function segmentIntersections(segment1: LineSegment, segment2: LineSegment): Intersection | null {
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
        [ v1.x, -v2.x ],
        [ v1.y, -v2.y ]
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