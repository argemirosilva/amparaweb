import MonitoringScheduleEditor from "@/components/configuracoes/MonitoringScheduleEditor";
import ChangePasswordCard from "@/components/configuracoes/ChangePasswordCard";
import RetentionSettingCard from "@/components/configuracoes/RetentionSettingCard";
import GpsSharingCard from "@/components/configuracoes/GpsSharingCard";
import AcionamentosCard from "@/components/configuracoes/AcionamentosCard";
import NiveisAlertaLegenda from "@/components/configuracoes/NiveisAlertaLegenda";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Azure-style page header */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Preferências</p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Configurações</h1>
      </div>
      <div className="max-w-lg space-y-6">
        <ChangePasswordCard />
        <MonitoringScheduleEditor />
        <NiveisAlertaLegenda />
        <AcionamentosCard />
        <GpsSharingCard />
        <RetentionSettingCard />
      </div>
    </div>
  );
}
