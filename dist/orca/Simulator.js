import { newPoint, newVector, vec_add, vec_div, vec_dot, vec_magnitude_sq, vec_mul, vec_sub } from "../math.js";
// Minimal amound of time for which the computed velocities must be safe.
// Is this a sensible default value?
const TIME_HORIZON = 1000 / 60;
export function computeOrcaLines(unit, otherUnits) {
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
            // No collision,
            const w = vec_sub(relVel, vec_mul(relPos, invTimeHorizon));
            // Vector from cutoff centre to relative velocity (??)
            const wLengthSq = vec_magnitude_sq(w);
            const dotProduct1 = vec_dot(w, relPos);
            if (dotProduct1 < 0.0 && Math.pow(dotProduct1, 2) > combinedRadiusSq * wLengthSq) {
                const wLength = Math.sqrt(wLengthSq);
                const unitW = vec_div(w, wLength);
                line.direction = newVector(unitW.y, -unitW.x);
                u = vec_mul(unitW, combinedRadius * invTimeHorizon - wLength);
            }
            else {
            }
        }
        else {
        }
        line.point = vec_add(unit.velocity, vec_mul(u, 0.5));
        line.point.w = 1;
        lines.push(line);
    }
    return lines;
}
export function computeNewVelocity(unit, otherUnits) {
    const lines = computeOrcaLines(unit, otherUnits);
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
// function linearProgram2(
//     lines: Line[],
//     radius: number,
//     optVelocity: Vec3,
// ): { lineIndex: number, result: Vec3 } {
//     let targetVelocity;
//     if (vec_magnitude_sq(optVelocity) > Math.pow(radius, 2)) {
//         // Optimal velocity is too fast. Scale back to lie inside circle
//         targetVelocity = vec_mul(vec_normalize(optVelocity), radius);
//     } else {
//         targetVelocity = 
//     }
// }
