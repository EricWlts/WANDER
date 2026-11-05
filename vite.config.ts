import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const backend = process.env.WANDER_BACKEND_URL || "http://127.0.0.1:5001";
const publicSiteUrl = process.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");

function openGraphImage() {
  return {
    name: "wander-open-graph-image",
    transformIndexHtml(html: string) {
      if (!publicSiteUrl || html.includes('property="og:image"')) return html;
      let origin: URL;
      try {
        origin = new URL(publicSiteUrl);
      } catch {
        return html;
      }
      if (origin.protocol !== "https:") return html;
      const imageUrl = new URL(
        "/assets/brand/social/open-graph-1200x630.png",
        origin,
      ).href;
      return html.replace(
        "</head>",
        `    <meta property="og:image" content="${imageUrl}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n  </head>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), openGraphImage()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backend,
      "/media": backend,
    },
  },
});
