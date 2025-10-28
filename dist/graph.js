/* Module for drawing a force-directed graph in a p5js sketch */
const gravity = 1.1;
const startDisMultiplier = 10;
export class Graph {
    constructor(edges, scale) {
        this.edges = edges;
        this.nodes = new Map();
        this.scale = scale;
        const nodeIds = new Set(edges.flatMap(e => [e.from, e.to]));
        for (const id of nodeIds) {
            this.nodes.set(id, {
                x: (2 * Math.random() - 1) * scale,
                y: (2 * Math.random() - 1) * scale
            });
        }
    }
    addEdge(edge) {
        this.edges.push(edge);
        // If the edge references nodes not yet defined, add them to the graph at a randomised position
        if (!this.nodes.get(edge.from)) {
            this.nodes.set(edge.from, this.randomNodePosition());
        }
        if (!this.nodes.get(edge.to)) {
            this.nodes.set(edge.to, this.randomNodePosition());
        }
    }
    randomNodePosition() {
        return ({
            x: (2 * Math.random() - 1) * this.scale,
            y: (2 * Math.random() - 1) * this.scale
        });
    }
    update(dt) {
        // Apply force towards centre
    }
}
export function draw_graph(p, graph) {
    for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        p.line(from.x, from.y, to.x, to.y);
    }
    for (const node of graph.nodes.values()) {
        p.circle(node.x, node.y, 5);
    }
}
