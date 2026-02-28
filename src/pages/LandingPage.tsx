import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Heart, Users, TrendingUp, Smartphone, Mic, FileUp,
  MapPin, Search, Headphones, Settings, Check, Star, Menu,
  Building2, Users2, Phone, Mail,
  ChevronRight, Lock, ArrowRight, Radio, LogIn, UserPlus, Shield,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import amparaLogo from "@/assets/ampara-logo.png";
import heroWoman from "@/assets/hero-woman.png";
import partnerFacimus from "@/assets/partner-facimus.png";
import partnerHpe from "@/assets/partner-hpe.svg";
import partnerOrizon from "@/assets/orizon-tech-logo.png";
import partnerAggregar from "@/assets/partner-aggregar-v3.png";
import partnerSinergytech from "@/assets/partner-sinergytech.png";

/* ── helpers ── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── data ── */
const NAV_LINKS = [
  { label: "Sobre", id: "sobre" },
  { label: "Funcionalidades", id: "funcionalidades" },
  { label: "Como Funciona", id: "como-funciona" },
  { label: "Depoimentos", id: "depoimentos" },
  { label: "FAQ", id: "faq" },
  { label: "Parceiros", id: "parceiros" },
  { label: "Contato", id: "contato" },
];

const FEATURES = [
  { icon: TrendingUp, title: "Evolução do Risco", desc: "Acompanhe a análise dos últimos 30 dias com alertas críticos e tendências de risco." },
  { icon: Smartphone, title: "Monitoramento de Dispositivos", desc: "Acompanhe o status online, bateria e localização do seu dispositivo em tempo real." },
  { icon: Mic, title: "Gravação de Áudio", desc: "Grave áudios automaticamente e envie para análise inteligente com total privacidade." },
  { icon: FileUp, title: "Envio de Arquivos", desc: "Envie evidências e documentos de forma segura e criptografada." },
  { icon: MapPin, title: "Localização via GPS", desc: "Compartilhe sua localização em tempo real com guardiões e redes de apoio." },
  { icon: Search, title: "Pesquisa de Parceiros", desc: "Encontre perfis de agressores cadastrados para identificar padrões de risco." },
  { icon: Headphones, title: "Suporte Dedicado", desc: "Atendimento humanizado com equipe treinada para situações de vulnerabilidade." },
  { icon: Settings, title: "Configurações Avançadas", desc: "Personalize alertas, agendamentos de monitoramento e senha de coerção." },
];

const STEPS = [
  { num: "1", title: "Cadastre-se", desc: "Crie sua conta de forma rápida e segura, com total sigilo dos seus dados." },
  { num: "2", title: "Ative o monitoramento", desc: "Configure seu dispositivo e ative a proteção em tempo real." },
  { num: "3", title: "Use as ferramentas", desc: "Grave áudios, compartilhe localização e acesse análises de risco." },
  { num: "4", title: "Conte com suporte", desc: "Acione guardiões, autoridades e equipe de apoio sempre que precisar." },
];

const TESTIMONIALS = [
  { name: "Maria S.", initials: "MS", text: "O AMPARA me deu a coragem que eu precisava para dar o primeiro passo. Saber que alguém está monitorando minha segurança muda tudo.", stars: 5 },
  { name: "Ana L.", initials: "AL", text: "As gravações automáticas foram fundamentais no meu processo. A tecnologia realmente protege e ampara quem mais precisa.", stars: 5 },
  { name: "Juliana R.", initials: "JR", text: "O compartilhamento de localização com meus guardiões me dá tranquilidade para seguir minha rotina. Recomendo para todas.", stars: 5 },
];

