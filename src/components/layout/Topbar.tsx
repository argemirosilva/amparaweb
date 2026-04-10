import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import amparaLogo from "@/assets/ampara-circle-logo-color.png";

export default function Topbar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const initials = usuario?.nome_completo
    ? usuario.nome_completo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 sticky top-0 z-40 bg-card/80 backdrop-blur-md">
      {/* Logo mobile */}
      <div className="relative md:hidden">
        <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 ring-1 ring-border">
          <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
        </div>
      </div>
      <SidebarTrigger className="hidden" />
      <div className="flex-1" />

      {/* User greeting + avatar */}
      <button
        onClick={() => navigate("/perfil")}
        className="group flex items-center gap-2.5"
      >
        <span className="text-sm font-medium text-foreground hidden sm:inline">
          Olá, {usuario?.nome_completo?.split(" ")[0] || "usuária"}
        </span>
        <Avatar className="w-8 h-8 ring-1 ring-border group-hover:ring-primary/30 transition-all">
          <AvatarImage src={usuario?.avatar_url || undefined} alt={usuario?.nome_completo} />
          <AvatarFallback className="bg-primary/[0.08] text-primary text-xs font-medium">
            {initials || <User className="w-3.5 h-3.5" />}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  );
}
