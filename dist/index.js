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
function segmentIntersections(segment1, segment2) {
    // Given two line segments:
    // - Returns the point of intersection if they intersect
    // - Returns null if they have no intersection
    // - Returns undefined if they have infinitely many intersection points (parallel and overlapping)
    var line1 = lineContainingSegment(segment1);
    var line2 = lineContainingSegment(segment2);
    var intersection = lineIntersection(line1, line2);
    if (intersection == null) {
        return null;
    }
    var xMin1 = Math.min(segment1.start.x, segment1.end.x);
    var xMax1 = Math.max(segment1.start.x, segment1.end.x);
    var xMin2 = Math.min(segment2.start.x, segment2.end.x);
    var xMax2 = Math.max(segment2.start.x, segment2.end.x);
    if (intersection == undefined) {
        // Lines are parallel.
        var xMaxLeft = Math.min(xMax1, xMax2);
        var xMinRight = Math.max(xMin1, xMin2);
        if (xMaxLeft == xMinRight) {
            // They exactly meet. Return the point of intersection
            return { x: xMaxLeft, y: line1.m * xMaxLeft + line1.c };
        }
        else if (xMaxLeft > xMinRight) {
            // They overlap: infinitely many intersections.
            return undefined;
        }
        else {
            // They do not meet: no intersections
            return null;
        }
    }
    // Lines are not parallel. Check if the point of intersection is within the bounds 
    if (intersection.x >= xMin1 &&
        intersection.x <= xMax1 &&
        intersection.x >= xMin2 &&
        intersection.x <= xMax2) {
        return intersection;
    }
    else {
        return null;
    }
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
function lineIntersection(line1, line2) {
    // Does the same as `segmentIntersections` but for entire lines
    // Handle parallel lines
    if (line1.m == line2.m) {
        return line1.c == line2.c ? undefined : null;
    }
    // Handle vertical lines
    if (line1.m == Infinity) {
        return { x: line1.c, y: line2.m * line1.c + line2.c };
    }
    if (line2.m == Infinity) {
        return { x: line2.c, y: line1.m * line2.c + line1.c };
    }
    // Normal, well-behaved lines that intersect
    var x = (line2.c - line1.c) / (line1.m - line2.m);
    var y = line1.m * x + line1.c;
    return { x: x, y: y };
}
function segmentLength(segment) {
    var sq = Math.pow(segment.end.x - segment.start.x, 2) + Math.pow(segment.end.y - segment.start.y, 2);
    return Math.sqrt(sq);
}
