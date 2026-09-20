import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "shopledger:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[shopledger] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

// Use an environment flag so TanStack's internal prerender preview reloads
// this same target configuration (it does not preserve Vite's mode).
const isPages = process.env.DEPLOY_TARGET === "github-pages";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
export default defineConfig(() => ({
  // Pages serves this repository under /ShopLedGer/, not the domain root.
  base: isPages ? "/ShopLedGer/" : "/",
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    tanstackStart(
      isPages
        ? {
            spa: { enabled: true, prerender: { outputPath: "/index.html" } },
            prerender: { autoStaticPathsDiscovery: false },
          }
        : {},
    ),
    // GitHub Pages can only serve static files; retain SSR for Vercel.
    ...(isPages ? [] : [nitro({ preset: "vercel" })]),
    viteReact(),
  ],
}));
