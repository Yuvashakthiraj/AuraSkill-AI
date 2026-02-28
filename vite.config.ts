import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { auraSkillApiPlugin } from "./server/apiServer";
import { openaiProxyPlugin } from "./server/openaiProxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // AuraSkill AI backend API (auth, DB, proxies)
    auraSkillApiPlugin(),
    // OpenAI backend proxy — key stays server-side
    openaiProxyPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
