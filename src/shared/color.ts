export interface Color {
    r: number;
    g: number;
    b: number;
}

export function color_mul(c: Color, scalar: number) {
    return { r: scalar * c.r, g: scalar * c.g, b: scalar * c.b };
}

export function color_add(a: Color, b: Color) {
    return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
}

export function color_html(color: Color, alpha: number): string {
    return `rgba(${color.r * 255}, ${color.g * 255}, ${
        color.b * 255
    }, ${alpha})`;
}
