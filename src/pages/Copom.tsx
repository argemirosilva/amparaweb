import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CopomCallCard from "@/components/copom/CopomCallCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FlaskConical } from "lucide-react";

export default function CopomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const alertId = searchParams.get("alerta") ?? undefined;
  const [testMode, setTestMode] = useState(!alertId);

  return (
    <div className="min-h-screen bg-background p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Comunicação de Emergência</h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {testMode && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 text-xs leading-relaxed flex items-start gap-2">
            <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Modo Teste:</strong> Dados simulados fixos serão usados. Nenhum alerta real será acionado.
              A ligação será feita para o número de teste configurado (5514997406686).
            </div>
          </div>
        )}

        {!testMode && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs leading-relaxed">
            <strong>Atenção:</strong> Este módulo aciona comunicação assistida por IA com o COPOM (Centro de Operações). 
            O agente de voz transmitirá os dados do alerta de forma segura, sem revelar informações sensíveis. 
            Mantenha o dispositivo próximo para que o operador ouça claramente.
          </div>
        )}

        <CopomCallCard panicAlertId={alertId} testMode={testMode} />

        {!alertId && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => setTestMode(!testMode)}
          >
            <FlaskConical className="w-3 h-3" />
            {testMode ? "Usar dados reais" : "Usar dados de teste"}
          </Button>
        )}
      </div>
    </div>
  );
}
