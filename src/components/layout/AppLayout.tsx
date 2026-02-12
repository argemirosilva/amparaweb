import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import Topbar from "./Topbar";
import BottomNav from "./BottomNav";
import ProtectedRoute from "./ProtectedRoute";

export default function AppLayout() {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full max-w-[100vw] overflow-x-hidden">
          {/* Sidebar only on md+ */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6 flex flex-col">
              <Outlet />
            </main>
          </div>
        </div>
        {/* Bottom nav only on mobile */}
        <BottomNav />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
