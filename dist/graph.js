/* Module for drawing a force-directed graph in a p5js sketch */
import { vec_add, vec_magnitude, vec_mul, vec_sub } from "./math.js";
export class Graph {
    constructor(edges, scale, nodeMass, gravity, repulsion) {
        this.edges = edges;
        this.nodes = new Map();
        this.scale = 100;
        this.nodeMass = nodeMass !== null && nodeMass !== void 0 ? nodeMass : 1000;
        this.gravity = gravity !== null && gravity !== void 0 ? gravity : 1.1;
        this.repulsion = repulsion !== null && repulsion !== void 0 ? repulsion : 10.0;
    }
    addEdge(edge) {
        this.edges.push(edge);
        // If the edge references nodes not yet defined, add them to the graph at a randomised position
        if (!this.nodes.get(edge.from)) {
            this.nodes.set(edge.from, this.initNode(edge.from));
        }
        if (!this.nodes.get(edge.to)) {
            this.nodes.set(edge.to, this.initNode(edge.to));
        }
    }
    initNode(id) {
        return ({
            id,
            position: {
                x: (2 * Math.random() - 1) * this.scale,
                y: (2 * Math.random() - 1) * this.scale,
            },
            velocity: {
                x: 0,
                y: 0
            }
        });
    }
    update(dt) {
        const _dt = Math.max(dt, 0.1);
        const nodeList = Array.from(this.nodes.values());
        const forces = new Array(nodeList.length).fill({ x: 0, y: 0 });
        for (let i = 0; i < nodeList.length; i++) {
            // Apply force towards center
            const distance = vec_magnitude(nodeList[i].position);
            forces[i] = vec_add(forces[i], vec_mul(nodeList[i].position, -this.gravity / Math.pow(distance, 2)));
            // Apply repulsive force between nodes
            for (let j = i + 1; j < nodeList.length; j++) {
                const dir = vec_sub(nodeList[j].position, nodeList[i].position);
                const force = vec_mul(dir, this.repulsion / Math.pow(vec_magnitude(dir), 2));
                forces[j] = vec_add(forces[j], force);
                forces[i] = vec_sub(forces[i], force);
            }
        }
        // Apply forces due to connections
        for (const edge of this.edges) {
            const node1 = this.nodes.get(edge.from);
            const node2 = this.nodes.get(edge.to);
            const dis = vec_sub(node1.position, node2.position);
            const node1Index = nodeList.findIndex(n => (n.id == edge.from)); // Slow and hacky
            const node2Index = nodeList.findIndex(n => (n.id == edge.to)); // Slow and hacky
            const force = vec_mul(dis, 0.01);
            forces[node1Index] = vec_sub(forces[node1Index], force);
            forces[node2Index] = vec_add(forces[node2Index], force);
        }
        // Apply old velocities to update positions, then forces to update the velocities
        for (let i = 0; i < nodeList.length; i++) {
            const nodeId = nodeList[i].id;
            const node = this.nodes.get(nodeId);
            node.position = vec_add(node.position, vec_mul(node.velocity, _dt));
            node.velocity = vec_add(node.velocity, vec_mul(forces[i], _dt / this.nodeMass));
        }
        // Annealing
        for (const node of this.nodes.values()) {
            node.velocity = vec_mul(node.velocity, 0.9);
        }
    }
}
export function draw_graph(p, graph) {
    p.stroke("black");
    p.fill("white");
    for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        p.line(from.position.x, from.position.y, to.position.x, to.position.y);
    }
    for (const node of graph.nodes.values()) {
        p.fill("white");
        p.circle(node.position.x, node.position.y, 10);
        p.fill("black");
        p.text(node.id, node.position.x - 10, node.position.y - 10);
    }
}
