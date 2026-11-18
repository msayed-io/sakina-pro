import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SplashScreen from "./components/SplashScreen";
import { useDarkRims } from "./theme/useDarkRims";
import "./index.css";

// Start fetching the application bundle immediately, but do not make its
// synchronous module evaluation part of the first paint.
const appModulePromise = import("./App").then(async (module) => {
  try {
    await module.prepareScreens();
  } catch (error) {
    console.warn("Screen preparation failed; loading on demand:", error);
  }
  return module;
});
const App = lazy(() => appModulePromise);

function Boot() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  useDarkRims();

  useEffect(() => {
    let mounted = true;
    void appModulePromise.then(() => {
      if (mounted) setIsAppReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-[100dvh] w-full bg-[var(--sk-bg)] text-[var(--sk-label)]">
      {isAppReady && (
        <Suspense fallback={<div className="min-h-[100dvh] w-full bg-[var(--sk-bg)]" />}>
          <App />
        </Suspense>
      )}

      {!isSplashComplete && (
        <SplashScreen canComplete={isAppReady} onComplete={() => setIsSplashComplete(true)} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
