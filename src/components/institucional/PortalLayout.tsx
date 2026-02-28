import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import amparaLogo from "@/assets/ampara-logo.png";

const navItems = [
  { label: "Início", path: "/transparencia" },
  { label: "Mapa", path: "/transparencia/mapa" },
  { label: "Metodologia", path: "/transparencia/metodologia" },
  { label: "Dados Abertos", path: "/transparencia/dados-abertos" },
];

export default function PortalLayout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      <Link
        to="/"
        onClick={onNav}
        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
      >
        <Home className="w-3.5 h-3.5" />
        Site
      </Link>
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNav}
            className={`text-sm font-medium transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header — same style as Landing Page */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-border bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/transparencia" className="flex items-center gap-3">
            <img src={amparaLogo} alt="AMPARA" className="h-12" />
            <span className="hidden sm:block text-sm font-semibold text-primary">
              Painel de Transparência
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 text-foreground" aria-label="Menu">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-12 flex flex-col gap-4">
              <NavLinks onNav={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — matching Landing Page style */}
      <footer className="border-t border-border bg-white px-4 md:px-8 py-8">
        <div className="max-w-7xl mx-auto text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Dados agregados. Atualização com atraso de 48h. Nenhuma informação individual é exibida.
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AMPARA — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
