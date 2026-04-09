import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import { UserSearch, ChevronRight, User, Shield, Mic, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import GradientIcon from "@/components/ui/gradient-icon";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const firstName = (usuario?.nome_completo || "").split(" ")[0];

  return (
    <div className="animate-fade-in min-h-full max-w-4xl pb-6">
      {/* Greeting section - organic style */}
      <div className="relative rounded-2xl overflow-hidden mb-4">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(280,60%,96%)] via-[hsl(320,40%,95%)] to-[hsl(280,30%,93%)] dark:from-[hsl(280,30%,12%)] dark:via-[hsl(320,20%,10%)] dark:to-[hsl(280,20%,8%)]" />

        {/* Organic blob shapes */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 opacity-[0.06]"
          style={{
            background: "radial-gradient(ellipse, hsl(320,70%,50%), transparent 70%)",
            borderRadius: "60% 40% 50% 50% / 50% 60% 40% 50%",
          }}
        />
        <div
          className="absolute -bottom-8 -left-8 w-32 h-32 opacity-[0.05]"
          style={{
            background: "radial-gradient(ellipse, hsl(280,60%,48%), transparent 70%)",
            borderRadius: "40% 60% 50% 50% / 60% 40% 50% 50%",
          }}
        />

        {/* Halftone pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(280,60%,48%) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Content */}
        <div className="relative px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-1">Início</p>
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                Olá, {firstName || "Bem-vinda"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Seu painel de proteção</p>
            </div>
            <button
              onClick={() => navigate("/perfil")}
              className="group relative"
            >
              {usuario?.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-primary/15 group-hover:ring-primary/30 transition-all"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 ring-2 ring-primary/15">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-3 px-1">
        {/* Device status */}
        <DeviceStatusCard />

        {/* Risk evolution */}
        <RiskEvolutionCard />

        {/* Quick actions - organic card */}
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden"
          style={{ boxShadow: "0 1px 3px 0 hsl(320 40% 30% / 0.04), 0 4px 16px -4px hsl(280 40% 30% / 0.06)" }}>
          <button
            onClick={() => navigate("/busca-perfil")}
            className="flex items-center gap-3 w-full text-left px-4 py-3.5 hover:bg-muted/50 active:bg-muted transition-colors"
          >
            <GradientIcon icon={UserSearch} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Pesquisar parceiro</p>
              <p className="text-[11px] text-muted-foreground">Consultar perfil e histórico</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          </button>

          <div className="h-px bg-border/40 mx-4" />

          {/* Audio recorder inline */}
          <div className="px-4 py-3">
            <AudioRecorderCard />
          </div>
        </div>

        {/* Monitoring */}
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
