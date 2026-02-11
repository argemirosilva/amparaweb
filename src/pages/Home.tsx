import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import amparaLogo from "@/assets/ampara-logo.png";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !usuario) {
      navigate("/login");
    }
  }, [loading, usuario, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="ampara-card max-w-md w-full text-center animate-fade-in">
        <img src={amparaLogo} alt="AMPARA" className="w-24 h-24 mx-auto mb-6 object-contain" />

        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Bem-vinda ao AMPARA
        </h1>

        <p className="text-muted-foreground mb-1">Você está conectada como:</p>
        <p className="text-foreground font-semibold mb-2">{usuario.nome_completo}</p>
        <p className="text-sm text-muted-foreground mb-8">{usuario.email}</p>

        <button
          onClick={handleLogout}
          className="ampara-btn-secondary inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
