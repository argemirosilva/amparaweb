import MonitoringScheduleEditor from "@/components/configuracoes/MonitoringScheduleEditor";
import ChangePasswordCard from "@/components/configuracoes/ChangePasswordCard";
import RetentionSettingCard from "@/components/configuracoes/RetentionSettingCard";
import GpsSharingCard from "@/components/configuracoes/GpsSharingCard";
import AcionamentosCard from "@/components/configuracoes/AcionamentosCard";
import PageHeader from "@/components/ui/page-header";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader tag="Preferências" title="Configurações" />
      <div className="max-w-lg space-y-6">
        <ChangePasswordCard />
        <MonitoringScheduleEditor />
        <AcionamentosCard />
        <GpsSharingCard />
        <RetentionSettingCard />
      </div>
    </div>
  );
}
