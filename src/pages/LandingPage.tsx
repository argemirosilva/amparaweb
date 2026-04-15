import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Heart, Users, TrendingUp, Smartphone, Mic, FileUp,
  MapPin, Search, Headphones, Settings, Check, Star, Menu,
  Building2, Users2, Phone, Mail, Instagram,
  ChevronRight, Lock, ArrowRight, Radio, LogIn, UserPlus, Eye,
  Shield, BookOpen, Activity, Database, Clock, ShieldCheck,
  Ear, Upload, MessageCircle } from
"lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import amparaLogo from "@/assets/ampara-logo-transparent.png";
import heroWoman from "@/assets/login-illustration.png";
import partnerFacimus from "@/assets/partner-facimus.png";
import partnerHpe from "@/assets/partner-hpe.svg";
import partnerOrizon from "@/assets/orizon-tech-logo.png";
import partnerAggregar from "@/assets/partner-aggregar-v3.png";
import partnerSinergytech from "@/assets/partner-sinergytech.png";

/* ── helpers ── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── Decorative organic blob component ── */
function OrgBlob({ className, color = "hsl(320,70%,50%)", style }: { className?: string; color?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        background: `radial-gradient(ellipse, ${color}, transparent 70%)`,
        borderRadius: "60% 40% 50% 50% / 50% 60% 40% 50%",
        ...style,
      }}
    />
  );
}

/* ── Halftone pattern overlay ── */
function HalftoneOverlay({ opacity = 0.03 }: { opacity?: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(280,60%,48%) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        opacity,
      }}
    />
  );
}

/* ── Section wrapper with organic background ── */
function OrganicSection({ id, children, className = "", variant = "light" }: { id?: string; children: React.ReactNode; className?: string; variant?: "light" | "warm" | "cool" | "white" }) {
  const bgMap = {
    light: "bg-background",
    warm: "bg-muted/30",
    cool: "bg-muted/20",
    white: "bg-background",
  };

  return (
    <section id={id} className={`py-16 md:py-24 relative overflow-hidden ${bgMap[variant]} ${className}`}>
      {children}
    </section>
  );
}

/* ── data ── */
const NAV_LINKS = [
  { label: "Sobre", id: "sobre" },
  { label: "Funcionalidades", id: "funcionalidades" },
  { label: "Como Funciona", id: "como-funciona" },
  { label: "FAQ", id: "faq" },
  { label: "Contato", id: "contato" },
];

const FEATURES = [
  { icon: TrendingUp, title: "Seu Nível de Segurança", desc: "Veja como está sua situação nos últimos dias. Eu te aviso se algo mudar." },
  { icon: Smartphone, title: "Saber se seu celular está protegido", desc: "Confira se seu celular está conectado e funcionando direitinho com a Ampara." },
  { icon: Mic, title: "Grava o que acontece ao redor", desc: "O celular grava o som ao redor de forma discreta, pra você ter provas se precisar." },
  { icon: FileUp, title: "Guarda provas com segurança", desc: "Salva fotos, áudios e documentos num lugar seguro, só você tem acesso." },
  { icon: MapPin, title: "Compartilha onde você está", desc: "Suas pessoas de confiança podem ver onde você está em tempo real, se precisar." },
  { icon: Search, title: "Consulta sobre agressores", desc: "Veja se outras mulheres já denunciaram a mesma pessoa. Informação salva vidas." },
  { icon: Headphones, title: "Alguém pra te ouvir", desc: "Uma equipe preparada pra te atender com respeito e cuidado, quando você precisar." },
  { icon: Settings, title: "Você controla tudo", desc: "Escolha quando o monitoramento liga, quem recebe alertas e como tudo funciona." },
];

const STEPS = [
  { num: "1", title: "Cadastre-se", desc: "Crie sua conta de forma rápida e segura, com total sigilo dos seus dados." },
  { num: "2", title: "Ative o monitoramento", desc: "Configure seu dispositivo e ative a proteção em tempo real." },
  { num: "3", title: "Use as ferramentas", desc: "Grave áudios, compartilhe localização e acesse análises de risco." },
  { num: "4", title: "Conte com suporte", desc: "Acione guardiões, autoridades e equipe de apoio sempre que precisar." },
];

