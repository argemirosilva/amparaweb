import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import amparaLogo from "@/assets/ampara-circle-logo.png";

export default function Topbar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const initials = usuario?.nome_completo
    ? usuario.nome_completo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "";

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

      {/* User avatar */}
      <button
        onClick={() => navigate("/perfil")}
        className="relative group"
      >
        <div className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(circle, hsla(280,60%,48%,0.12), transparent 70%)" }} />
        <Avatar className="w-8 h-8 ring-2 ring-[hsla(280,60%,48%,0.15)] group-hover:ring-[hsla(280,60%,48%,0.3)] transition-all">
          <AvatarImage src={usuario?.avatar_url || undefined} alt={usuario?.nome_completo} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials || <User className="w-3.5 h-3.5" />}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  );
}
