import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  UserCircle,
  Settings,
} from "lucide-react";

const items = [
  { title: "Gravações", url: "/gravacoes", icon: Mic },
  { title: "Início", url: "/home", icon: LayoutDashboard, center: true },
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Config", url: "/configuracoes", icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-end justify-evenly h-14 px-2">
        {items.map((item) => {
          const active = location.pathname === item.url;
          const isCenter = (item as any).center;

          if (isCenter) {
            return (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className={`flex flex-col items-center justify-center -mt-4 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border-2 border-primary/30 text-primary"
                }`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-semibold leading-tight mt-0.5">{item.title}</span>
              </button>
            );
          }

          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 pb-1 transition-colors ${
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
