import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/tiny-chess-variant-45/' : '/',
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3005',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      }
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }

}));