const TESTIMONIALS = [
  { name: "Maria S.", initials: "MS", text: "A Ampara me deu a coragem que eu precisava para dar o primeiro passo. Saber que alguém está monitorando minha segurança muda tudo.", stars: 5 },
  { name: "Ana L.", initials: "AL", text: "As gravações automáticas foram fundamentais no meu processo. A tecnologia realmente protege e ampara quem mais precisa.", stars: 5 },
  { name: "Juliana R.", initials: "JR", text: "O compartilhamento de localização com meus guardiões me dá tranquilidade para seguir minha rotina. Recomendo para todas.", stars: 5 },
];

const FAQ_ITEMS = [
  { q: "Como funciona o monitoramento em tempo real?", a: "A Ampara utiliza inteligência artificial para monitorar continuamente o ambiente sonoro através do microfone do seu celular, de forma totalmente discreta - sem que ninguém perceba. Eu analiso os áudios captados em busca de padrões que possam indicar situações de violência, como gritos, ameaças verbais e xingamentos. Quando algo suspeito é identificado, um alerta é gerado automaticamente. Você define os horários de monitoramento e pode ativá-lo ou desativá-lo a qualquer momento." },
  { q: "Meus dados estão seguros?", a: "Sua segurança digital é prioridade máxima. Utilizo criptografia de ponta a ponta em todas as transmissões, e os dados são armazenados em servidores seguros com criptografia em repouso. Nenhuma informação é compartilhada com terceiros sem o seu consentimento explícito. Gravações que não apresentam risco são automaticamente excluídas conforme o período de retenção que você configurar. Sigo integralmente a LGPD (Lei Geral de Proteção de Dados) e você pode solicitar a exclusão dos seus dados a qualquer momento." },
  { q: "Quem pode ver minhas informações?", a: "Apenas você tem acesso completo às suas informações. Os guardiões que você cadastrar só recebem notificações e localização em situações de emergência - eles não têm acesso às suas gravações ou análises. A equipe de suporte técnico só pode acessar dados específicos mediante sua solicitação e consentimento explícito por código de verificação, e cada acesso fica registrado em um log de auditoria completo." },
  { q: "A Ampara é gratuita?", a: "Sim, a Ampara é 100% gratuita para todas as mulheres. Não há nenhuma cobrança - nem no cadastro, nem no uso de qualquer funcionalidade. O compromisso é com a proteção de todas as mulheres." },
  { q: "Como funciona a gravação de áudio?", a: "Quando o monitoramento está ativo, eu gravo o áudio ambiente em segundo plano no seu dispositivo, mesmo com a tela bloqueada. Os áudios são enviados automaticamente para os servidores, onde a inteligência artificial transcreve o conteúdo e analisa padrões de linguagem, tom de voz e presença de palavras ofensivas. A análise gera um relatório com nível de risco, sentimento predominante e categorias de violência identificadas. Gravações sem risco são excluídas automaticamente após o período que você definir nas configurações." },
  { q: "Posso desativar o monitoramento a qualquer momento?", a: "Sim, você tem total controle. Pode ativar e desativar o monitoramento a qualquer momento pelas configurações. Também é possível definir horários específicos para cada dia da semana - por exemplo, ativar apenas durante a noite ou nos finais de semana. Eu nunca gravo sem que o monitoramento esteja ativo. Sua autonomia e privacidade são respeitadas em todas as etapas." },
  { q: "O que são guardiões?", a: "Guardiões são pessoas de sua máxima confiança - como familiares, amigos ou vizinhos - que você cadastra para receber alertas em situações de emergência. Quando você aciona o botão de pânico, seus guardiões são notificados imediatamente via WhatsApp com sua localização em tempo real. Você pode cadastrar até 5 guardiões, escolhendo o nome, telefone e o tipo de vínculo. Pode adicioná-los ou removê-los a qualquer momento." },
  { q: "Como acionar ajuda em caso de emergência?", a: "Em situações de emergência, você pode acionar o botão de pânico. Ao ativar, eu notifico automaticamente todos os seus guardiões via WhatsApp, compartilhando sua localização em tempo real. Também é possível configurar o acionamento de autoridades competentes. Além disso, você pode ligar diretamente para o Ligue 180 (Central de Atendimento à Mulher) ou o 190 (Polícia Militar). A Ampara também possui uma senha de coação - se alguém forçar você a abrir o app, essa senha simula uma tela normal enquanto eu envio um alerta silencioso." },
];

