import * as React from "react";
import { TitleBar } from "./title-bar";

/** Frameless window chrome: custom title bar above the routed content. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
