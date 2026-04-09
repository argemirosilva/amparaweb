import { SidebarTrigger } from "@/components/ui/sidebar";
import amparaLogo from "@/assets/ampara-circle-logo.png";

export default function Topbar() {
  return (
    <header
      className="h-14 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0 relative overflow-hidden"
      style={{ background: "var(--sidebar-bg-gradient)" }}
    >
      {/* Decorative elements */}
      <div className="absolute -top-4 -right-8 w-20 h-20 rounded-full opacity-[0.04]" style={{ background: "hsl(320, 70%, 55%)" }} />
      <div className="absolute -bottom-6 left-1/3 w-12 h-12 rounded-full opacity-[0.03]" style={{ background: "hsl(280, 60%, 50%)" }} />

      <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 md:hidden relative">
        <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
      </div>
      <SidebarTrigger className="hidden" />
      <div className="flex-1" />
    </header>
  );
}