const FLOW_TRIGGERS = [
  { icon: Ear, title: "Monitoramento Ativo", desc: "Escuta o ambiente nos horários definidos" },
  { icon: Mic, title: "Gravação Manual", desc: "Grave a qualquer momento" },
  { icon: Radio, title: "Botão de Pânico", desc: "Acione com um toque" },
];

const FLOW_PIPELINE = [
  { icon: Upload, title: "Envio ao Servidor", desc: "Áudios e dados são enviados e analisados por inteligência artificial" },
  { icon: Activity, title: "Orientação Personalizada", desc: "Você recebe análises sobre sua situação com dicas de segurança e reflexões sobre a relação" },
  { icon: MessageCircle, title: "Alerta aos Guardiões", desc: "Se configurado, seus guardiões recebem notificação via WhatsApp com sua localização", configurable: true },
  { icon: Phone, title: "Chamada de Emergência", desc: "Se habilitado, a Ampara liga automaticamente para 190 (Polícia) e 180 (Delegacia da Mulher)", configurable: true },
];

/* ── Organic card component ── */
function OrgCard({ children, className = "", hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-6 bg-card border border-border/60 overflow-hidden transition-all duration-300 ${hover ? "hover:shadow-[0_8px_30px_-8px_hsl(280_40%_30%/0.12)] hover:-translate-y-0.5" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ── Organic icon wrapper ── */
function OrgIcon({ icon: Icon, size = "md" }: { icon: React.ElementType; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-10 h-10", md: "w-12 h-12", lg: "w-14 h-14" };
  const iconMap = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };
  return (
    <div className={`${sizeMap[size]} rounded-xl flex items-center justify-center shrink-0`} style={{ background: "var(--ampara-gradient-soft)" }}>
      <Icon className={iconMap[size]} style={{ color: "hsl(var(--ampara-magenta))" }} />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [contact, setContact] = useState({ nome: "", email: "", mensagem: "" });
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("usuarios").select("*", { count: "exact", head: true }).then(({ count }) => {
      if (count !== null) setUserCount(count);
    });
  }, []);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackCode.trim();
    if (!code) return;
    navigate(`/${code}`);
  };

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Mensagem enviada!", description: "Entraremos em contato em breve." });
    setContact({ nome: "", email: "", mensagem: "" });
  };

  const NavItems = ({ onNav }: { onNav?: () => void }) => (
    <>
      {NAV_LINKS.map((l) => (
        <button
          key={l.id}
          onClick={() => { scrollTo(l.id); onNav?.(); }}
          className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors"
        >
          {l.label}
        </button>
      ))}
      <Link
        to="/transparencia"
        onClick={onNav}
        className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors text-center"
      >
        Dados Públicos
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ HEADER - organic style ══════ */}
      <header className="sticky top-0 z-50 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--sidebar-bg-gradient)" }} />
        <HalftoneOverlay opacity={0.02} />
        <OrgBlob className="-top-16 -right-16 w-40 h-40 opacity-[0.04]" color="hsl(320,70%,50%)" />

        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 relative z-10">
          <img src={amparaLogo} alt="AMPARA Mulher" className="h-12" />
          <nav className="hidden lg:flex items-center gap-6">
            <NavItems />
          </nav>
          <Link to="/login" className="hidden lg:flex items-center gap-1.5 text-xs py-[5px] px-[12px] rounded-xl border-2 border-primary/30 text-foreground font-semibold hover:bg-primary/5 transition-colors">
            Portal da Mulher
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden p-2 text-foreground" aria-label="Menu">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-12 flex flex-col gap-4">
              <NavItems onNav={() => setMobileOpen(false)} />
              <hr className="border-border" />
              <Link to="/login" className="ampara-btn-secondary flex items-center justify-center gap-2" onClick={() => setMobileOpen(false)}>
                <LogIn className="w-4 h-4" /> Portal da Mulher
              </Link>
              <Link to="/cadastro" className="ampara-btn-primary flex items-center justify-center gap-2" onClick={() => setMobileOpen(false)}>
                <UserPlus className="w-4 h-4" /> Cadastre-se
              </Link>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden min-h-[420px] md:min-h-[520px] bg-background">

        {/* Floating hero image - desktop */}
        <img
          src={heroWoman}
          alt=""
          aria-hidden="true"
          className="hidden md:block absolute right-0 bottom-0 h-[90%] w-auto object-contain pointer-events-none select-none opacity-[0.85]"
          style={{
            maskImage: 'linear-gradient(to left, transparent 0%, black 18%, black 65%, transparent 100%), linear-gradient(to top, transparent 0%, black 15%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to left, transparent 0%, black 18%, black 65%, transparent 100%), linear-gradient(to top, transparent 0%, black 15%, black 100%)',
            maskComposite: 'intersect',
            WebkitMaskComposite: 'source-in',
          }}
        />

        {/* Floating hero image - mobile */}
        <img
          src={heroWoman}
          alt=""
          aria-hidden="true"
          className="block md:hidden absolute right-0 bottom-0 h-[200px] w-auto object-contain pointer-events-none select-none opacity-70"
          style={{
            maskImage: 'linear-gradient(to top, transparent 0%, black 25%, black 100%), linear-gradient(to left, transparent 0%, black 20%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 25%, black 100%), linear-gradient(to left, transparent 0%, black 20%, black 100%)',
            maskComposite: 'intersect',
            WebkitMaskComposite: 'source-in',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative z-10">
          <div className="max-w-lg space-y-5">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight text-foreground tracking-tight">
              Proteção inteligente para mulheres
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Você não está sozinha. Eu te protejo, acompanho sua situação e te oriento sobre seus direitos - tudo pelo celular, de graça e em total sigilo.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/cadastro" className="!w-auto text-sm md:text-base flex items-center gap-2 px-6 py-2.5 rounded-xl border-2 border-primary/40 text-foreground font-semibold hover:bg-primary/5 transition-colors backdrop-blur-sm">
                Cadastre-se gratuitamente
              </Link>
            </div>

            {/* User count badge */}
            {/* User count badge - omitido por enquanto */}

            <div className="mt-4 p-3 rounded-2xl border border-border/60 backdrop-blur-sm max-w-md" style={{ background: "hsla(0,0%,100%,0.6)" }}>
              <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" /> Recebeu um código de monitoramento?
              </p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <input
                  className="ampara-input flex-1 !py-2 !text-xs"
                  placeholder="Digite o código (ex: 482731)"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value.replace(/\s/g, ""))}
                  maxLength={20}
                />
                <button type="submit" disabled={!trackCode.trim()} className="ampara-btn-primary !w-auto !py-2 !px-4 !text-xs flex items-center gap-1.5 shrink-0">
                  <MapPin className="w-3.5 h-3.5" /> Monitorar
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer for removed sticky sub-nav */}
      <div className="h-0" />

      {/* ══════ SOBRE ══════ */}
      <OrganicSection id="sobre" variant="white">
        <OrgBlob className="-top-16 -right-16 w-48 h-48 opacity-[0.04]" color="hsl(320,70%,50%)" />
        <OrgBlob className="-bottom-12 -left-12 w-36 h-36 opacity-[0.03]" color="hsl(280,60%,48%)" style={{ borderRadius: "45% 55% 50% 50% / 55% 45% 55% 45%" }} />
        <HalftoneOverlay opacity={0.015} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Sobre</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Proteção integral com tecnologia e acolhimento</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Eu cuido da sua segurança, guardo provas quando você precisar e te mostro o caminho para buscar ajuda. É como ter uma rede de apoio no seu bolso.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Heart, title: "Missão", text: "Oferecer proteção integral e suporte contínuo para mulheres em situação de risco, utilizando tecnologia acessível e humanizada." },
              { icon: Eye, title: "Visão", text: "Ser referência nacional em proteção feminina, integrando tecnologia, redes de apoio e políticas públicas para um futuro mais seguro." },
              { icon: Users, title: "Propósito", text: "Toda mulher merece viver sem medo. A Ampara existe para ser a ponte entre a vulnerabilidade e a segurança plena." },
            ].map((c) => (
              <OrgCard key={c.title}>
                <OrgIcon icon={c.icon} />
                <h3 className="text-base font-semibold text-foreground mb-2 mt-4">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
              </OrgCard>
            ))}
          </div>
        </div>
      </OrganicSection>

      {/* ══════ ECOSSISTEMA ══════ */}
      <OrganicSection id="ecossistema" variant="warm">
        <OrgBlob className="top-[-60px] right-[5%] w-64 h-64 opacity-[0.04]" color="hsl(280,60%,48%)" style={{ borderRadius: "40% 60% 45% 55% / 55% 45% 60% 40%" }} />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Ecossistema</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">O que a Ampara faz por você</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            São 3 formas de te ajudar, tudo no seu celular, sem custo e com total sigilo.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Shield, title: "Te protejo", desc: "Eu aviso suas pessoas de confiança quando você precisa de ajuda.", items: ["Botão de pânico que avisa seus guardiões na hora", "Compartilho sua localização com quem você confia", "Senha secreta pra situações de perigo"] },
              { icon: Activity, title: "Te acompanho", desc: "Eu gravo áudios, analiso riscos e crio relatórios que podem ser usados como prova.", items: ["Gravo o som ao redor sem ninguém perceber", "Analiso automaticamente o que foi dito", "Gero relatórios que servem como prova"] },
              { icon: BookOpen, title: "Te oriento", desc: "Eu te mostro seus direitos, números de emergência e caminhos para sair da situação.", items: ["Ligue 180 e 190 direto pelo aplicativo", "Informações sobre seus direitos e a Lei Maria da Penha", "Suporte humano pra te ouvir e te ajudar"] },
            ].map((p) => (
              <OrgCard key={p.title} className="flex flex-col">
                <OrgIcon icon={p.icon} size="lg" />
                <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 mt-5">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                <ul className="space-y-2 mt-auto">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--ampara-magenta))" }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </OrgCard>
            ))}
          </div>
        </div>
      </OrganicSection>

      {/* ══════ DADOS ══════ */}
      <OrganicSection id="dados" variant="cool">
        <OrgBlob className="-top-20 -left-20 w-56 h-56 opacity-[0.04]" color="hsl(280,60%,48%)" />
        <div className="absolute top-1/3 right-[-40px] w-24 h-24 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(320,70%,50%)" }} />
        <HalftoneOverlay opacity={0.015} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Dados</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-3xl">
            Pela primeira vez na história, dados reais sobre violência doméstica
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Até hoje, ninguém sabia de verdade o que acontece dentro de casa. A Ampara muda isso - sem nunca expor quem você é.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <OrgCard className="flex flex-col">
              <OrgIcon icon={Heart} size="lg" />
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 mt-5">O que isso muda na sua vida</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Quando mais mulheres participam, a proteção fica mais forte pra todas - e você nunca precisa se expor.
              </p>
              <ul className="space-y-3 mt-auto">
                {["Suas provas ficam guardadas com segurança e podem te ajudar na justiça", "Quanto mais mulheres usam, mais o sistema aprende a proteger melhor", "Você faz parte de algo maior: ajuda outras mulheres sem se expor"].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--ampara-magenta))" }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </OrgCard>

            <OrgCard className="flex flex-col">
              <OrgIcon icon={Database} size="lg" />
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 mt-5">O que isso muda no Brasil</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Pela primeira vez, órgãos públicos e ONGs terão acesso a dados reais e atualizados - não mais com meses ou anos de atraso.
              </p>
              <ul className="space-y-3 mt-auto">
                {["Dados disponíveis em tempo real para órgãos públicos e ONGs - não mais com atraso de meses ou anos", "Políticas públicas criadas com base em dados concretos e atualizados", "Delegacias, abrigos e serviços direcionados para onde mais se precisa"].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--ampara-magenta))" }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </OrgCard>
          </div>

        </div>
      </OrganicSection>

      {/* ══════ FUNCIONALIDADES ══════ */}
      <OrganicSection id="funcionalidades" variant="light">
        <OrgBlob className="top-[10%] right-[-60px] w-40 h-40 opacity-[0.04]" color="hsl(320,70%,50%)" style={{ borderRadius: "50% 50% 45% 55% / 55% 50% 50% 45%" }} />
        <div className="absolute bottom-[20%] left-[-30px] w-16 h-16 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(280,60%,48%)" }} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Funcionalidades</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Tudo o que você precisa para se proteger</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Ferramentas integradas de monitoramento, análise e suporte - tudo num só lugar.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {FEATURES.map((f) => (
              <OrgCard key={f.title} className="flex flex-col">
                <OrgIcon icon={f.icon} size="sm" />
                <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
              </OrgCard>
            ))}
          </div>
        </div>
      </OrganicSection>

      {/* ══════ FLUXO DE PROTEÇÃO ══════ */}
      <OrganicSection id="fluxo" variant="white">
        <OrgBlob className="-top-16 left-[20%] w-48 h-48 opacity-[0.03]" color="hsl(280,60%,48%)" />
        <HalftoneOverlay opacity={0.012} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Fluxo de Proteção</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Como a Ampara te protege na prática</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Do monitoramento ao acionamento de autoridades - cada etapa funciona automaticamente para sua segurança.
          </p>

          {/* Desktop pipeline */}
          <div className="hidden lg:flex items-start mt-14 relative gap-4">
            <div className="absolute top-[56px] left-[12%] right-[8%] h-0.5 rounded-full" style={{ background: "var(--ampara-gradient)", opacity: 0.25 }} />

            {/* Trigger card */}
            <div className="flex-1 relative z-10 flex flex-col items-center text-center">
              <OrgCard hover={false} className="w-full !p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Gatilho</p>
                <div className="space-y-3">
                  {FLOW_TRIGGERS.map((t) => (
                    <div key={t.title} className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--ampara-gradient)" }}>
                        <t.icon className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </OrgCard>
            </div>

            {/* Pipeline steps */}
            {FLOW_PIPELINE.map((step, i) => (
              <div key={step.title} className="flex-1 relative z-10 flex flex-col items-center text-center pt-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-md mb-3 border-2 border-card" style={{ background: "var(--ampara-gradient)" }}>
                  <step.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-xs font-bold text-foreground mb-1 leading-tight">{step.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-snug max-w-[140px]">{step.desc}</p>
                {step.configurable && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-0.5" style={{ color: "hsl(var(--ampara-magenta))", background: "var(--ampara-gradient-soft)" }}>
                    <Settings className="w-2.5 h-2.5" /> Configurável
                  </span>
                )}
                {i < FLOW_PIPELINE.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-[56px] w-5 h-5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile/Tablet timeline */}
          <div className="lg:hidden mt-10 space-y-6">
            <OrgCard hover={false} className="!p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Gatilho - escolha uma forma de iniciar</p>
              <div className="space-y-3">
                {FLOW_TRIGGERS.map((t) => (
                  <div key={t.title} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--ampara-gradient)" }}>
                      <t.icon className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </OrgCard>

            <div className="relative pl-8">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 rounded-full" style={{ background: "var(--ampara-gradient)", opacity: 0.25 }} />
              <div className="space-y-8">
                {FLOW_PIPELINE.map((step) => (
                  <div key={step.title} className="flex items-start gap-4 relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md shrink-0 border-2 border-card absolute -left-8" style={{ background: "var(--ampara-gradient)" }}>
                      <step.icon className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="ml-6">
                      <h3 className="text-sm font-bold text-foreground mb-0.5">{step.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                      {step.configurable && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-0.5" style={{ color: "hsl(var(--ampara-magenta))", background: "var(--ampara-gradient-soft)" }}>
                          <Settings className="w-2.5 h-2.5" /> Configurável
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </OrganicSection>

      {/* ══════ COMO FUNCIONA ══════ */}
      <OrganicSection id="como-funciona" variant="warm">
        <OrgBlob className="top-[-40px] right-[-40px] w-48 h-48 opacity-[0.03]" color="hsl(320,60%,55%)" />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Como Funciona</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Comece a se proteger em 4 passos</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Configure rapidamente e ative sua proteção em minutos.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-start gap-3 relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ background: "var(--ampara-gradient)" }}>
                  {s.num}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-4 top-3 text-border w-5 h-5" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm inline-flex items-center gap-2 !py-2.5 !px-6">
              Comece agora
            </Link>
          </div>
        </div>
      </OrganicSection>

      {/* ══════ SEGURANÇA ══════ */}
      <OrganicSection id="seguranca" variant="light">
        <OrgBlob className="top-[10%] right-[-80px] w-64 h-64 opacity-[0.04]" color="hsl(280,60%,48%)" style={{ borderRadius: "45% 55% 40% 60% / 60% 40% 55% 45%" }} />
        <div className="absolute bottom-[15%] left-[-30px] w-20 h-20 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(320,70%,50%)" }} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Segurança</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Privacidade e proteção em primeiro lugar</h2>

          <div className="grid md:grid-cols-2 gap-10 mt-12 items-start">
            <div className="space-y-6">
              {[
                { stat: "100%", desc: "Criptografia de ponta a ponta em todas as transmissões." },
                { stat: "LGPD", desc: "Conformidade total com a Lei Geral de Proteção de Dados." },
                { stat: "Zero", desc: "Compartilhamento com terceiros sem consentimento explícito." },
              ].map((item) => (
                <div key={item.stat} className="flex items-start gap-4">
                  <span className="text-2xl md:text-3xl font-bold shrink-0 min-w-[80px]" style={{ color: "hsl(var(--ampara-magenta))" }}>{item.stat}</span>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <ul className="space-y-3">
                {[
                  "Gravações sem risco excluídas automaticamente",
                  "Auditoria completa de acessos de suporte",
                  "Senha de coação para situações de emergência",
                  "Controle total sobre seus dados",
                  "Guardiões só recebem alertas - sem acesso a gravações",
                  "Dados públicos são 100% anonimizados - impossível identificar qualquer pessoa",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm text-foreground">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--ampara-gradient-soft)" }}>
                      <Check className="w-3 h-3" style={{ color: "hsl(var(--ampara-magenta))" }} />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2">
                <Lock className="w-3.5 h-3.5" style={{ color: "hsl(var(--ampara-magenta))" }} /> Seus dados são protegidos por criptografia de ponta a ponta.
              </p>
            </div>
          </div>
        </div>
      </OrganicSection>

      {/* ══════ FAQ ══════ */}
      <OrganicSection id="faq" variant="cool">
        <OrgBlob className="-top-12 right-[10%] w-36 h-36 opacity-[0.03]" color="hsl(320,70%,50%)" />

        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>FAQ</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Perguntas frequentes</h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">Tire suas dúvidas sobre a Ampara.</p>

          <Accordion type="single" collapsible className="mt-8 space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl bg-card border border-border/60 px-4 shadow-sm">
                <AccordionTrigger className="text-left text-foreground hover:no-underline text-sm py-4 font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </OrganicSection>

      {/* ══════ CTA ══════ */}
      <section className="py-16 md:py-24 relative overflow-hidden" style={{ background: "var(--ampara-gradient)" }}>
        <OrgBlob className="top-[-80px] right-[-80px] w-[400px] h-[400px] opacity-[0.1]" color="hsl(0,0%,100%)" />
        <OrgBlob className="bottom-[-60px] left-[-60px] w-[300px] h-[300px] opacity-[0.07]" color="hsl(0,0%,100%)" style={{ borderRadius: "45% 55% 50% 50% / 55% 45% 55% 45%" }} />
        <HalftoneOverlay opacity={0.04} />

        {/* Floating rings */}
        <div className="absolute top-20 right-[15%] w-24 h-24 rounded-full border border-white/10" />
        <div className="absolute bottom-16 left-[20%] w-16 h-16 rounded-full border border-white/8" />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <h2 className="text-2xl md:text-4xl font-bold text-primary-foreground">Venha conhecer a Ampara</h2>
              <p className="text-primary-foreground/80 text-sm md:text-base leading-relaxed">
                Proteja-se com tecnologia, acolhimento e informação. Ao se cadastrar, você terá acesso a:
              </p>
              <ul className="space-y-2.5">
                {[
                  "Monitoramento automático nos seus horários de risco",
                  "Suporte personalizado",
                  "Recursos de emergência",
                  "Comunidade de apoio",
                  "Análise inteligente de risco",
                  "Total sigilo e proteção dos dados",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-primary-foreground/90">
                    <Check className="w-4 h-4 text-primary-foreground/60 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center gap-5 text-center">
              <p className="text-primary-foreground/90 text-base md:text-lg max-w-md">
                Sua segurança é prioridade. Faça parte da nossa comunidade e nunca esteja sozinha!
              </p>
              <Link to="/cadastro" className="inline-flex items-center gap-2 py-3 px-8 rounded-full bg-card text-foreground font-bold text-sm md:text-base hover:bg-card/90 transition-colors shadow-lg">
                Cadastre-se gratuitamente
              </Link>
              <p className="text-primary-foreground/60 text-xs">
                Já tem uma conta? <Link to="/login" className="text-primary-foreground font-medium underline">Acessar o Portal</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS ══════ */}
      <OrganicSection id="parceiros" variant="white" className="!py-10">
        <div className="max-w-6xl mx-auto px-4 relative z-10" />
      </OrganicSection>

      {/* ══════ CONTATO ══════ */}
      <OrganicSection id="contato" variant="cool">
        <OrgBlob className="-top-16 -right-16 w-40 h-40 opacity-[0.03]" color="hsl(320,70%,50%)" />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(var(--ampara-magenta))" }}>Contato</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Estamos aqui para ajudar</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Entre em contato ou acione ajuda de emergência.
          </p>

          <div className="grid md:grid-cols-2 gap-10 mt-12">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <OrgIcon icon={Mail} size="sm" />
                <span className="text-foreground text-sm">contato@amparamulher.com.br</span>
              </div>
              <div className="flex items-center gap-3">
                <OrgIcon icon={Phone} size="sm" />
                <span className="text-foreground text-sm">Central de Atendimento: Ligue 180</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nosso time de suporte está disponível para ajudar com dúvidas, orientações e situações de emergência. Seu contato é confidencial.
              </p>
            </div>
            <form onSubmit={handleContact} className="space-y-3">
              <input
                className="ampara-input"
                placeholder="Seu nome"
                value={contact.nome}
                maxLength={100}
                onChange={(e) => setContact({ ...contact, nome: e.target.value })}
                required
              />
              <input
                type="email"
                className="ampara-input"
                placeholder="Seu email"
                value={contact.email}
                maxLength={255}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                required
              />
              <textarea
                className="ampara-input min-h-[100px] resize-none"
                placeholder="Sua mensagem"
                value={contact.mensagem}
                onChange={(e) => setContact({ ...contact, mensagem: e.target.value })}
                required
                maxLength={1000}
              />
              <button type="submit" className="ampara-btn-primary !w-auto !py-2.5 !px-6 !text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" /> Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </OrganicSection>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-10 relative overflow-hidden" style={{ background: "hsl(var(--foreground))" }}>
        <HalftoneOverlay opacity={0.02} />
        <div className="max-w-6xl mx-auto px-4 relative z-10 text-white">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <p className="text-white/60 text-xs leading-relaxed mb-3">
                Proteção, monitoramento e apoio para mulheres em situação de vulnerabilidade. Tecnologia a serviço da vida.
              </p>
              <a href="https://instagram.com/amparamulheres" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors">
                <Instagram className="w-4 h-4" />
                @amparamulheres
              </a>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Links Rápidos</h4>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((l) => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="text-xs text-white/60 hover:text-white text-left transition-colors">
                    {l.label}
                  </button>
                ))}
                <Link to="/admin/login" className="text-xs text-white/60 hover:text-white text-left transition-colors">Acesso Administrativo</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Institucional</h4>
              <div className="flex flex-col gap-2">
                <Link to="/privacidade" className="text-xs text-white/60 hover:text-white transition-colors">Política de Privacidade</Link>
              </div>
            </div>
          </div>

          {/* Partner logos */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-[10px] text-white/40 text-center uppercase tracking-widest mb-4">Parceiros</p>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              <img src={partnerFacimus} alt="Facimus" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerHpe} alt="HPE" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerOrizon} alt="Orizon Tech" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerAggregar} alt="Aggregar" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerSinergytech} alt="Sinergytech" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
            </div>
          </div>

          <p className="text-center text-white/30 text-[10px] mt-6">
            © {new Date().getFullYear()} AMPARA Mulher. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
