import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";

export default function PerfilPage() {
  const { usuario } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Perfil</h1>
      <div className="ampara-card max-w-lg space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">{usuario?.nome_completo}</p>
            <p className="text-sm text-muted-foreground">{usuario?.email}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Nome completo</p>
            <p className="text-foreground">{usuario?.nome_completo}</p>
          </div>
          <div>
            <p className="text-muted-foreground">E-mail</p>
            <p className="text-foreground">{usuario?.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Telefone</p>
            <p className="text-foreground">—</p>
          </div>
        </div>

        <Button variant="outline" disabled>Editar</Button>
      </div>
    </div>
  );
}
