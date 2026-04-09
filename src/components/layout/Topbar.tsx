import { SidebarTrigger } from "@/components/ui/sidebar";
import amparaLogo from "@/assets/ampara-circle-logo.png";

export default function Topbar() {
  return (
    <header
      className="h-14 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0 relative overflow-hidden"
      style={{ background: "var(--sidebar-bg-gradient)" }}
    >
      {/* Decorative organic circles */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.08]" style={{ background: "hsl(320, 70%, 55%)" }} />
      <div className="absolute -bottom-10 left-1/4 w-20 h-20 rounded-full opacity-[0.05]" style={{ background: "hsl(280, 60%, 50%)" }} />
      <div className="absolute top-2 right-1/3 w-1 h-1 rounded-full opacity-20 animate-pulse" style={{ background: "hsl(320, 70%, 60%)" }} />

      {/* Logo with half-circle accent */}
      <div className="relative md:hidden">
        <div className="absolute -inset-1.5 rounded-full" style={{ background: "linear-gradient(135deg, hsla(280,60%,48%,0.12), hsla(320,70%,50%,0.08))" }} />
        <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 ring-2 ring-[hsla(280,60%,48%,0.15)]">
          <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
        </div>
      </div>
      <SidebarTrigger className="hidden" />
      <div className="flex-1" />
    </header>
  );
}
