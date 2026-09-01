"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[320px] shrink-0 border-r border-line lg:block">
        <div className="sticky top-0 h-screen"><Sidebar /></div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] border-r border-line">
            <Sidebar onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setDrawer(true)} />
        {children}
      </div>
    </div>
  );
}
