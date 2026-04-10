import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  UserCircle,
  Settings,
  UserSearch,
} from "lucide-react";

const items = [
  { title: "Gravações", url: "/gravacoes", icon: Mic },
  { title: "Pesquisar", url: "/busca-perfil", icon: UserSearch },
  { title: "Início", url: "/home", icon: LayoutDashboard, center: true },
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Config", url: "/configuracoes", icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom bg-card border-t border-border">
      <div className="flex items-end justify-evenly h-16 px-2">
        {items.map((item) => {
          const active = location.pathname === item.url;
          const isCenter = (item as any).center;

          if (isCenter) {
            return (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className="flex flex-col items-center justify-center -mt-5 transition-all duration-200"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    active
                      ? "text-white scale-105"
                      : "bg-card border-2 border-primary/20 text-primary"
                  }`}
                  style={active ? { background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(292,84%,61%))" } : undefined}
                >
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-semibold leading-tight mt-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.title}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pb-1.5 transition-all duration-200 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-primary/[0.08]" : ""}`}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
