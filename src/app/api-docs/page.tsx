"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <SwaggerUI
        url="/api/openapi.json"
        persistAuthorization={true}
        tryItOutEnabled={true}
        displayRequestDuration={true}
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={2}
      />
    </div>
  );
}
