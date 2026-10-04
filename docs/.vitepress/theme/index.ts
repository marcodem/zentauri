import DefaultTheme from "vitepress/theme";
import "markdown-it-extensible/css";
import "./custom.css";
import type { Theme } from "vitepress";

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    if (typeof window !== "undefined") {
      import("mermaid")
        .then((m) => {
          m.default.initialize({
            startOnLoad: false,
            theme: "neutral",
            securityLevel: "loose",
          });

          const renderMermaid = async () => {
            const els = document.querySelectorAll(
              "pre.language-mermaid, div.language-mermaid pre",
            );
            els.forEach(async (el, idx) => {
              const code = el.textContent || "";
              if (!code.trim()) return;
              try {
                const { svg } = await m.default.render(
                  `mermaid-svg-${idx}-${Date.now()}`,
                  code,
                );
                const container = document.createElement("div");
                container.className = "mermaid-container";
                container.style.display = "flex";
                container.style.justifyContent = "center";
                container.style.margin = "2rem 0";
                container.innerHTML = svg;
                el.parentElement?.replaceChild(container, el);
              } catch (err) {
                console.error("Mermaid render error:", err);
              }
            });
          };

          router.onAfterRouteChanged = () => {
            setTimeout(renderMermaid, 100);
          };
          setTimeout(renderMermaid, 100);
        })
        .catch((err) => {
          console.warn("Could not load mermaid in docs:", err);
        });
    }
  },
} satisfies Theme;
