import { useState, useEffect, useRef } from "react";
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
{ label: "FAQ", id: "faq" },
{ label: "Contato", id: "contato" }];


const FEATURES = [
{ icon: TrendingUp, title: "Seu Nível de Segurança", desc: "Veja como está sua situação nos últimos dias. O sistema te avisa se algo mudar." },
{ icon: Smartphone, title: "Saber se seu celular está protegido", desc: "Confira se seu celular está conectado e funcionando direitinho com o AMPARA." },
{ icon: Mic, title: "Grava o que acontece ao redor", desc: "O celular grava o som ao redor de forma discreta, pra você ter provas se precisar." },
{ icon: FileUp, title: "Guarda provas com segurança", desc: "Salva fotos, áudios e documentos num lugar seguro, só você tem acesso." },
{ icon: MapPin, title: "Compartilha onde você está", desc: "Suas pessoas de confiança podem ver onde você está em tempo real, se precisar." },
{ icon: Search, title: "Consulta sobre agressores", desc: "Veja se outras mulheres já denunciaram a mesma pessoa. Informação salva vidas." },
{ icon: Headphones, title: "Alguém pra te ouvir", desc: "Uma equipe preparada pra te atender com respeito e cuidado, quando você precisar." },
{ icon: Settings, title: "Você controla tudo", desc: "Escolha quando o monitoramento liga, quem recebe alertas e como tudo funciona." }];


const STEPS = [
{ num: "1", title: "Cadastre-se", desc: "Crie sua conta de forma rápida e segura, com total sigilo dos seus dados." },
{ num: "2", title: "Ative o monitoramento", desc: "Configure seu dispositivo e ative a proteção em tempo real." },
{ num: "3", title: "Use as ferramentas", desc: "Grave áudios, compartilhe localização e acesse análises de risco." },
{ num: "4", title: "Conte com suporte", desc: "Acione guardiões, autoridades e equipe de apoio sempre que precisar." }];


const TESTIMONIALS = [
{ name: "Maria S.", initials: "MS", text: "O AMPARA me deu a coragem que eu precisava para dar o primeiro passo. Saber que alguém está monitorando minha segurança muda tudo.", stars: 5 },
{ name: "Ana L.", initials: "AL", text: "As gravações automáticas foram fundamentais no meu processo. A tecnologia realmente protege e ampara quem mais precisa.", stars: 5 },
{ name: "Juliana R.", initials: "JR", text: "O compartilhamento de localização com meus guardiões me dá tranquilidade para seguir minha rotina. Recomendo para todas.", stars: 5 }];


