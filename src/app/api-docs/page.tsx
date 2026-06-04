"use client";

import { useEffect, useRef } from "react";

// swagger-ui-dist v5 exposes SwaggerUIBundle and SwaggerUIStandalonePreset as named exports.
// We dynamically import to avoid SSR issues (the bundle is browser-only).
// Using swagger-ui-dist instead of swagger-ui-react eliminates the
// UNSAFE_componentWillReceiveProps / ModelCollapse warning under React StrictMode.
type SwaggerUIConfig = {
  url?: string;
  domNode: HTMLElement;
  presets: unknown[];
  layout?: string;
  persistAuthorization?: boolean;
  tryItOutEnabled?: boolean;
  displayRequestDuration?: boolean;
  defaultModelsExpandDepth?: number;
  defaultModelExpandDepth?: number;
};

type SwaggerUIInstance = {
  unmount?: () => void;
};

type SwaggerUIBundleFn = ((config: SwaggerUIConfig) => SwaggerUIInstance) & {
  presets: { apis: unknown };
};

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ui: SwaggerUIInstance | undefined;

    async function init() {
      // Dynamically import to keep SSR-safe; CJS compat via webpack interop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dist = (await import("swagger-ui-dist")) as any;
      const SwaggerUIBundle: SwaggerUIBundleFn = dist.SwaggerUIBundle ?? dist.default?.SwaggerUIBundle;
      const SwaggerUIStandalonePreset: unknown =
        dist.SwaggerUIStandalonePreset ?? dist.default?.SwaggerUIStandalonePreset;

      if (!SwaggerUIBundle || !containerRef.current) return;

      // Inject CSS once
      if (!document.getElementById("swagger-ui-css")) {
        const link = document.createElement("link");
        link.id = "swagger-ui-css";
        link.rel = "stylesheet";
        link.href = "/swagger-ui.css";
        document.head.appendChild(link);
      }

      ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        domNode: containerRef.current,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
      });
    }

    init();

    return () => {
      ui?.unmount?.();
    };
  }, []);

  return <div ref={containerRef} style={{ minHeight: "100vh" }} />;
}
