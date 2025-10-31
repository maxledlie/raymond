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
        // Recompute bi-connected components after each edge addition
        this.computeBiconnectedComponents();
    }
    removeEdge(edge) {
        console.log("removing edge: ", edge);
        function match(e) {
            return e.from == edge.from && e.to == edge.to || e.to == edge.from && e.from == edge.to;
        }
        this.edges = this.edges.filter(x => !match(x));
        this.computeBiconnectedComponents();
    }
    /**
     * Tarjan's algorithm for bi-connected components.
     * Updates each node's componentId property.
     */
    computeBiconnectedComponents() {
        const nodes = Array.from(this.nodes.values());
        const n = nodes.length;
        const nodeIdToIndex = new Map();
        nodes.forEach((node, idx) => nodeIdToIndex.set(node.id, idx));
        // Build adjacency list
        const adj = Array(n).fill(null).map(() => []);
        for (const edge of this.edges) {
            const u = nodeIdToIndex.get(edge.from);
            const v = nodeIdToIndex.get(edge.to);
            if (u !== undefined && v !== undefined) {
                adj[u].push(v);
                adj[v].push(u);
            }
        }
        // Tarjan's variables
        let time = 0;
        const disc = Array(n).fill(-1);
        const low = Array(n).fill(-1);
        const parent = Array(n).fill(-1);
        const stack = [];
        let componentId = 0;
        const componentMap = [];
        function dfs(u) {
            disc[u] = low[u] = ++time;
            let children = 0;
            for (const v of adj[u]) {
                if (disc[v] === -1) {
                    parent[v] = u;
                    stack.push([u, v]);
                    children++;
                    dfs(v);
                    low[u] = Math.min(low[u], low[v]);
                    // If u is an articulation point, pop edges for this component
                    if ((parent[u] === -1 && children > 1) || (parent[u] !== -1 && low[v] >= disc[u])) {
                        const component = [];
                        let e;
                        do {
                            e = stack.pop();
                            if (e) {
                                if (!component.includes(e[0]))
                                    component.push(e[0]);
                                if (!component.includes(e[1]))
                                    component.push(e[1]);
                            }
                        } while (e && (e[0] !== u || e[1] !== v));
                        componentMap.push(component);
                    }
                }
                else if (v !== parent[u] && disc[v] < disc[u]) {
                    low[u] = Math.min(low[u], disc[v]);
                    stack.push([u, v]);
                }
            }
        }
        // Run DFS from all unvisited nodes
        for (let i = 0; i < n; i++) {
            if (disc[i] === -1) {
                dfs(i);
                // Pop remaining edges in stack as a component
                if (stack.length > 0) {
                    const component = [];
                    while (stack.length > 0) {
                        const e = stack.pop();
                        if (e) {
                            if (!component.includes(e[0]))
                                component.push(e[0]);
                            if (!component.includes(e[1]))
                                component.push(e[1]);
                        }
                    }
                    componentMap.push(component);
                }
            }
        }
        // Assign componentId to nodes
        nodes.forEach(node => { node.componentId = undefined; });
        componentMap.forEach((component, idx) => {
            for (const i of component) {
                nodes[i].componentId = idx;
            }
        });
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
    // Color palette for components
    const palette = [
        "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"
    ];
    for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        p.line(from.position.x, from.position.y, to.position.x, to.position.y);
    }
    for (const node of graph.nodes.values()) {
        // Pick color by componentId, fallback to white
        let color = "white";
        if (typeof node.componentId === "number") {
            color = palette[node.componentId % palette.length];
        }
        p.fill(color);
        p.circle(node.position.x, node.position.y, 10);
        p.fill("black");
        p.text(node.id, node.position.x - 10, node.position.y - 10);
    }
}
