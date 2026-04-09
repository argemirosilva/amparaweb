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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom overflow-hidden" style={{ background: "var(--sidebar-bg-gradient)" }}>
      {/* Organic wave top border */}
      <div className="absolute -top-3 left-0 right-0 h-4">
        <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,16 C80,0 160,12 200,4 C240,-4 320,8 400,16 L400,16 L0,16 Z" fill="hsl(320, 70%, 55%)" fillOpacity="0.08" />
        </svg>
      </div>

      <div className="flex items-end justify-evenly h-14 px-2 relative">
        {/* Decorative dots */}
        <div className="absolute top-1 left-8 w-1 h-1 rounded-full opacity-10" style={{ background: "hsl(320, 70%, 60%)" }} />
        <div className="absolute top-2 right-12 w-0.5 h-0.5 rounded-full opacity-10" style={{ background: "hsl(280, 60%, 55%)" }} />

        {items.map((item) => {
          const active = location.pathname === item.url;
          const isCenter = (item as any).center;

          if (isCenter) {
            return (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className={`flex flex-col items-center justify-center -mt-4 transition-all duration-300 ${
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                    active
                      ? "text-sidebar-primary-foreground scale-105"
                      : "bg-sidebar-accent border-2 border-sidebar-primary/30 text-sidebar-primary"
                  }`}
                  style={active ? { background: "linear-gradient(135deg, hsl(280,60%,48%), hsl(320,70%,50%))" } : undefined}
                >
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
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 pb-1 transition-all duration-200 ${
                active
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${active ? "" : ""}`}
                style={active ? { background: "hsla(320, 70%, 55%, 0.1)" } : undefined}
              >
                <item.icon className="w-5 h-5" />
                {active && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: "hsl(320, 70%, 55%)" }} />
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
