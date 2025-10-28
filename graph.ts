/* Module for drawing a force-directed graph in a p5js sketch */

import { vec_add, vec_div, vec_magnitude, vec_mul, vec_sub, Vector } from "./math.js";

// An edge on the graph of connected intersection points
export interface Edge {
    from: number;
    to: number;
}

interface Node {
    id: number;
    position: Vector;
    velocity: Vector;
}

export class Graph {
    edges: Edge[];
    nodes: Map<number, Node>;
    scale: number;
    nodeMass: number;
    gravity: number;
    repulsion: number;

    constructor(edges: Edge[], scale: number, nodeMass?: number, gravity?: number, repulsion?: number) {
        this.edges = edges;
        this.nodes = new Map<number, Node>();
        this.scale = 100;
        this.nodeMass = nodeMass ?? 1000;
        this.gravity = gravity ?? 1.1;
        this.repulsion = repulsion ?? 10.0;
    }

    addEdge(edge: Edge) {
        this.edges.push(edge);

        // If the edge references nodes not yet defined, add them to the graph at a randomised position
        if (!this.nodes.get(edge.from)) {
            this.nodes.set(edge.from, this.initNode(edge.from));
        }
        if (!this.nodes.get(edge.to)) {
            this.nodes.set(edge.to, this.initNode(edge.to));
        }
    }

    initNode(id: number): Node {
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

    update(dt: number) {
        const nodeList = Array.from(this.nodes.values());
        const forces = new Array(nodeList.length).fill({ x: 0, y: 0 });

        for (let i = 0; i < nodeList.length; i++) {
            // Apply force towards center
            const distance = vec_magnitude(nodeList[i].position);
            forces[i] = vec_add(forces[i], vec_mul(nodeList[i].position, -this.gravity / Math.pow(distance, 2)));
            console.log(`force from gravity on node ${i}: ${vec_magnitude(forces[i])}`)

            // Apply repulsive force between nodes
            for (let j = i + 1; j < nodeList.length; j++) {
                const dir = vec_sub(nodeList[j].position, nodeList[i].position);
                const force = vec_mul(dir, this.repulsion / Math.pow(vec_magnitude(dir), 2));
                console.log(`force from repulsion between nodes ${i} and ${j}: ${vec_magnitude(force)}`)

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

        console.log(forces);

        // Apply old velocities to update positions, then forces to update the velocities
        for (let i = 0; i < nodeList.length; i++) {
            const nodeId = nodeList[i].id;
            const node = this.nodes.get(nodeId);

            node.position = vec_add(node.position, vec_mul(node.velocity, dt));
            node.velocity = vec_add(node.velocity, vec_mul(forces[i], dt / this.nodeMass));
        }

        // Annealing
        for (const node of this.nodes.values()) {
            node.velocity = vec_mul(node.velocity, 0.9);
        }
    }
}

export function draw_graph(p: p5, graph: Graph) {
    for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        p.line(from.position.x, from.position.y, to.position.x, to.position.y);
    }
    for (const node of graph.nodes.values()) {
        p.circle(node.position.x, node.position.y, 5);
    }
}
