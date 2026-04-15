import { useAuth } from "@/contexts/AuthContext";
import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import amparaLogo from "@/assets/ampara-circle-logo-color.png";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getContextualMessage(device: any, online: boolean): string {
  if (!device) return "Conecte seu dispositivo para que eu possa te acompanhar.";
  if (device.panicActive) return "Estou monitorando tudo. Ajuda está a caminho.";
  if (device.is_recording) return "Estou ouvindo e registrando. Você não está sozinha.";
  if (device.is_monitoring && online) return "Estou atenta ao seu redor. Tudo tranquilo até agora.";
  if (online) return "Estou aqui, conectada e pronta se precisar de mim.";
  return "Seu dispositivo está offline. Estarei aqui quando voltar.";
}

export default function AmparaPresenceCard() {
  const { usuario } = useAuth();
  const { device } = useDeviceStatus();
  const firstName = usuario?.nome_completo?.split(" ")[0] || "";

  const online = device?.last_ping_at
    ? Date.now() - new Date(device.last_ping_at).getTime() < 45_000
    : false;

  const greeting = getGreeting();
  const message = getContextualMessage(device, online);

  const isActive = online && (device?.is_monitoring || device?.is_recording);

  return (
    <div className="flex items-center gap-3 px-1 py-2">
      {/* Ampara presence orb */}
      <div className="relative shrink-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-1000 ${
            isActive
              ? "shadow-[0_0_16px_hsl(263_70%_50%/0.2)]"
              : ""
          }`}
          style={{ background: "var(--ampara-gradient)" }}
        >
          <span className="text-primary-foreground text-sm font-bold">A</span>
        </div>
        {/* Breathing pulse ring */}
        {isActive && (
          <span className="absolute inset-0 rounded-full animate-[ampara-breathe_3s_ease-in-out_infinite] border-2 border-primary/20 pointer-events-none" />
        )}
        {/* Online dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card transition-colors ${
            online ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
        />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {greeting}, {firstName}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
