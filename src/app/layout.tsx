import type { ReactNode } from "react";

// Minimal root layout — this project is API-only (no frontend pages)
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