const FAQ_ITEMS = [
{ q: "Como funciona o monitoramento em tempo real?", a: "O AMPARA utiliza inteligência artificial para monitorar continuamente o ambiente sonoro através do microfone do seu celular, de forma totalmente discreta — sem que ninguém perceba. O sistema analisa os áudios captados em busca de padrões que possam indicar situações de violência, como gritos, ameaças verbais e xingamentos. Quando algo suspeito é identificado, um alerta é gerado automaticamente. Você define os horários de monitoramento e pode ativá-lo ou desativá-lo a qualquer momento." },
{ q: "Meus dados estão seguros?", a: "Sua segurança digital é nossa prioridade máxima. Utilizamos criptografia de ponta a ponta em todas as transmissões, e os dados são armazenados em servidores seguros com criptografia em repouso. Nenhuma informação é compartilhada com terceiros sem o seu consentimento explícito. Gravações que não apresentam risco são automaticamente excluídas conforme o período de retenção que você configurar. Seguimos integralmente a LGPD (Lei Geral de Proteção de Dados) e você pode solicitar a exclusão dos seus dados a qualquer momento." },
{ q: "Quem pode ver minhas informações?", a: "Apenas você tem acesso completo às suas informações. Os guardiões que você cadastrar só recebem notificações e localização em situações de emergência — eles não têm acesso às suas gravações ou análises. Nossa equipe de suporte técnico só pode acessar dados específicos mediante sua solicitação e consentimento explícito por código de verificação, e cada acesso fica registrado em um log de auditoria completo." },
{ q: "O AMPARA é gratuito?", a: "Sim, o AMPARA é 100% gratuito para todas as mulheres. Não há nenhuma cobrança — nem no cadastro, nem no uso de qualquer funcionalidade. Nosso compromisso é com a proteção de todas as mulheres." },
{ q: "Como funciona a gravação de áudio?", a: "Quando o monitoramento está ativo, o aplicativo grava o áudio ambiente em segundo plano no seu dispositivo, mesmo com a tela bloqueada. Os áudios são enviados automaticamente para nossos servidores, onde a inteligência artificial transcreve o conteúdo e analisa padrões de linguagem, tom de voz e presença de palavras ofensivas. A análise gera um relatório com nível de risco, sentimento predominante e categorias de violência identificadas. Gravações sem risco são excluídas automaticamente após o período que você definir nas configurações." },
{ q: "Posso desativar o monitoramento a qualquer momento?", a: "Sim, você tem total controle sobre o aplicativo. Pode ativar e desativar o monitoramento a qualquer momento pelas configurações. Também é possível definir horários específicos para cada dia da semana — por exemplo, ativar apenas durante a noite ou nos finais de semana. O AMPARA nunca grava sem que o monitoramento esteja ativo. Sua autonomia e privacidade são respeitadas em todas as etapas." },
{ q: "O que são guardiões?", a: "Guardiões são pessoas de sua máxima confiança — como familiares, amigos ou vizinhos — que você cadastra no aplicativo para receber alertas em situações de emergência. Quando você aciona o botão de pânico, seus guardiões são notificados imediatamente via WhatsApp com sua localização em tempo real. Você pode cadastrar até 5 guardiões, escolhendo o nome, telefone e o tipo de vínculo. Pode adicioná-los ou removê-los a qualquer momento." },
{ q: "Como acionar ajuda em caso de emergência?", a: "Em situações de emergência, você pode acionar o botão de pânico dentro do aplicativo. Ao ativar, o sistema notifica automaticamente todos os seus guardiões via WhatsApp, compartilhando sua localização em tempo real. Também é possível configurar o acionamento de autoridades competentes. Além disso, você pode ligar diretamente para o Ligue 180 (Central de Atendimento à Mulher) ou o 190 (Polícia Militar) a partir do próprio aplicativo. O AMPARA também possui uma senha de coação — se alguém forçar você a abrir o app, essa senha simula uma tela normal enquanto envia um alerta silencioso." }];




const FLOW_TRIGGERS = [
{ icon: Ear, title: "Monitoramento Ativo", desc: "Escuta o ambiente nos horários definidos" },
{ icon: Mic, title: "Gravação Manual", desc: "Grave a qualquer momento" },
{ icon: Radio, title: "Botão de Pânico", desc: "Acione com um toque" }];


const FLOW_PIPELINE = [
{ icon: Upload, title: "Envio ao Servidor", desc: "Áudios e dados são enviados e analisados por inteligência artificial" },
{ icon: Activity, title: "Orientação Personalizada", desc: "Você recebe análises sobre sua situação com dicas de segurança e reflexões sobre a relação" },
{ icon: MessageCircle, title: "Alerta aos Guardiões", desc: "Se configurado, seus guardiões recebem notificação via WhatsApp com sua localização", configurable: true },
{ icon: Phone, title: "Chamada de Emergência", desc: "Se habilitado, o sistema liga automaticamente para 190 (Polícia) e 180 (Delegacia da Mulher)", configurable: true }];

