import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "analyze" && visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true }),
  ].filter(Boolean),
  define: {
    // Referrer-restricted browser key (safe in bundle). Single source of truth
    // for all Google Maps usage in the app — allowlist covers godalz.com,
    // www.godalz.com, *.lovable.app and rentalcarsystem.lovable.app.
    "import.meta.env.VITE_ZEUS_GOOGLE_MAPS_PREVIEW_BROWSER_KEY": JSON.stringify(process.env.GOOGLE_MAPS_BROWSER_KEY || "AIzaSyCJpffmY5NsZSzo_gHniRSEdPlE16jlBeA"),
    "import.meta.env.VITE_ZEUS_GOOGLE_MAPS_CUSTOM_BROWSER_KEY": JSON.stringify(process.env.GOOGLE_MAPS_BROWSER_KEY_1 || "AIzaSyCJpffmY5NsZSzo_gHniRSEdPlE16jlBeA"),
    "import.meta.env.VITE_ZEUS_GOOGLE_MAPS_TRACKING_ID": JSON.stringify(process.env.GOOGLE_MAPS_TRACKING_ID || "d336d41c63628490a13e917925cfd256"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    // Wave 1 perf: split de vendor pra mobile não baixar 1 bundle gigante.
    // Cada chunk é cacheado independente — mudança em supabase não invalida
    // o react, etc. Ganho real no primeiro load mobile e nas navegações.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "motion": ["framer-motion"],
          "query": ["@tanstack/react-query"],
          "charts": ["recharts"],
          // shadcn/radix pesa bastante somado — fica num chunk só.
          "radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
    // Mensagens de chunk grande não param o build, mas avisam.
    chunkSizeWarningLimit: 900,
  },
}));
