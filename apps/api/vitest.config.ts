import { defineConfig } from "vitest/config";

// Each test boots an in-process PGlite; on a busy machine that alone can take several seconds.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
