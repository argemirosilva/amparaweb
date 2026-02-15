import { useSearchParams, useNavigate } from "react-router-dom";
import CopomCallCard from "@/components/copom/CopomCallCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CopomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const alertId = searchParams.get("alerta") ?? undefined;

  return (
    <div className="min-h-screen bg-background p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Comunicação de Emergência</h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs leading-relaxed">
          <strong>Atenção:</strong> Este módulo aciona comunicação assistida por IA com o COPOM (Centro de Operações). 
          O agente de voz transmitirá os dados do alerta de forma segura, sem revelar informações sensíveis. 
          Mantenha o dispositivo próximo para que o operador ouça claramente.
        </div>

        <CopomCallCard panicAlertId={alertId} />
      </div>
    </div>
  );
}
