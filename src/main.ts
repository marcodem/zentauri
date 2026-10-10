import { createApp } from "vue";
import App from "./App.vue";
import { initTheme } from "./lib/theme";
import "katex/dist/katex.min.css";
import "./styles.css";

initTheme();

createApp(App).mount("#app");
