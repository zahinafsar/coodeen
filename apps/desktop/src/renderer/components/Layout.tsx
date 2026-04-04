import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { DrawerProvider } from "../contexts/DrawerContext";
import { ProjectProvider } from "../contexts/ProjectContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Layout() {
  return (
    <DrawerProvider>
      <ProjectProvider>
        <TooltipProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-hidden">
              <Outlet />
            </main>
            <Toaster />
          </div>
        </TooltipProvider>
      </ProjectProvider>
    </DrawerProvider>
  );
}
