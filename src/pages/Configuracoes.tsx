import MonitoringScheduleEditor from "@/components/configuracoes/MonitoringScheduleEditor";
import ChangePasswordCard from "@/components/configuracoes/ChangePasswordCard";
import RetentionSettingCard from "@/components/configuracoes/RetentionSettingCard";
import GpsSharingCard from "@/components/configuracoes/GpsSharingCard";
import AcionamentosCard from "@/components/configuracoes/AcionamentosCard";
import PageHeader from "@/components/ui/page-header";
import { Shield, Bell, MapPin, Clock } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader tag="Preferências" title="Configurações" />
      <div className="max-w-lg space-y-8">
        {/* Security group */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground font-display">Segurança</h3>
          </div>
          <div className="space-y-4">
            <ChangePasswordCard />
          </div>
        </div>

        {/* Monitoring group */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground font-display">Monitoramento</h3>
          </div>
          <div className="space-y-4">
            <MonitoringScheduleEditor />
          </div>
        </div>

        {/* Triggers group */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground font-display">Acionamentos automáticos</h3>
          </div>
          <div className="space-y-4">
            <AcionamentosCard />
          </div>
        </div>

        {/* GPS group */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground font-display">GPS e Localização</h3>
          </div>
          <div className="space-y-4">
            <GpsSharingCard />
            <RetentionSettingCard />
          </div>
        </div>
      </div>
    </div>
  );
}
