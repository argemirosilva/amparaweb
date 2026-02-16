import { Outlet, Link, useLocation } from "react-router-dom";
import amparaLogo from "@/assets/ampara-logo.png";

const navItems = [
  { label: "Início", path: "/transparencia" },
  { label: "Mapa", path: "/transparencia/mapa" },
  { label: "Metodologia", path: "/transparencia/metodologia" },
  { label: "Dados Abertos", path: "/transparencia/dados-abertos" },
];

export default function PortalLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(210 17% 96%)" }}>
      {/* Header */}
      <header
        className="h-16 border-b flex items-center justify-between px-4 md:px-8 shrink-0"
        style={{
          background: "hsl(0 0% 100%)",
          borderColor: "hsl(220 13% 91%)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src={amparaLogo} alt="AMPARA" className="h-8 object-contain" />
          <div className="hidden sm:block">
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: "hsl(224 76% 33%)", fontFamily: "Inter, Roboto, sans-serif" }}
            >
              AMPARA — Painel de Transparência
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="px-3 py-2 text-sm rounded transition-colors"
                style={{
                  fontFamily: "Inter, Roboto, sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "hsl(224 76% 33%)" : "hsl(220 9% 46%)",
                  background: isActive ? "hsl(224 76% 33% / 0.08)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        className="border-t px-4 md:px-8 py-6 text-center"
        style={{
          background: "hsl(0 0% 100%)",
          borderColor: "hsl(220 13% 91%)",
          fontFamily: "Inter, Roboto, sans-serif",
        }}
      >
        <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
          Dados agregados. Atualização com atraso de 48h. Nenhuma informação individual é exibida.
        </p>
        <p className="text-xs mt-1" style={{ color: "hsl(220 9% 46%)" }}>
          © {new Date().getFullYear()} AMPARA — Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
}
