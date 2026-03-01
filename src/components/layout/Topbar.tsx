import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User } from "lucide-react";
import amparaLogo from "@/assets/ampara-circle-logo.png";

export default function Topbar() {
  const { usuario } = useAuth();

  return (
    <header className="h-14 border-b border-sidebar-border bg-sidebar md:bg-card md:border-border flex items-center justify-between px-4 shrink-0">
      {/* Icon only on mobile, no menu button */}
      <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 md:hidden">
        <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover invert mix-blend-screen" />
      </div>
      <SidebarTrigger className="hidden" />
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-sidebar-foreground md:text-foreground leading-tight">{usuario?.nome_completo}</p>
          <p className="text-xs text-sidebar-foreground/60 md:text-muted-foreground">{usuario?.email}</p>
        </div>
        {usuario?.avatar_url ? (
          <img src={usuario.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-sidebar-accent md:bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-sidebar-foreground/70 md:text-muted-foreground" />
          </div>
        )}
      </div>
    </header>
  );
}
