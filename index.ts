const DEBUG = true;

interface Point {
    x: number;
    y: number;
}

// Represents a mathematical infinite line, defined by its gradient and y-intercept.
// For vertical lines, the y-intercept is Infinity, and the y-intercept stores the x-coordinate instead.
interface Line {
    m: number;
    c: number;
}

interface LineSegment {
    start: Point
    end: Point
}

interface Intersection {
    point: Point;
    segment1Index: number;
    segment2Index: number;
}

interface State {
    segments: LineSegment[];
    intersections: Intersection[];
    draggedLineStart: Point | null;
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
        start: state.draggedLineStart,
        end: p.createVector(p.mouseX, p.mouseY)
    };

    // Check for intersections with existing line segments
    const newIntersections: Intersection[] = [];
    for (let iSegment = 0; iSegment < state.segments.length; iSegment++) {
        const segment = state.segments[iSegment];
        const intersection = segmentIntersections(segment, newSegment);
        if (intersection) {
            state.intersections.push({
                point: intersection,
                segment1Index: iSegment,
                segment2Index: state.segments.length
            });
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
}

const sketch = new p5(s);

// -------
// MATH
// -------

function segmentIntersections(segment1: LineSegment, segment2: LineSegment): Point | null | undefined{
    // Given two line segments:
    // - Returns the point of intersection if they intersect
    // - Returns null if they have no intersection
    // - Returns undefined if they have infinitely many intersection points (parallel and overlapping)
    const line1 = lineContainingSegment(segment1);
    const line2 = lineContainingSegment(segment2);
    const intersection = lineIntersection(line1, line2);

    if (intersection == null) {
        return null;
    }

    const xMin1 = Math.min(segment1.start.x, segment1.end.x);
    const xMax1 = Math.max(segment1.start.x, segment1.end.x);
    const xMin2 = Math.min(segment2.start.x, segment2.end.x);
    const xMax2 = Math.max(segment2.start.x, segment2.end.x);

    if (intersection == undefined) {
        // Lines are parallel.
        const xMaxLeft = Math.min(xMax1, xMax2);
        const xMinRight = Math.max(xMin1, xMin2);

        if (xMaxLeft == xMinRight) {
            // They exactly meet. Return the point of intersection
            return { x: xMaxLeft, y: line1.m * xMaxLeft + line1.c };
        } else if (xMaxLeft > xMinRight) {
            // They overlap: infinitely many intersections.
            return undefined;
        } else {
            // They do not meet: no intersections
            return null;
        }
    }

    // Lines are not parallel. Check if the point of intersection is within the bounds 
    if (
        intersection.x >= xMin1 &&
        intersection.x <= xMax1 &&
        intersection.x >= xMin2 &&
        intersection.x <= xMax2
    ) {
        return intersection
    } else {
        return null;
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

function lineIntersection(line1: Line, line2: Line): Point | null | undefined {
    // Does the same as `segmentIntersections` but for entire lines

    if (line1.m == line2.m) {
        return line1.c == line2.c ? undefined : null;
    }
    const x = (line2.c - line1.c) / (line1.m - line2.m);
    const y = line1.m * x + line1.c;
    return { x, y };
}

