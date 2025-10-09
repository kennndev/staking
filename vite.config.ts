import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(() => ({
  // root is the repo root (index.html lives here)
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./", "./client"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"]
    }
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          solana: ["@solana/web3.js", "@solana/spl-token", "@coral-xyz/anchor"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-toast"
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    react(),
    nodePolyfills({ protocolImports: true })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      buffer: "buffer"
    }
  },
  optimizeDeps: { include: ["buffer"] },
  define: { global: "globalThis" },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"]
}));