const FAQ_ITEMS = [
  { q: "Como funciona o monitoramento em tempo real?", a: "O AMPARA utiliza inteligência artificial para monitorar continuamente o ambiente sonoro através do microfone do seu celular, de forma totalmente discreta — sem que ninguém perceba. O sistema analisa os áudios captados em busca de padrões que possam indicar situações de violência, como gritos, ameaças verbais e xingamentos. Quando algo suspeito é identificado, um alerta é gerado automaticamente. Você define os horários de monitoramento e pode ativá-lo ou desativá-lo a qualquer momento." },
  { q: "Meus dados estão seguros?", a: "Sua segurança digital é nossa prioridade máxima. Utilizamos criptografia de ponta a ponta em todas as transmissões, e os dados são armazenados em servidores seguros com criptografia em repouso. Nenhuma informação é compartilhada com terceiros sem o seu consentimento explícito. Gravações que não apresentam risco são automaticamente excluídas conforme o período de retenção que você configurar. Seguimos integralmente a LGPD (Lei Geral de Proteção de Dados) e você pode solicitar a exclusão dos seus dados a qualquer momento." },
  { q: "Quem pode ver minhas informações?", a: "Apenas você tem acesso completo às suas informações. Os guardiões que você cadastrar só recebem notificações e localização em situações de emergência — eles não têm acesso às suas gravações ou análises. Nossa equipe de suporte técnico só pode acessar dados específicos mediante sua solicitação e consentimento explícito por código de verificação, e cada acesso fica registrado em um log de auditoria completo." },
  { q: "O AMPARA é gratuito?", a: "Sim, o AMPARA é 100% gratuito para todas as mulheres. Não há nenhuma cobrança — nem no cadastro, nem no uso de qualquer funcionalidade. Nosso compromisso é com a proteção de todas as mulheres." },
  { q: "Como funciona a gravação de áudio?", a: "Quando o monitoramento está ativo, o aplicativo grava o áudio ambiente em segundo plano no seu dispositivo, mesmo com a tela bloqueada. Os áudios são enviados automaticamente para nossos servidores, onde a inteligência artificial transcreve o conteúdo e analisa padrões de linguagem, tom de voz e presença de palavras ofensivas. A análise gera um relatório com nível de risco, sentimento predominante e categorias de violência identificadas. Gravações sem risco são excluídas automaticamente após o período que você definir nas configurações." },
  { q: "Posso desativar o monitoramento a qualquer momento?", a: "Sim, você tem total controle sobre o aplicativo. Pode ativar e desativar o monitoramento a qualquer momento pelas configurações. Também é possível definir horários específicos para cada dia da semana — por exemplo, ativar apenas durante a noite ou nos finais de semana. O AMPARA nunca grava sem que o monitoramento esteja ativo. Sua autonomia e privacidade são respeitadas em todas as etapas." },
  { q: "O que são guardiões?", a: "Guardiões são pessoas de sua máxima confiança — como familiares, amigos ou vizinhos — que você cadastra no aplicativo para receber alertas em situações de emergência. Quando você aciona o botão de pânico, seus guardiões são notificados imediatamente via WhatsApp com sua localização em tempo real. Você pode cadastrar até 5 guardiões, escolhendo o nome, telefone e o tipo de vínculo. Pode adicioná-los ou removê-los a qualquer momento." },
  { q: "Como acionar ajuda em caso de emergência?", a: "Em situações de emergência, você pode acionar o botão de pânico dentro do aplicativo. Ao ativar, o sistema notifica automaticamente todos os seus guardiões via WhatsApp, compartilhando sua localização em tempo real. Também é possível configurar o acionamento de autoridades competentes. Além disso, você pode ligar diretamente para o Ligue 180 (Central de Atendimento à Mulher) ou o 190 (Polícia Militar) a partir do próprio aplicativo. O AMPARA também possui uma senha de coação — se alguém forçar você a abrir o app, essa senha simula uma tela normal enquanto envia um alerta silencioso." },
];

const IMPACT_NUMBERS = [
  { value: "+2.500", label: "Mulheres protegidas" },
  { value: "+15.000", label: "Análises realizadas" },
  { value: "+98%", label: "Satisfação das usuárias" },
  { value: "100%", label: "Gratuito para todas" },
];

