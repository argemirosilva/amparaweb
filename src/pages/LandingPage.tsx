import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Heart, Users, TrendingUp, Smartphone, Mic, FileUp,
  MapPin, Search, Headphones, Settings, Check, Star, Menu,
  Building2, Users2, Phone, Mail, Eye,
  ChevronRight, Lock, ArrowRight, Radio, LogIn } from
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

// ── Shared gradient palette ──
const BG_1 = "linear-gradient(160deg, hsl(255, 55%, 28%), hsl(220, 75%, 38%))";
const BG_2 = "linear-gradient(160deg, hsl(225, 70%, 34%), hsl(210, 80%, 45%))";
const BG_3 = "linear-gradient(160deg, hsl(260, 50%, 30%), hsl(230, 65%, 36%))";
const CYAN = "hsl(175, 80%, 55%)";
const GLASS = "bg-white/10 border border-white/15 backdrop-blur-sm";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const NAV_LINKS = [
{ label: "Sobre", id: "sobre" },
{ label: "Funcionalidades", id: "funcionalidades" },
{ label: "Como Funciona", id: "como-funciona" },
{ label: "Depoimentos", id: "depoimentos" },
{ label: "FAQ", id: "faq" },
{ label: "Parceiros", id: "parceiros" },
{ label: "Contato", id: "contato" }];


const FEATURES = [
{ icon: TrendingUp, title: "Evolução do Risco", desc: "Acompanhe a análise dos últimos 30 dias com alertas críticos e tendências de risco." },
{ icon: Smartphone, title: "Monitoramento de Dispositivos", desc: "Acompanhe o status online, bateria e localização do seu dispositivo em tempo real." },
{ icon: Mic, title: "Gravação de Áudio", desc: "Grave áudios automaticamente e envie para análise inteligente com total privacidade." },
{ icon: FileUp, title: "Envio de Arquivos", desc: "Envie evidências e documentos de forma segura e criptografada." },
{ icon: MapPin, title: "Localização via GPS", desc: "Compartilhe sua localização em tempo real com guardiões e redes de apoio." },
{ icon: Search, title: "Pesquisa de Parceiros", desc: "Encontre perfis de agressores cadastrados para identificar padrões de risco." },
{ icon: Headphones, title: "Suporte Dedicado", desc: "Atendimento humanizado com equipe treinada para situações de vulnerabilidade." },
{ icon: Settings, title: "Configurações Avançadas", desc: "Personalize alertas, agendamentos de monitoramento e senha de coerção." }];


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


const IMPACT_NUMBERS = [
{ value: "+2.500", label: "Mulheres protegidas" },
{ value: "+15.000", label: "Análises realizadas" },
{ value: "+98%", label: "Satisfação das usuárias" },
{ value: "100%", label: "Personalizável por você" }];


