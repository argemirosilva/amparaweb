import MonitoringScheduleEditor from "@/components/configuracoes/MonitoringScheduleEditor";
import ChangePasswordCard from "@/components/configuracoes/ChangePasswordCard";
import RetentionSettingCard from "@/components/configuracoes/RetentionSettingCard";
import GpsSharingCard from "@/components/configuracoes/GpsSharingCard";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
      <div className="max-w-lg space-y-6">
        <ChangePasswordCard />
        <MonitoringScheduleEditor />
        <GpsSharingCard />
        <RetentionSettingCard />
      </div>
    </div>
  );
}
