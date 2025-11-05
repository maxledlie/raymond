import { vec_add, vec_sub, vec_div, vec_mul, vec_magnitude, mat_inverse, mat_mul_vec, vec_normalize } from "./math.js";
const state = {
    debug: false,
    placementStart: null,
    editMode: "laser",
    entities: [],
};
function p5_setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
}
function p5_draw(p) {
    p.background("black");
    p.stroke("white");
    p.fill("white");
    p.noStroke();
    p.text(state.editMode == "laser" ? "> draw laser (L)" : "  draw laser (L)", 10, 20);
    p.text(state.editMode == "mirror" ? "> draw mirror (M)" : "  draw mirror (M)", 10, 40);
    // Draw entities
    for (const entity of state.entities) {
        switch (entity.type) {
            case "laser":
                drawLaser(p, entity);
                break;
        }
    }
    const lasers = state.entities.filter(e => e.type == "laser");
    const mirrors = state.entities.filter(e => e.type == "mirror");
    // Work out the segments to actually draw
    const segments = [];
    for (const laser of lasers) {
        let tmin = Infinity;
        for (const mirror of mirrors) {
            const t = rayIntersectSegment(laser, mirror);
            if (t != null && t >= 0 && t < tmin) {
                tmin = t;
            }
        }
        if (tmin == Infinity) {
            // No intersection: Find end point of line very far along the direction from mouse start to mouse end
            segments.push({ start: laser.start, end: pointOnRay(laser, 10000) });
        }
        else {
            segments.push({ start: laser.start, end: pointOnRay(laser, tmin) });
        }
    }
    p.stroke("yellow");
    for (const segment of segments) {
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
    p.stroke("lightblue");
    for (const { start, end } of mirrors) {
        p.line(start.x, start.y, end.x, end.y);
    }
    if (state.placementStart) {
        if (state.editMode == "laser") {
            p.stroke("yellow");
            const ray = drawnRay(p);
            // Find end point of line very far along the direction from mouse start to mouse end
            const endPoint = vec_add(ray.start, vec_mul(ray.direction, 10000));
            p.line(ray.start.x, ray.start.y, endPoint.x, endPoint.y);
        }
        else if (state.editMode == "mirror") {
            p.stroke("lightblue");
            p.line(state.placementStart.x, state.placementStart.y, p.mouseX, p.mouseY);
        }
    }
}
function drawLaser(p, laser) {
    // Draw rectangle behind the starting point representing the laser generator
    // Calculate angle of beam
    const theta = Math.atan2(laser.direction.y, laser.direction.x);
    p.push();
    p.translate(laser.start.x, laser.start.y);
    p.rotate(theta);
    p.fill("yellow");
    p.circle(0, 0, 5);
    p.fill("white");
    p.rect(-40, -10, 40, 20);
    p.pop();
}
function drawnRay(p) {
    const mouse = { x: p.mouseX, y: p.mouseY };
    const direction = vec_normalize(vec_sub(mouse, state.placementStart));
    return { start: state.placementStart, direction };
}
function p5_mouse_pressed(p) {
    state.placementStart = { x: p.mouseX, y: p.mouseY };
}
function p5_key_pressed(p) {
    if (p.key == " ") {
        state.debug = !state.debug;
    }
    if (p.key == "l" || p.key == "L") {
        state.editMode = "laser";
    }
    if (p.key == "m" || p.key == "M") {
        state.editMode = "mirror";
    }
}
function p5_mouse_released(p) {
    if (state.placementStart) {
        if (state.editMode == "laser") {
            const ray = drawnRay(p);
            state.entities.push({ type: "laser", start: ray.start, direction: ray.direction });
        }
        else if (state.editMode == "mirror") {
            state.entities.push({ type: "mirror", start: state.placementStart, end: { x: p.mouseX, y: p.mouseY } });
        }
    }
    state.placementStart = null;
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
function rayIntersectSegment(ray, segment) {
    // Given a ray and a line segment defined by its start and end,
    // returns the t-value of intersection if it exists, else null.
    // The t-value is returned even if negative.
    const x1 = ray.start;
    const x2 = segment.start;
    const d1 = vec_normalize(ray.direction);
    const d2 = vec_sub(segment.end, segment.start);
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
function pointOnRay(ray, t) {
    return vec_add(ray.start, vec_mul(ray.direction, t));
}