/* ── Sub-nav links ── */
const SUB_NAV = [
{ label: "Sobre", id: "sobre" },
{ label: "Ecossistema", id: "ecossistema" },
{ label: "Dados", id: "dados" },
{ label: "Funcionalidades", id: "funcionalidades" },
{ label: "Fluxo", id: "fluxo" },
{ label: "Como Funciona", id: "como-funciona" },
{ label: "Segurança", id: "seguranca" },
{ label: "Depoimentos", id: "depoimentos" },
{ label: "FAQ", id: "faq" }];


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

  const NavItems = ({ onNav }: {onNav?: () => void;}) =>
  <>
      {NAV_LINKS.map((l) =>
    <button
      key={l.id}
      onClick={() => {scrollTo(l.id);onNav?.();}}
      className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">

          {l.label}
        </button>
    )}
      <Link
      to="/transparencia"
      onClick={onNav}
      className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors text-center">
      
        Dados Públicos
      </Link>
    </>;


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
          background: "linear-gradient(135deg, hsl(280, 30%, 96%) 0%, hsl(260, 25%, 94%) 30%, hsl(200, 40%, 94%) 60%, hsl(175, 50%, 92%) 100%)"
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
               Você não está sozinha. O AMPARA te protege, acompanha sua situação e te orienta sobre seus direitos — tudo pelo celular, de graça e em total sigilo.
             </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm md:text-base !py-2.5 !px-6 flex items-center gap-2">
                Cadastre-se gratuitamente
              </Link>
              <Link to="/login" className="!w-auto flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors bg-white/80 backdrop-blur-sm">
                Acessar o Portal
              </Link>
              <a href="https://instagram.com/amparamulheres" target="_blank" rel="noopener noreferrer" aria-label="Instagram @amparamulheres" className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border text-foreground hover:bg-muted transition-colors bg-white/80 backdrop-blur-sm">
                <Instagram className="w-5 h-5" />
              </a>
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
                  maxLength={20} />

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
        



















      </div>

      {/* ══════ SOBRE ══════ */}
      <section id="sobre" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Sobre</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Proteção integral com tecnologia e acolhimento</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
             O AMPARA é como ter uma rede de apoio no seu bolso. Ele cuida da sua segurança, guarda provas quando você precisar e te mostra o caminho para buscar ajuda.
           </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
            { icon: Heart, title: "Missão", text: "Oferecer proteção integral e suporte contínuo para mulheres em situação de risco, utilizando tecnologia acessível e humanizada." },
            { icon: Eye, title: "Visão", text: "Ser referência nacional em proteção feminina, integrando tecnologia, redes de apoio e políticas públicas para um futuro mais seguro." },
            { icon: Users, title: "Propósito", text: "Acreditamos que toda mulher merece viver sem medo. O AMPARA é a ponte entre a vulnerabilidade e a segurança plena." }].
            map((c) =>
            <div key={c.title} className="rounded-2xl p-6 bg-card border border-border hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <c.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
              </div>
            )}
          </div>

        </div>
       </section>

      {/* ══════ ECOSSISTEMA — 3 pilares visuais ══════ */}
      <section id="ecossistema" className="py-16 md:py-24 relative overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(175, 35%, 95%), hsl(200, 30%, 96%), hsl(260, 20%, 97%))" }}>
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Ecossistema</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">O que o AMPARA faz por você</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            São 3 formas de te ajudar, tudo no seu celular, sem custo e com total sigilo.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {/* Pilar 1 — Proteção */}
            <div className="rounded-2xl p-7 bg-white border border-border hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">Te protege</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Como ter alguém de confiança sempre por perto. O sistema avisa suas pessoas de confiança quando você precisa de ajuda.
              </p>
              <ul className="space-y-2 mt-auto">
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Botão de pânico que avisa seus guardiões na hora</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Compartilha sua localização com quem você confia</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Senha secreta pra situações de perigo</span>
                </li>
              </ul>
            </div>

            {/* Pilar 2 — Monitoramento e Dados */}
            <div className="rounded-2xl p-7 bg-white border border-border hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <Activity className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">Te acompanha</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Como um diário que guarda tudo pra você. Grava áudios, analisa riscos e cria relatórios que podem ser usados como prova.
              </p>
              <ul className="space-y-2 mt-auto">
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Grava o som ao redor sem ninguém perceber</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Analisa automaticamente o que foi dito</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Gera relatórios que servem como prova</span>
                </li>
              </ul>
            </div>

            {/* Pilar 3 — Orientação */}
            <div className="rounded-2xl p-7 bg-white border border-border hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">Te orienta</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Como uma amiga que sabe onde buscar ajuda. Mostra seus direitos, números de emergência e caminhos para sair da situação.
              </p>
              <ul className="space-y-2 mt-auto">
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Ligue 180 e 190 direto pelo aplicativo</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Informações sobre seus direitos e a Lei Maria da Penha</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Suporte humano pra te ouvir e te ajudar</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ DADOS QUE MUDAM A HISTÓRIA ══════ */}
      <section id="dados" className="py-16 md:py-24 relative overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(260, 20%, 97%), hsl(200, 25%, 95%), hsl(260, 15%, 97%))" }}>
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Dados</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-3xl">
            Pela primeira vez na história, dados reais sobre violência doméstica
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Até hoje, ninguém sabia de verdade o que acontece dentro de casa. O AMPARA muda isso — sem nunca expor quem você é.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Card: Para você */}
            <div className="rounded-2xl p-7 bg-white border border-border hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <Heart className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">O que isso muda na sua vida</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Quando mais mulheres participam, a proteção fica mais forte pra todas — e você nunca precisa se expor.
              </p>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Suas provas ficam guardadas com segurança e podem te ajudar na justiça</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Quanto mais mulheres usam, mais o sistema aprende a proteger melhor</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Você faz parte de algo maior: ajuda outras mulheres sem se expor</span>
                </li>
              </ul>
            </div>

            {/* Card: Para o poder público */}
            <div className="rounded-2xl p-7 bg-white border border-border hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <Database className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">O que isso muda no Brasil</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Pela primeira vez, órgãos públicos e ONGs terão acesso a dados reais e atualizados — não mais com meses ou anos de atraso.
              </p>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Dados disponíveis em tempo real para órgãos públicos e ONGs — não mais com atraso de meses ou anos</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                   <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Políticas públicas criadas com base em dados concretos e atualizados</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Delegacias, abrigos e serviços direcionados para onde mais se precisa</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Banner de anonimização */}
          <div className="mt-10 p-6 md:p-10 bg-primary text-primary-foreground rounded-3xl relative overflow-hidden">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-current" />
              <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full border border-current" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold">Sua segurança é nossa prioridade absoluta</h3>
              </div>
              <p className="text-sm md:text-base opacity-90 max-w-2xl mb-6 leading-relaxed">
                Ninguém — nem o governo, nem a polícia, nem nós — consegue saber quem você é pelos dados do painel público.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
                  <div>
                    <p className="text-sm font-semibold">K-anonimato</p>
                    <p className="text-xs opacity-80 mt-1">Só mostramos dados quando existem pelo menos 5 casos parecidos na mesma região</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
                  <div>
                    <p className="text-sm font-semibold">Atraso de 48h</p>
                    <p className="text-xs opacity-80 mt-1">Nenhum dado aparece em tempo real — tudo tem um atraso de segurança de 48 horas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                  <Lock className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
                  <div>
                    <p className="text-sm font-semibold">LGPD</p>
                    <p className="text-xs opacity-80 mt-1">Conformidade total com a Lei Geral de Proteção de Dados do Brasil</p>
                  </div>
                </div>
              </div>
            </div>
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
            {FEATURES.map((f) =>
            <div key={f.title} className="rounded-2xl p-5 bg-white border border-border hover:shadow-lg transition-all duration-300 group flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ FLUXO DE PROTEÇÃO ══════ */}
      <section id="fluxo" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Fluxo de Proteção</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Como o AMPARA te protege na prática</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Do monitoramento ao acionamento de autoridades — cada etapa funciona automaticamente para sua segurança.
          </p>

          {/* Desktop: horizontal 4-column pipeline */}
          <div className="hidden lg:flex items-start mt-14 relative gap-4">
            {/* Connector line */}
            <div className="absolute top-[56px] left-[12%] right-[8%] h-0.5 bg-primary/25 rounded-full" />

            {/* Card 1: Trigger options */}
            <div className="flex-1 relative z-10 flex flex-col items-center text-center">
              <div className="rounded-2xl border border-border bg-white p-5 w-full shadow-sm">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-3">Gatilho</p>
                <div className="space-y-3">
                  {FLOW_TRIGGERS.map((t) =>
                  <div key={t.title} className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <t.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground leading-tight">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">{t.desc}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="absolute -right-3 top-12 w-5 h-5 text-muted-foreground/40" />
            </div>

            {/* Pipeline steps 2-4 */}
            {FLOW_PIPELINE.map((step, i) =>
            <div key={step.title} className="flex-1 relative z-10 flex flex-col items-center text-center pt-3">
                <div
                className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-md mb-3 border-2 border-white">
                
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xs font-bold text-foreground mb-1 leading-tight">{step.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-snug max-w-[140px]">{step.desc}</p>
                {step.configurable &&
              <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                    <Settings className="w-2.5 h-2.5" /> Configurável
                  </span>
              }
                {i < FLOW_PIPELINE.length - 1 &&
              <ChevronRight className="absolute -right-3 top-[56px] w-5 h-5 text-muted-foreground/40" />
              }
              </div>
            )}
          </div>

          {/* Mobile/Tablet: vertical timeline */}
          <div className="lg:hidden mt-10 space-y-6">
            {/* Trigger card */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-3">Gatilho — escolha uma forma de iniciar</p>
              <div className="space-y-3">
                {FLOW_TRIGGERS.map((t) =>
                <div key={t.title} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <t.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline steps */}
            <div className="relative pl-8">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-primary/25 rounded-full" />
              <div className="space-y-8">
                {FLOW_PIPELINE.map((step) =>
                <div key={step.title} className="flex items-start gap-4 relative">
                    <div
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md shrink-0 border-2 border-white absolute -left-8">
                    
                      <step.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="ml-6">
                      <h3 className="text-sm font-bold text-foreground mb-0.5">{step.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                      {step.configurable &&
                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                          <Settings className="w-2.5 h-2.5" /> Configurável
                        </span>
                    }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Como Funciona</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Comece a se proteger em 4 passos</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base">
            Configure rapidamente e ative sua proteção em minutos.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {STEPS.map((s, i) =>
            <div key={s.num} className="flex flex-col items-start gap-3 relative">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {s.num}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                {i < STEPS.length - 1 &&
              <ChevronRight className="hidden md:block absolute -right-4 top-3 text-border w-5 h-5" />
              }
              </div>
            )}
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
              { stat: "Zero", desc: "Compartilhamento com terceiros sem consentimento explícito." }].
              map((item) =>
              <div key={item.stat} className="flex items-start gap-4">
                  <span className="text-2xl md:text-3xl font-bold text-primary shrink-0 min-w-[80px]">{item.stat}</span>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1">{item.desc}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <ul className="space-y-3">
                {[
                "Gravações sem risco excluídas automaticamente",
                "Auditoria completa de acessos de suporte",
                "Senha de coação para situações de emergência",
                "Controle total sobre seus dados",
                "Guardiões só recebem alertas — sem acesso a gravações",
                "Dados públicos são 100% anonimizados — impossível identificar qualquer pessoa"].
                map((b) =>
                <li key={b} className="flex items-center gap-3 text-sm text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {b}
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2">
                <Lock className="w-3.5 h-3.5 text-primary" /> Seus dados são protegidos por criptografia de ponta a ponta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ DEPOIMENTOS ══════ */}






























      {/* ══════ FAQ ══════ */}
      <section id="faq" className="py-16 md:py-24" style={{ background: "hsl(260, 20%, 97%)" }}>
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground max-w-2xl">Perguntas frequentes</h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">Tire suas dúvidas sobre a plataforma.</p>

          <Accordion type="single" collapsible className="mt-8 space-y-2">
            {FAQ_ITEMS.map((item, i) =>
            <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl bg-white border border-border px-4 shadow-sm">
                <AccordionTrigger className="text-left text-foreground hover:no-underline text-sm py-4 font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            )}
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
                "Total sigilo e proteção dos dados"].
                map((b) =>
                <li key={b} className="flex items-center gap-2.5 text-sm text-white/90">
                    <Check className="w-4 h-4 text-[hsl(175,80%,55%)] shrink-0" /> {b}
                  </li>
                )}
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
                required />

              <input
                type="email"
                className="ampara-input"
                placeholder="Seu email"
                value={contact.email}
                maxLength={255}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                required />

              <textarea
                className="ampara-input min-h-[100px] resize-none"
                placeholder="Sua mensagem"
                value={contact.mensagem}
                onChange={(e) => setContact({ ...contact, mensagem: e.target.value })}
                required
                maxLength={1000} />

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
                {NAV_LINKS.map((l) =>
                <button key={l.id} onClick={() => scrollTo(l.id)} className="text-xs text-white/60 hover:text-white text-left transition-colors">
                    {l.label}
                  </button>
                )}
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
              <img src={partnerHpe} alt="Hewlett Packard Enterprise" className="h-[72px] md:h-[94px] object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerAggregar} alt="Aggregar Serviços Digitais" className="h-10 md:h-14 object-contain invert mix-blend-screen opacity-50 hover:opacity-80 transition-opacity" />
              <img src={partnerSinergytech} alt="SinergyTech" className="h-6 md:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity" />
            </div>
          </div>

          {/* Developer logo */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-[10px] text-white/40 text-center uppercase tracking-widest mb-4">Desenvolvedor</p>
            <div className="flex items-center justify-center">
              <img src={partnerOrizon} alt="Orizon Tech" className="h-10 md:h-14 object-contain invert mix-blend-screen opacity-50 hover:opacity-80 transition-opacity" />
            </div>
          </div>

          <hr className="border-white/10 my-6" />
          <p className="text-center text-xs text-white/40">© {new Date().getFullYear()} AMPARA Mulher. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>);

}