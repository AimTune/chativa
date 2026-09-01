import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es", "cjs"],
            fileName: (fmt) => `index.${fmt === "es" ? "js" : "cjs"}`,
        },
        rollupOptions: {
            // `@chativa/genui` must stay external: inlining it made this bundle
            // define `genui-card`, `genui-chart`, … a second time, so an app that
            // imported both packages hit an already-defined custom element and
            // `MessageTypeRegistry` ended up holding an unconstructable class —
            // every GenUI message then fell back to plain text. Third-party deps
            // are external for the same reason (one i18next instance, one lit).
            // The CDN build (vite.config.cdn.ts) still bundles everything.
            external: [
                "lit",
                /^lit\//,
                "@chativa/core",
                /^@chativa\/core\//,
                "@chativa/genui",
                "i18next",
                "i18next-browser-languagedetector",
                "marked",
                "@lit-labs/virtualizer",
                /^@lit-labs\/virtualizer\//,
            ],
        },
        sourcemap: true,
    },
    plugins: [dts({ rollupTypes: true })],
});
