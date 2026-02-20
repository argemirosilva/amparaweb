import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import ProtectedAdminRoute from "./ProtectedAdminRoute";
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Plug,
  AudioLines,
} from "lucide-react";
import amparaLogo from "@/assets/ampara-logo.png";
import { useState } from "react";

const TECNICO_PATHS = ["/admin/configuracoes", "/admin/integracoes", "/admin/gerador-audios-ampara"];

const sidebarItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Usuários", path: "/admin/usuarios", icon: Users },
  { label: "Órgãos/Tenants", path: "/admin/orgaos", icon: Building2 },
  { label: "Auditoria", path: "/admin/auditoria", icon: Shield },
  { label: "Relatórios", path: "/admin/relatorios", icon: FileText },
  { label: "Gerador Áudios", path: "/admin/gerador-audios-ampara", icon: AudioLines },
  { label: "Configurações", path: "/admin/configuracoes", icon: Settings },
  { label: "Integrações", path: "/admin/integracoes", icon: Plug },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, usuario } = useAuth();
  const { roles, hasRole, tenantSigla } = useAdminRole();
  const isTecnico = hasRole("admin_master");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

  return (
    <ProtectedAdminRoute>
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
      {/* Topbar */}
      <header
        className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 z-30"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ color: "hsl(220 13% 18%)" }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={amparaLogo} alt="AMPARA" className="h-10 object-contain" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "hsl(224 76% 33%)" }}>
              Painel de Administração — AMPARA
            </span>
            {tenantSigla && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "hsl(224 76% 33% / 0.08)", color: "hsl(224 76% 33%)" }}
              >
                {tenantSigla}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
              {usuario?.nome_completo || "Administrador"}
            </p>
            <p className="text-xs uppercase" style={{ color: "hsl(220 9% 46%)" }}>
              {hasRole("admin_master") ? "Técnico" : "Operacional"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" style={{ color: "hsl(0 73% 42%)" }} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-16 left-0 z-20 w-60 border-r flex flex-col shrink-0
            transition-transform md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {sidebarItems
              .filter((item) => !TECNICO_PATHS.includes(item.path) || isTecnico)
              .map((item) => {
              const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors"
                  style={{
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "hsl(224 76% 33%)" : "hsl(220 9% 46%)",
                    background: isActive ? "hsl(224 76% 33% / 0.08)" : "transparent",
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
    </ProtectedAdminRoute>
  );
}
