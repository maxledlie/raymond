/* Module for drawing a force-directed graph in a p5js sketch */

const gravity = 1.1;
const startDisMultiplier = 10;

// An edge on the graph of connected intersection points
export interface Edge {
    from: number;
    to: number;
}

interface Node {
    x: number;
    y: number;
}

export class Graph {
    edges: Edge[];
    nodes: Map<number, Node>;
    scale: number;

    constructor(edges: Edge[], scale: number) {
        this.edges = edges;
        this.nodes = new Map<number, Node>();
        this.scale = scale;

        const nodeIds = new Set<number>(edges.flatMap(e => [e.from, e.to]));
        for (const id of nodeIds) {
            this.nodes.set(id, {
                x: (2 * Math.random() - 1) * scale,
                y: (2 * Math.random() - 1) * scale
            });
        }
    }

    addEdge(edge: Edge) {
        this.edges.push(edge);

        // If the edge references nodes not yet defined, add them to the graph at a randomised position
        if (!this.nodes.get(edge.from)) {
            this.nodes.set(edge.from, this.randomNodePosition());
        }
        if (!this.nodes.get(edge.to)) {
            this.nodes.set(edge.to, this.randomNodePosition());
        }
    }

    randomNodePosition(): Node {
        return ({
            x: (2 * Math.random() - 1) * this.scale,
            y: (2 * Math.random() - 1) * this.scale
        });
    }

    update(dt: number) {
        // Apply force towards centre
    }
}

export function draw_graph(p: p5, graph: Graph) {
    for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        p.line(from.x, from.y, to.x, to.y);
    }
    for (const node of graph.nodes.values()) {
        p.circle(node.x, node.y, 5);
    }
}
