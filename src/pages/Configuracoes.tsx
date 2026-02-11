import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Key, Users } from "lucide-react";

const sections = [
  { icon: Clock, title: "Horários de Monitoramento", desc: "Configure os períodos de monitoramento automático." },
  { icon: Key, title: "Palavras-chave", desc: "Defina palavras que disparam alertas nas gravações." },
  { icon: Users, title: "Rede de Apoio", desc: "Gerencie os contatos que serão notificados em emergências." },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
      <div className="grid gap-4 max-w-lg">
        {sections.map((s) => (
          <Card key={s.title} className="opacity-60">
            <CardHeader className="flex-row items-center gap-4 space-y-0">
              <div className="ampara-icon-circle-sm">
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Em breve.</p>
    </div>
  );
}