export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [contact, setContact] = useState({ nome: "", email: "", mensagem: "" });

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

  const NavItems = ({ onNav }: {onNav?: () => void;}) =>
  <>
      {NAV_LINKS.map((l) =>
    <button key={l.id} onClick={() => {scrollTo(l.id);onNav?.();}}
    className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">
          {l.label}
        </button>
    )}
    </>;


  return (
    <div className="min-h-screen" style={{ background: "hsl(255, 55%, 22%)" }}>
      {/* ══════ HEADER ══════ */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-border bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <img src={amparaLogo} alt="AMPARA Mulher" className="h-12" />
          <nav className="hidden lg:flex items-center gap-6">
            <NavItems />
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <Link to="/login" className="ampara-btn-secondary !w-auto flex items-center gap-1.5 text-xs py-[5px] px-[12px]">
               Portal da Mulher
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
                <Shield className="w-4 h-4" /> Cadastre-se
              </Link>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(255, 55%, 28%), hsl(220, 75%, 38%), hsl(210, 80%, 45%))" }}>
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 50%, hsl(270, 60%, 42% / 0.4), transparent 60%)" }} />
        {/* Mobile hero image - cropped top half */}
        <div className="flex md:hidden justify-center overflow-hidden max-h-[160px] relative z-10">
          <img src={heroWoman} alt="Mulher protegida pela plataforma AMPARA" className="w-auto h-[320px] object-cover object-top drop-shadow-2xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-16 grid md:grid-cols-2 gap-8 items-center relative z-10">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-4xl font-bold leading-tight text-white">AMPARA

            </h1>
            <p className="text-base md:text-xl font-medium text-white">
              Proteção, monitoramento e apoio para você
            </p>
            <p className="text-sm md:text-base text-white/80 max-w-lg">
              No AMPARA Mulher, você nunca está sozinha. Uma plataforma de monitoramento, suporte personalizado e uma rede de apoio pronta para ajudar em qualquer situação de risco.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm md:text-base !py-2 !px-5 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Cadastre-se agora
              </Link>
              <button onClick={() => scrollTo("sobre")} className="!w-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors">
                Saiba mais <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Tracking code box ── */}
            <div className="mt-3 p-3 rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm">
              <p className="text-xs font-medium text-white mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" style={{ color: CYAN }} /> Recebeu um código de monitoramento?
              </p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <input
                  className="ampara-input flex-1 !bg-white/15 !border-white/20 !text-white placeholder:text-white/50 !py-2 !text-xs"
                  placeholder="Digite o código (ex: 482731)"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value.replace(/\s/g, ""))}
                  maxLength={20} />

                <button type="submit" disabled={!trackCode.trim()} className="ampara-btn-primary !w-auto !py-2 !px-4 !text-xs flex items-center gap-1.5 shrink-0">
                  <MapPin className="w-3.5 h-3.5" /> Monitorar
                </button>
              </form>
              <p className="text-[10px] text-white/50 mt-1.5">
                Insira o código recebido para acompanhar a localização em tempo real.
              </p>
            </div>
          </div>
          {/* Desktop hero image */}
          <div className="hidden md:flex justify-center">
            <img src={heroWoman} alt="Mulher protegida pela plataforma AMPARA" className="max-h-[400px] w-auto object-contain drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* ══════ SOBRE ══════ */}
      <section id="sobre" className="py-10 md:py-16" style={{ background: BG_2 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Sobre o AMPARA Mulher</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">
            Uma plataforma criada para proteger, monitorar e apoiar mulheres em situação de vulnerabilidade, com tecnologia, acolhimento e informação.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
            { icon: Heart, title: "Missão", text: "Oferecer proteção integral e suporte contínuo para mulheres em situação de risco, utilizando tecnologia acessível e humanizada." },
            { icon: Shield, title: "Visão", text: "Ser referência nacional em proteção feminina, integrando tecnologia, redes de apoio e políticas públicas para um futuro mais seguro." },
            { icon: Users, title: "Propósito", text: "Acreditamos que toda mulher merece viver sem medo. O AMPARA é a ponte entre a vulnerabilidade e a segurança plena." }].
            map((c) =>
            <div key={c.title} className={`rounded-xl p-4 md:p-6 ${GLASS} flex flex-col items-center text-center gap-3`}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20">
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                <p className="text-white/60 text-xs">{c.text}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {IMPACT_NUMBERS.map((n) =>
            <div key={n.label} className={`rounded-xl py-4 text-center ${GLASS}`}>
                <p className="text-2xl md:text-3xl font-bold" style={{ color: CYAN }}>{n.value}</p>
                <p className="text-xs text-white/60 mt-0.5">{n.label}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ FUNCIONALIDADES ══════ */}
      <section id="funcionalidades" className="py-10 md:py-16" style={{ background: BG_3 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Funcionalidades</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">Tudo o que você precisa para se proteger, em um só lugar.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {FEATURES.map((f) =>
            <div key={f.title} className={`rounded-xl p-4 text-center ${GLASS} transition-all duration-200 hover:-translate-y-1 hover:bg-white/15 flex flex-col items-center gap-3`}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                <p className="text-xs text-white/60">{f.desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ COMO FUNCIONA ══════ */}
      <section id="como-funciona" className="py-10 md:py-16" style={{ background: BG_1 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Como Funciona</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">Em 4 passos simples, você ativa sua proteção.</p>
          <div className="grid md:grid-cols-4 gap-6 mt-8">
            {STEPS.map((s, i) =>
            <div key={s.num} className="flex flex-col items-center text-center gap-2 relative">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold" style={{ background: CYAN, color: "hsl(255, 55%, 22%)" }}>
                  {s.num}
                </div>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="text-xs text-white/60">{s.desc}</p>
                {i < STEPS.length - 1 &&
              <ChevronRight className="hidden md:block absolute -right-4 top-3 text-white/30 w-5 h-5" />
              }
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm inline-flex items-center gap-2 mx-auto !py-2 !px-5">
              <Shield className="w-4 h-4" /> Comece agora
            </Link>
          </div>
        </div>
      </section>

      {/* ══════ DEPOIMENTOS ══════ */}
      <section id="depoimentos" className="py-10 md:py-16" style={{ background: BG_2 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Depoimentos</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">Histórias reais de quem já faz parte da rede AMPARA.</p>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {TESTIMONIALS.map((t) =>
            <div key={t.name} className={`rounded-xl p-4 border-l-4 italic ${GLASS}`} style={{ borderLeftColor: CYAN }}>
                <div className="flex items-center gap-2.5 mb-3 not-italic">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-white/20">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-xs">{t.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, i) =>
                    <Star key={i} className="w-3 h-3" style={{ fill: CYAN, color: CYAN }} />
                    )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">"{t.text}"</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section id="faq" className="py-10 md:py-16" style={{ background: BG_3 }}>
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Perguntas Frequentes</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto mb-6 text-xs md:text-sm">Tire suas dúvidas sobre a plataforma.</p>
          <Accordion type="single" collapsible className="mt-6 space-y-1.5">
            {FAQ_ITEMS.map((item, i) =>
            <AccordionItem key={i} value={`faq-${i}`} className="rounded-lg bg-white/10 border border-white/15 px-3 backdrop-blur-sm">
                <AccordionTrigger className="text-left text-white hover:no-underline text-sm py-3">{item.q}</AccordionTrigger>
                <AccordionContent className="text-white/60 text-xs">{item.a}</AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </section>

      {/* ══════ FAÇA PARTE ══════ */}
      <section id="cadastro" className="py-10 md:py-16 text-white" style={{ background: BG_1 }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold">Faça Parte da Rede AMPARA</h2>
              <p className="text-white/80 text-sm">
                Proteja-se com tecnologia, acolhimento e informação. Ao se cadastrar, você terá acesso a:
              </p>
              <ul className="space-y-2">
                {[
                "Monitoramento automático nos seus horários de risco",
                "Suporte personalizado",
                "Recursos de emergência",
                "Comunidade de apoio",
                "Análise inteligente de risco",
                "Total sigilo e proteção dos dados"].
                map((b) =>
                <li key={b} className="flex items-center gap-2 text-xs">
                    <Check className="w-4 h-4 shrink-0" style={{ color: CYAN }} /> {b}
                  </li>
                )}
              </ul>
              <p className="text-white/50 text-[10px] mt-3 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Seus dados são protegidos por criptografia de ponta a ponta.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-white/90 text-sm md:text-base max-w-md">
                Sua segurança é prioridade. Faça parte da nossa comunidade e nunca esteja sozinha!
              </p>
              <Link to="/cadastro" className="ampara-btn-primary !w-auto text-sm md:text-base inline-flex items-center gap-2 !px-8 !py-3">
                <Shield className="w-5 h-5" /> Cadastre-se gratuitamente
              </Link>
              <p className="text-white/60 text-xs">
                Já tem uma conta? <Link to="/login" className="text-white font-medium underline">Acessar o Portal</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS ══════ */}
      <section id="parceiros" className="py-10 md:py-16" style={{ background: BG_2 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Parceiros e Impacto Social</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">Juntos, construímos uma rede de proteção mais forte.</p>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
            { icon: Building2, label: "Órgãos Governamentais", desc: "Parcerias com delegacias, Ministério Público e secretarias de segurança." },
            { icon: Heart, label: "ONGs e Grupos de Apoio", desc: "Colaboração com organizações dedicadas à proteção e empoderamento feminino." },
            { icon: Users2, label: "Comunidade AMPARA", desc: "Rede de guardiões, voluntários e profissionais comprometidos com a causa." }].
            map((p) =>
            <div key={p.label} className={`rounded-xl p-4 text-center ${GLASS} transition-all duration-200 hover:-translate-y-1 hover:bg-white/15 flex flex-col items-center gap-3`}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20">
                  <p.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white">{p.label}</h3>
                <p className="text-xs text-white/60">{p.desc}</p>
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <p className="text-white/60 text-xs">Quer ser um parceiro?</p>
            <button onClick={() => scrollTo("contato")} className="mt-2 mx-auto flex items-center gap-2 rounded-full py-2 px-6 text-sm font-semibold text-white border-2 border-white/30 hover:bg-white/10 transition-colors">
              Entre em contato <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════ CONTATO ══════ */}
      <section id="contato" className="py-10 md:py-16" style={{ background: BG_3 }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white text-center">Contato e Suporte</h2>
          <p className="text-white/60 text-center mt-1.5 max-w-lg mx-auto text-xs md:text-sm">Estamos aqui para ajudar. Entre em contato ou acione ajuda de emergência.</p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-sm">
            
            <span className="font-semibold text-red-300 text-xs">Em caso de emergência:</span>
            <span className="flex items-center gap-1.5 font-bold text-white text-xs"><Phone className="w-3.5 h-3.5" style={{ color: CYAN }} /> Ligue 180</span>
            <span className="flex items-center gap-1.5 font-bold text-white text-xs"><Phone className="w-3.5 h-3.5" style={{ color: CYAN }} /> Ligue 190</span>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: CYAN }} />
                <span className="text-white text-sm">contato@amparamulher.com.br</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" style={{ color: CYAN }} />
                <span className="text-white text-sm">Central de Atendimento: Ligue 180</span>
              </div>
              <p className="text-white/60 text-xs">
                Nosso time de suporte está disponível para ajudar com dúvidas, orientações e situações de emergência. Seu contato é confidencial.
              </p>
            </div>
            <form onSubmit={handleContact} className="space-y-3">
              <input className="w-full rounded-lg px-3 py-2 text-xs bg-white/15 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="Seu nome" value={contact.nome} maxLength={100}
              onChange={(e) => setContact({ ...contact, nome: e.target.value })} required />
              <input type="email" className="w-full rounded-lg px-3 py-2 text-xs bg-white/15 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="Seu email" value={contact.email} maxLength={255}
              onChange={(e) => setContact({ ...contact, email: e.target.value })} required />
              <textarea className="w-full rounded-lg px-3 py-2 text-xs bg-white/15 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[80px] resize-none" placeholder="Sua mensagem" value={contact.mensagem}
              onChange={(e) => setContact({ ...contact, mensagem: e.target.value })} required maxLength={1000} />
              <button type="submit" className="ampara-btn-primary !w-auto !py-2 !px-5 !text-sm flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-8 text-white" style={{ background: "hsl(255, 55%, 18%)" }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              
              <p className="text-white/60 text-xs">
                Proteção, monitoramento e apoio para mulheres em situação de vulnerabilidade. Tecnologia a serviço da vida.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Links Rápidos</h4>
              <div className="flex flex-col gap-1.5">
                {NAV_LINKS.map((l) =>
                <button key={l.id} onClick={() => scrollTo(l.id)} className="text-xs text-white/60 hover:text-white text-left transition-colors">
                    {l.label}
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Institucional</h4>
              <div className="flex flex-col gap-1.5">
                <Link to="/privacidade" className="text-xs text-white/60 hover:text-white transition-colors">Política de Privacidade</Link>
                <Link to="/login" className="text-xs text-white/60 hover:text-white transition-colors">Portal da Mulher</Link>
                <Link to="/cadastro" className="text-xs text-white/60 hover:text-white transition-colors">Cadastre-se</Link>
                <Link to="/transparencia" className="text-xs text-white/60 hover:text-white transition-colors">Portal de Transparência</Link>
              </div>
            </div>
          </div>
          {/* ── Parceiros ── */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-[10px] text-white/40 text-center uppercase tracking-widest mb-4">Parceiros</p>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              <img src={partnerFacimus} alt="Facimus" className="h-6 md:h-8 object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
              <img src={partnerHpe} alt="Hewlett Packard Enterprise" className="h-[72px] md:h-[94px] object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
              
              <img src={partnerAggregar} alt="Aggregar Serviços Digitais" className="h-10 md:h-14 object-contain invert mix-blend-screen opacity-70 hover:opacity-100 transition-opacity" />
              <img src={partnerSinergytech} alt="SinergyTech" className="h-6 md:h-8 object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <hr className="border-white/15 my-6" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
            <p>© {new Date().getFullYear()} AMPARA Mulher. Todos os direitos reservados.</p>
            <div className="flex items-center gap-1.5">
              
              
            </div>
          </div>
        </div>
      </footer>
    </div>);

}