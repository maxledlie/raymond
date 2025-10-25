var DEBUG = true;
var state = {
    segments: [],
    intersections: [],
    draggedLineStart: null
};
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}
function p5_draw(p) {
    p.background("orange");
    p.fill(255);
    // Draw saved segments
    for (var _i = 0, _a = state.segments; _i < _a.length; _i++) {
        var segment = _a[_i];
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
    // Draw the currently dragged segment
    if (state.draggedLineStart) {
        p.line(state.draggedLineStart.x, state.draggedLineStart.y, p.mouseX, p.mouseY);
    }
    if (DEBUG) {
        p.fill("red");
        for (var _b = 0, _c = state.intersections; _b < _c.length; _b++) {
            var intersection = _c[_b];
            p.circle(intersection.point.x, intersection.point.y, 10);
        }
    }
}
function p5_mouse_pressed(p) {
    state.draggedLineStart = p.createVector(p.mouseX, p.mouseY);
}
function p5_mouse_released(p) {
    var newSegment = {
        id: state.segments.length,
        start: state.draggedLineStart,
        end: p.createVector(p.mouseX, p.mouseY)
    };
    // As a debugging aid, if SHIFT is held, snap lines to horizontal or vertical if they are close enough
    if (p.keyIsDown(p.SHIFT)) {
        var rawLine = lineContainingSegment(newSegment);
        if (Math.abs(rawLine.m) > 50) {
            var sign = newSegment.end.y > newSegment.start.y ? 1 : -1;
            newSegment.end = {
                x: newSegment.start.x,
                y: newSegment.start.y + sign * segmentLength(newSegment)
            };
        }
        if (Math.abs(rawLine.m) < 1 / 50) {
            var sign = newSegment.end.x > newSegment.start.x ? 1 : -1;
            newSegment.end = {
                x: newSegment.start.x + sign * segmentLength(newSegment),
                y: newSegment.start.y
            };
        }
    }
    // Check for intersections with existing line segments
    var newIntersections = [];
    for (var iSegment = 0; iSegment < state.segments.length; iSegment++) {
        var segment = state.segments[iSegment];
        var intersection = segmentIntersections(segment, newSegment);
        if (intersection) {
            state.intersections.push(intersection);
        }
    }
    state.segments.push(newSegment);
    state.intersections = state.intersections.concat(newIntersections);
    state.draggedLineStart = null;
}
var s = function (p) {
    p.setup = function () { return p5_setup(p); };
    p.draw = function () { return p5_draw(p); };
    p.mousePressed = function () { return p5_mouse_pressed(p); };
    p.mouseReleased = function () { return p5_mouse_released(p); };
    p.touchStarted = function () { return p5_mouse_pressed(p); };
    p.touchEnded = function () { return p5_mouse_released(p); };
};
var sketch = new p5(s);
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
    var det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det == 0) {
        return undefined;
    }
    var a = [
        [m[1][1], -m[0][1]],
        [-m[1][0], m[0][0]]
    ];
    return mat_mul(a, 1 / det);
}
function segmentIntersections(segment1, segment2) {
    // Given two line segments:
    // - Returns the point of intersection if they intersect
    // - Returns null if they have no intersection or infinitely many intersection points (parallel and overlapping)
    var x1 = segment1.start;
    var x2 = segment2.start;
    var d1 = vec_sub(segment1.end, segment1.start);
    var d2 = vec_sub(segment2.end, segment2.start);
    var length1 = vec_magnitude(d1);
    var length2 = vec_magnitude(d2);
    var v1 = vec_div(d1, length1);
    var v2 = vec_div(d2, length2);
    // t stores the distance of the point of intersection from the start of each line segment.
    // The intersection only exists if this is less than the length of each segment.
    var m = [
        [v1.x, -v2.x],
        [v1.y, -v2.y]
    ];
    var m_inv = mat_inverse(m);
    if (m_inv == undefined) {
        // Lines parallel
        return null;
    }
    var delta = vec_sub(x2, x1);
    var _a = mat_mul_vec(m_inv, delta), t1 = _a.x, t2 = _a.y;
    if (t1 < 0 || t1 > length1 || t2 < 0 || t2 > length2) {
        return null;
    }
    var point = vec_add(x1, vec_mul(v1, t1));
    return {
        point: point,
        segment1Id: segment1.id,
        segment2Id: segment2.id,
        t1: t1,
        t2: t2
    };
}
function lineContainingSegment(segment) {
    // Find gradient and y-intercept of the infinite line containing the segment.
    if (segment.start.x == segment.end.x) {
        return { m: Infinity, c: segment.start.x };
    }
    var m = (segment.end.y - segment.start.y) / (segment.end.x - segment.start.x);
    var c = segment.start.y - m * segment.start.x;
    return { m: m, c: c };
}
function segmentLength(segment) {
    return vec_magnitude(vec_sub(segment.end, segment.start));
}
