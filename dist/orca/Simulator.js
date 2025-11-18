import { newPoint, newVector, vec_add, vec_div, vec_dot, vec_magnitude, vec_magnitude_sq, vec_mul, vec_normalize, vec_sub } from "../math.js";
// Minimal amound of time for which the computed velocities must be safe.
// Is this a sensible default value?
const TIME_HORIZON = 1000 / 60;
export function computeOrcaLines(unit, otherUnits, dt) {
    const invTimeHorizon = 1 / TIME_HORIZON;
    const lines = [];
    for (let i = 0; i < otherUnits.length; i++) {
        const other = otherUnits[i];
        const relPos = vec_sub(other.position, unit.position);
        const relVel = vec_sub(unit.velocity, other.velocity);
        const distSq = vec_magnitude_sq(relPos);
        const combinedRadius = unit.radius + other.radius;
        const combinedRadiusSq = Math.pow(combinedRadius, 2);
        // We're gonna change these!
        const line = { point: newPoint(0, 0), direction: newVector(0, 0) };
        let u = newPoint(0, 0);
        if (distSq > combinedRadiusSq) {
            // No collision
            const w = vec_sub(relVel, vec_mul(relPos, invTimeHorizon));
            // Vector from cutoff centre to relative velocity (??)
            const wLengthSq = vec_magnitude_sq(w);
            const dotProduct1 = vec_dot(w, relPos);
            if (dotProduct1 < 0.0 && Math.pow(dotProduct1, 2) > combinedRadiusSq * wLengthSq) {
                // Project on cut-off circle
                const wLength = Math.sqrt(wLengthSq);
                const unitW = vec_div(w, wLength);
                line.direction = newVector(unitW.y, -unitW.x);
                u = vec_mul(unitW, combinedRadius * invTimeHorizon - wLength);
            }
            else {
                console.log("Project on legs");
                // Project on legs
                const leg = Math.sqrt(distSq - combinedRadiusSq);
                const det = relPos.x * w.y - relPos.y * w.x;
                if (det > 0) {
                    // Project on left leg
                    line.direction = vec_mul(newVector(relPos.x * leg - relPos.y * combinedRadius, relPos.x * combinedRadius + relPos.y * leg), 1 / distSq);
                }
                else {
                    // Project on right leg
                    line.direction = vec_mul(newVector(relPos.x * leg + relPos.y * combinedRadius, -relPos.x * combinedRadius + relPos.y * leg), -1 / distSq);
                }
                const dotProduct2 = vec_dot(relVel, line.direction);
                u = vec_sub(vec_mul(line.direction, dotProduct2), relVel);
            }
        }
        else {
            // Collision. Project on cut-off circle of time timeStep
            const invTimeStep = 1 / dt;
            // Vector from cutoff center to relative velocity
            const w = vec_sub(relVel, vec_mul(relPos, invTimeStep));
            const wLength = vec_magnitude(w);
            const unitW = vec_div(w, wLength);
            line.direction = newVector(unitW.y, -unitW.x);
            u = vec_mul(unitW, combinedRadius * invTimeStep - wLength);
        }
        line.point = vec_add(unit.velocity, vec_mul(u, 0.5));
        line.point.w = 1;
        lines.push(line);
    }
    return lines;
}
export function computeNewVelocity(unit, otherUnits, dt) {
    const lines = computeOrcaLines(unit, otherUnits, dt);
    // TODO: Solve linear program with all the constraints
    return newVector(0, 0);
}
/**
 * Solves a two-dimensional linear program subject to linear constraints
 * defined by lines and a circular constraint.
 * @param lines Lines defining the linear constraints
 * @param radius The radius of the circular constraint
 * @param optVelocity The optimisation velocity - how we *want* to travel
 * @returns The index of the line the optimal point falls on, and the number of lines if successful.
 */
export function linearProgram2(lines, radius, optVelocity) {
    let result;
    if (vec_magnitude_sq(optVelocity) > Math.pow(radius, 2)) {
        // Optimal velocity is too fast. Scale back to lie inside circle
        result = vec_mul(vec_normalize(optVelocity), radius);
    }
    else {
        result = optVelocity;
    }
    for (let i = 0; i < lines.length; i++) {
        const v1 = lines[i].direction;
        const v2 = vec_sub(lines[i].point, result);
        const det = v1.x * v2.y - v1.y * v2.x;
        if (det > 0) {
            // Result does not satisfy constraint i. Compute new optimal result.
            const tempResult = result;
            const lp1Result = linearProgram1(lines, i, radius, optVelocity);
        }
    }
}
function linearProgram1(lines, lineNo, radius, optVelocity) {
}
