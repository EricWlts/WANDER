import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./I18n";
import { MotionProvider } from "./Motion";
import "./styles.css";
import "./builder.css";
import "./experience.css";
import "./journal.css";
import "./refinement.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <MotionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MotionProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
