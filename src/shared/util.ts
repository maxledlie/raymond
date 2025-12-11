export function clamped(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(val, min));
}