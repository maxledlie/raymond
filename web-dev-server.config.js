import { esbuildPlugin } from "@web/dev-server-esbuild";

export default {
    rootDir: "src",
    nodeResolve: true,
    plugins: [
        esbuildPlugin({ ts: true, auto: true }),
    ],
};