import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Side-effect import: registers the custom "weather" GenUI component before
// any chat message could try to render one.
import "./CustomWeatherCard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
