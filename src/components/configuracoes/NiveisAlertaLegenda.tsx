import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function NiveisAlertaLegenda() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Entenda os Níveis de Alerta</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        O AMPARA classifica situações de risco com base na Lei Maria da Penha, considerando o tipo de violência e o grau de perigo envolvido.
      </p>

      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipos de Violência</p>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li><span className="font-medium">Psicológica</span> <span className="text-muted-foreground">— Humilhações, ameaças, controle excessivo, manipulação, isolamento.</span></li>
            <li><span className="font-medium">Física</span> <span className="text-muted-foreground">— Qualquer agressão contra o corpo.</span></li>
            <li><span className="font-medium">Moral</span> <span className="text-muted-foreground">— Ofensas, difamação ou exposição para prejudicar a reputação.</span></li>
            <li><span className="font-medium">Patrimonial</span> <span className="text-muted-foreground">— Destruição ou controle de bens, documentos ou dinheiro.</span></li>
            <li><span className="font-medium">Sexual</span> <span className="text-muted-foreground">— Forçar ou constranger relações ou práticas íntimas.</span></li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Como o AMPARA classifica</p>

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
    </div>
  );
}
