import { createApp } from "vue";
import { ChativaPlugin } from "@chativa/vue";
import App from "./App.vue";
import { dummy } from "./connector";
import "./style.css";

createApp(App)
  // Registers <ChatIva>, <ChatBotButton> and <GenUIMessage> globally and
  // activates the connector + theme before any widget mounts.
  .use(ChativaPlugin, {
    connector: dummy,
    theme: {
      colors: { primary: "#42b883", secondary: "#35495e" },
      // Hide the (custom) launcher while the panel is open.
      hideButtonOnOpen: true,
    },
  })
  .mount("#app");
