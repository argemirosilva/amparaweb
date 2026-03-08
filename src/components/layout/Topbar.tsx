import { SidebarTrigger } from "@/components/ui/sidebar";
import amparaLogo from "@/assets/ampara-circle-logo.png";

export default function Topbar() {
  return (
    <header
      className="h-14 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0"
      style={{ background: "var(--sidebar-bg-gradient)" }}
    >
      <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 md:hidden">
        <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover invert mix-blend-screen" />
      </div>
      <SidebarTrigger className="hidden" />
      <div className="flex-1" />
    </header>
  );
}
