import MonitoringScheduleEditor from "@/components/configuracoes/MonitoringScheduleEditor";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
      <div className="max-w-lg">
        <MonitoringScheduleEditor />
      </div>
    </div>
  );
}
