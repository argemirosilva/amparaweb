import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User } from "lucide-react";
import amparaIcon from "@/assets/ampara-icon.png";

export default function Topbar() {
  const { usuario } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      {/* Icon only on mobile, no menu button */}
      <div className="h-8 w-8 rounded-md bg-white flex items-center justify-center md:hidden">
        <img src={amparaIcon} alt="Ampara" className="h-7 w-7 object-contain" />
      </div>
      <SidebarTrigger className="hidden" />
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground leading-tight">{usuario?.nome_completo}</p>
          <p className="text-xs text-muted-foreground">{usuario?.email}</p>
        </div>
        {usuario?.avatar_url ? (
          <img src={usuario.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </header>
  );
}
