import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BASE_URL } from "./staticSite";
import { LanguageProvider } from "./I18n";
import { MotionProvider } from "./Motion";
import "./palette.css";
import "./styles.css";
import "./public-base.css";
import "./experience.css";
import "./journal.css";
import "./refinement.css";
import "./home-hero.css";
import "./home-story.css";
import "./motion-polish.css";
import "./story-polish.css";
import "./view-transitions.css";
import "./mobile-type.css";
import "./story-chrome.css";
import "./chrome-fixes.css";
import "./interaction-polish.css";
import "./about.css";
import "./archive-editorial.css";
import "./page-rhythm.css";
import "./editions-page.css";
import "./pages-type.css";
import "./story-fixes.css";
import "./header.css";
import "./single-image.css";
import "./public-journal.css";
import "./hero-overlay.css";
import "./home-cinema.css";
import "./edge-media.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <MotionProvider>
        <BrowserRouter basename={BASE_URL.replace(/\/+$/, "") || undefined}>
          <App />
        </BrowserRouter>
      </MotionProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
