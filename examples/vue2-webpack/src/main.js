import Vue from "vue";
import Chativa from "@chativa/vue2";
import { dummy } from "./connector";
import App from "./App.vue";
import "./index.css";

// Registers + activates the connector, applies the theme, and registers
// <ChatIva>, <ChatBotButton> and <GenUIMessage> as global components.
Vue.use(Chativa, {
  connector: dummy,
  theme: {
    colors: { primary: "#42b883", secondary: "#35495e" },
    // Hide the (custom) launcher while the panel is open.
    hideButtonOnOpen: true,
  },
});

Vue.config.productionTip = false;

new Vue({ render: (h) => h(App) }).$mount("#app");