/* ── Sub-nav links ── */
const SUB_NAV = [
  { label: "Sobre", id: "sobre" },
  { label: "Funcionalidades", id: "funcionalidades" },
  { label: "Como Funciona", id: "como-funciona" },
  { label: "Segurança", id: "seguranca" },
  { label: "Depoimentos", id: "depoimentos" },
  { label: "FAQ", id: "faq" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [contact, setContact] = useState({ nome: "", email: "", mensagem: "" });
  const [activeSection, setActiveSection] = useState("sobre");
  const subNavRef = useRef<HTMLDivElement>(null);

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

  /* Intersection observer for sub-nav active state */
  useEffect(() => {
    const ids = SUB_NAV.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.1 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

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
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ HEADER ══════ */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-border bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <img src={amparaLogo} alt="AMPARA Mulher" className="h-12" />
          <nav className="hidden lg:flex items-center gap-6">
            <NavItems />
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <Link to="/login" className="ampara-btn-secondary !w-auto flex items-center gap-1.5 text-xs py-[5px] px-[12px]">
              Acesso Portal
            </Link>
            <Link to="/cadastro" className="ampara-btn-primary !w-auto flex items-center gap-1.5 text-xs py-[5px] px-[12px]">
              Cadastre-se
            </Link>
          </div>
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

      {/* ══════ HERO — Azure-inspired light gradient with abstract curves ══════ */}
      <section className="relative overflow-hidden min-h-[420px] md:min-h-[520px]">
        {/* Abstract gradient background */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, hsl(280, 30%, 96%) 0%, hsl(260, 25%, 94%) 30%, hsl(200, 40%, 94%) 60%, hsl(175, 50%, 92%) 100%)",
        }} />
        {/* Flowing curve accent */}
        <svg className="absolute right-0 top-0 h-full w-[60%] opacity-60 pointer-events-none" viewBox="0 0 800 600" preserveAspectRatio="none" fill="none">
          <path d="M400,0 C500,150 800,200 800,400 C800,500 700,600 600,600 L800,600 L800,0 Z" fill="url(#hero-grad)" />
          <defs>
            <linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(270, 60%, 70%)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="hsl(200, 70%, 70%)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(175, 80%, 55%)" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
        {/* Secondary curve */}
        <svg className="absolute right-0 bottom-0 h-[80%] w-[50%] opacity-40 pointer-events-none" viewBox="0 0 600 500" preserveAspectRatio="none" fill="none">
          <path d="M600,100 C450,150 350,300 400,500 L600,500 Z" fill="url(#hero-grad2)" />
          <defs>
            <linearGradient id="hero-grad2" x1="0%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="hsl(316, 72%, 48%)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(175, 80%, 55%)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>

        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-8 items-center relative z-10">
          <div className="space-y-5">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground tracking-tight">
              AMPARA Mulher
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Proteção, monitoramento e apoio para mulheres em situação de vulnerabilidade. Uma plataforma gratuita com tecnologia de inteligência artificial.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm md:text-base !py-2.5 !px-6 flex items-center gap-2">
                Cadastre-se gratuitamente
              </Link>
              <Link to="/login" className="!w-auto flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors bg-white/80 backdrop-blur-sm">
                Acessar o Portal
              </Link>
            </div>

            {/* Tracking code */}
            <div className="mt-4 p-3 rounded-xl border border-border bg-white/70 backdrop-blur-sm max-w-md">
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
          {/* Hero image */}
          <div className="hidden md:flex justify-center">
            <img src={heroWoman} alt="Mulher protegida pela plataforma AMPARA" className="max-h-[420px] w-auto object-contain drop-shadow-2xl" />
          </div>
          {/* Mobile hero */}
          <div className="flex md:hidden justify-center overflow-hidden max-h-[140px]">
            <img src={heroWoman} alt="Mulher protegida pela plataforma AMPARA" className="w-auto h-[280px] object-cover object-top drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* ══════ STICKY SUB-NAV (Azure-style) ══════ */}
      <div ref={subNavRef} className="sticky top-[61px] z-40 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <nav className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {SUB_NAV.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === s.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <Link to="/cadastro" className="hidden md:flex ampara-btn-primary !w-auto text-xs !py-1.5 !px-4 items-center gap-1.5 shrink-0">
            Cadastre-se
          </Link>
        </div>
      </div>

      {/* ══════ SOBRE ══════ */}
      <section id="sobre" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Sobre</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Proteção integral com tecnologia e acolhimento</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Uma plataforma criada para proteger, monitorar e apoiar mulheres em situação de vulnerabilidade, com tecnologia acessível, acolhimento e informação.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Heart, title: "Missão", text: "Oferecer proteção integral e suporte contínuo para mulheres em situação de risco, utilizando tecnologia acessível e humanizada." },
              { icon: Shield, title: "Visão", text: "Ser referência nacional em proteção feminina, integrando tecnologia, redes de apoio e políticas públicas para um futuro mais seguro." },
              { icon: Users, title: "Propósito", text: "Acreditamos que toda mulher merece viver sem medo. O AMPARA é a ponte entre a vulnerabilidade e a segurança plena." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl p-6 bg-card border border-border hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <c.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>

          {/* Impact numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {IMPACT_NUMBERS.map((n) => (
              <div key={n.label} className="text-center py-6">
                <p className="text-3xl md:text-4xl font-bold text-primary">{n.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{n.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FUNCIONALIDADES ══════ */}
      <section id="funcionalidades" className="py-16 md:py-24" style={{ background: "linear-gradient(180deg, hsl(260, 20%, 97%), hsl(200, 20%, 96%))" }}>
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Funcionalidades</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Tudo o que você precisa para se proteger</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Ferramentas integradas de monitoramento, análise e suporte em uma única plataforma.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl p-5 bg-white border border-border hover:shadow-lg transition-all duration-300 group flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ COMO FUNCIONA ══════ */}
      <section id="como-funciona" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Como Funciona</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Comece a se proteger em 4 passos</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Configure rapidamente e ative sua proteção em minutos.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-start gap-3 relative">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
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
      </section>

      {/* ══════ SEGURANÇA (Azure-style stats section) ══════ */}
      <section id="seguranca" className="py-16 md:py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(260, 30%, 97%), hsl(200, 30%, 95%), hsl(175, 40%, 93%))" }}>
        {/* Subtle accent curve */}
        <svg className="absolute right-0 top-0 h-full w-[40%] opacity-30 pointer-events-none" viewBox="0 0 400 500" preserveAspectRatio="none" fill="none">
          <path d="M200,0 C300,100 400,200 400,350 C400,450 350,500 300,500 L400,500 L400,0 Z" fill="url(#sec-grad)" />
          <defs>
            <linearGradient id="sec-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(175, 80%, 55%)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(270, 60%, 60%)" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Segurança</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Privacidade e proteção em primeiro lugar</h2>

          <div className="grid md:grid-cols-2 gap-10 mt-12 items-start">
            <div className="space-y-6">
              {[
                { stat: "100%", desc: "Criptografia de ponta a ponta em todas as transmissões." },
                { stat: "LGPD", desc: "Conformidade total com a Lei Geral de Proteção de Dados." },
                { stat: "Zero", desc: "Compartilhamento com terceiros sem consentimento explícito." },
              ].map((item) => (
                <div key={item.stat} className="flex items-start gap-4">
                  <span className="text-2xl md:text-3xl font-bold text-primary shrink-0 min-w-[80px]">{item.stat}</span>
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
                  "Guardiões só recebem alertas — sem acesso a gravações",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2">
                <Lock className="w-3.5 h-3.5 text-primary" /> Seus dados são protegidos por criptografia de ponta a ponta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ DEPOIMENTOS ══════ */}
      <section id="depoimentos" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Depoimentos</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Histórias reais de quem já faz parte</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Mulheres que encontraram proteção e apoio na rede AMPARA.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl p-6 bg-card border border-border hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground bg-primary/80">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section id="faq" className="py-16 md:py-24" style={{ background: "hsl(260, 20%, 97%)" }}>
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Perguntas frequentes</h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">Tire suas dúvidas sobre a plataforma.</p>

          <Accordion type="single" collapsible className="mt-8 space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl bg-white border border-border px-4 shadow-sm">
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
      </section>

      {/* ══════ CTA — FAÇA PARTE ══════ */}
      <section className="py-16 md:py-24 relative overflow-hidden" style={{
        background: "linear-gradient(135deg, hsl(255, 55%, 28%), hsl(220, 75%, 38%), hsl(210, 80%, 45%))"
      }}>
        <svg className="absolute right-0 top-0 h-full w-[50%] opacity-30 pointer-events-none" viewBox="0 0 600 500" preserveAspectRatio="none" fill="none">
          <path d="M300,0 C450,100 600,200 600,350 C600,450 500,500 400,500 L600,500 L600,0 Z" fill="url(#cta-grad)" />
          <defs>
            <linearGradient id="cta-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(175, 80%, 55%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(316, 72%, 48%)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <h2 className="text-2xl md:text-4xl font-bold text-white">Faça parte da rede AMPARA</h2>
              <p className="text-white/80 text-sm md:text-base leading-relaxed">
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
                  <li key={b} className="flex items-center gap-2.5 text-sm text-white/90">
                    <Check className="w-4 h-4 text-[hsl(175,80%,55%)] shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center gap-5 text-center">
              <p className="text-white/90 text-base md:text-lg max-w-md">
                Sua segurança é prioridade. Faça parte da nossa comunidade e nunca esteja sozinha!
              </p>
              <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm md:text-base inline-flex items-center gap-2 py-3 px-8 !bg-white !text-foreground font-bold hover:!bg-white/90" style={{ background: "white", color: "hsl(240, 20%, 16%)" }}>
                Cadastre-se gratuitamente
              </Link>
              <p className="text-white/60 text-xs">
                Já tem uma conta? <Link to="/login" className="text-white font-medium underline">Acessar o Portal</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS ══════ */}
      <section id="parceiros" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Parceiros</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Juntos, construímos uma rede de proteção mais forte</h2>

          <div className="grid sm:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Building2, label: "Órgãos Governamentais", desc: "Parcerias com delegacias, Ministério Público e secretarias de segurança." },
              { icon: Heart, label: "ONGs e Grupos de Apoio", desc: "Colaboração com organizações dedicadas à proteção e empoderamento feminino." },
              { icon: Users2, label: "Comunidade AMPARA", desc: "Rede de guardiões, voluntários e profissionais comprometidos com a causa." },
            ].map((p) => (
              <div key={p.label} className="rounded-2xl p-6 bg-card border border-border hover:shadow-lg transition-all duration-300 group flex flex-col items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <p.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{p.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Partner logos */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              <img src={partnerFacimus} alt="Facimus" className="h-7 md:h-9 object-contain grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
              <img src={partnerHpe} alt="Hewlett Packard Enterprise" className="h-16 md:h-20 object-contain grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
              <img src={partnerAggregar} alt="Aggregar Serviços Digitais" className="h-10 md:h-14 object-contain grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
              <img src={partnerSinergytech} alt="SinergyTech" className="h-7 md:h-9 object-contain grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">Quer ser um parceiro?</p>
            <button onClick={() => scrollTo("contato")} className="mt-2 mx-auto flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors">
              Entre em contato <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════ CONTATO ══════ */}
      <section id="contato" className="py-16 md:py-24" style={{ background: "hsl(260, 20%, 97%)" }}>
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Contato</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Estamos aqui para ajudar</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Entre em contato ou acione ajuda de emergência.
          </p>

          <div className="grid md:grid-cols-2 gap-10 mt-12">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <span className="text-foreground text-sm">contato@amparamulher.com.br</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
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
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-10 bg-foreground text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <img src={amparaLogo} alt="AMPARA" className="h-10 brightness-0 invert mb-3" />
              <p className="text-white/60 text-xs leading-relaxed">
                Proteção, monitoramento e apoio para mulheres em situação de vulnerabilidade. Tecnologia a serviço da vida.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Links Rápidos</h4>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((l) => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="text-xs text-white/60 hover:text-white text-left transition-colors">
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Institucional</h4>
              <div className="flex flex-col gap-2">
                <Link to="/privacidade" className="text-xs text-white/60 hover:text-white transition-colors">Política de Privacidade</Link>
                <Link to="/login" className="text-xs text-white/60 hover:text-white transition-colors">Portal da Mulher</Link>
                <Link to="/cadastro" className="text-xs text-white/60 hover:text-white transition-colors">Cadastre-se</Link>
                <Link to="/transparencia" className="text-xs text-white/60 hover:text-white transition-colors">Portal de Transparência</Link>
              </div>
            </div>
          </div>

          {/* Partner logos */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-[10px] text-white/40 text-center uppercase tracking-widest mb-4">Parceiros</p>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              <img src={partnerFacimus} alt="Facimus" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerHpe} alt="Hewlett Packard Enterprise" className="h-[72px] md:h-[94px] object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerAggregar} alt="Aggregar Serviços Digitais" className="h-10 md:h-14 object-contain invert mix-blend-screen opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerSinergytech} alt="SinergyTech" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
            </div>
          </div>

          <hr className="border-white/10 my-6" />
          <p className="text-center text-xs text-white/40">© {new Date().getFullYear()} AMPARA Mulher. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
