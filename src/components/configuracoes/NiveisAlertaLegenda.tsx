import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Info, ChevronDown } from "lucide-react";

export default function NiveisAlertaLegenda() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Entenda os Níveis de Alerta</h2>
        </div>

        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Grave e Crítico - baseados na Lei Maria da Penha</p>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">
          <Card>
            <CardContent className="px-4 py-3 space-y-3">
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">🟡 Alerta Grave</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Situações com sinais importantes de risco, como ameaças, humilhações constantes ou comportamentos agressivos que indicam escalada.
                </p>
              </div>

              <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">🔴 Alerta Crítico</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Situações de alto risco imediato, como ameaça de morte, agressão física, presença de arma, coerção ou violação de medida protetiva.
                </p>
              </div>

              <p className="text-xs text-muted-foreground italic">
                O nível é definido automaticamente com base na análise do contexto e no histórico da situação.
              </p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
