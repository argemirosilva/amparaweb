import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  Mic,
  UserCircle,
  Settings,
} from "lucide-react";

const items = [
  { title: "Início", url: "/home", icon: LayoutDashboard },
  { title: "Mapa", url: "/mapa", icon: MapPin },
  { title: "Gravações", url: "/gravacoes", icon: Mic },
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Config", url: "/configuracoes", icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {items.map((item) => {
          const active = location.pathname === item.url;
          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
