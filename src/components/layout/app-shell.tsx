import * as React from "react";

/** Full-height routed app surface. Native window chrome is handled by Tauri. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-0">{children}</div>;
}
