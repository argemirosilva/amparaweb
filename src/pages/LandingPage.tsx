import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Heart, Users, TrendingUp, Smartphone, Mic, FileUp,
  MapPin, Search, Headphones, Settings, Check, Star, Menu,
  Building2, Users2, Phone, Mail, AlertTriangle, Eye,
  ChevronRight, Lock, ArrowRight, Radio, LogIn
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import amparaLogo from "@/assets/ampara-logo.png";
import heroWoman from "@/assets/hero-woman.png";

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
  { label: "Contato", id: "contato" },
];

const FEATURES = [
  { icon: TrendingUp, title: "Evolução do Risco", desc: "Monitoramento contínuo dos últimos 30 dias com alertas críticos e análise de tendência." },
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
  { q: "Como funciona o monitoramento em tempo real?", a: "O AMPARA monitora continuamente o ambiente através do seu dispositivo, analisando áudios e padrões de comportamento para identificar situações de risco. Tudo de forma discreta e segura." },
  { q: "Meus dados estão seguros?", a: "Sim. Utilizamos criptografia de ponta a ponta, armazenamento seguro e políticas rigorosas de privacidade. Seus dados nunca são compartilhados sem sua autorização." },
  { q: "Quem pode ver minhas informações?", a: "Apenas você e os guardiões que você autorizar têm acesso às suas informações. Nossa equipe de suporte só acessa dados mediante solicitação e consentimento explícito." },
  { q: "O cadastro é gratuito?", a: "Sim, o cadastro e o uso básico da plataforma são totalmente gratuitos. Nosso compromisso é com a proteção de todas as mulheres." },
  { q: "Como funciona a gravação de áudio?", a: "O monitoramento de áudio acontece em segundo plano no seu dispositivo. Os áudios são enviados para análise inteligente que identifica padrões de violência e gera alertas automáticos." },
  { q: "Posso desativar o monitoramento a qualquer momento?", a: "Sim, você tem total controle. Pode ativar e desativar o monitoramento quando quiser pelas configurações do aplicativo." },
  { q: "O que são guardiões?", a: "Guardiões são pessoas de sua confiança (familiares, amigos) que podem receber alertas e acompanhar sua localização em situações de emergência." },
  { q: "Como acionar ajuda em caso de emergência?", a: "Você pode acionar o botão de pânico no app, que notifica seus guardiões e autoridades. Também pode ligar para o Ligue 180 ou 190 a qualquer momento." },
];

const IMPACT_NUMBERS = [
  { value: "+2.500", label: "Mulheres protegidas" },
  { value: "+15.000", label: "Análises realizadas" },
  { value: "+98%", label: "Satisfação das usuárias" },
  { value: "24/7", label: "Monitoramento contínuo" },
];

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

  const NavItems = ({ onNav }: { onNav?: () => void }) => (
    <>
      {NAV_LINKS.map((l) => (
        <button key={l.id} onClick={() => { scrollTo(l.id); onNav?.(); }}
          className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">
          {l.label}
        </button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ HEADER ══════ */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <img src={amparaLogo} alt="AMPARA Mulher" className="h-9" />
          <nav className="hidden lg:flex items-center gap-6">
            <NavItems />
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login" className="ampara-btn-secondary !w-auto !py-2 flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Portal da Mulher
            </Link>
            <Link to="/cadastro" className="ampara-btn-primary !w-auto !py-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Cadastre-se
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
      <section className="relative overflow-hidden">
        {/* Background gradient matching design */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)) 45%, hsl(250 60% 30%) 70%, hsl(220 70% 35%) 85%, hsl(175 70% 45%) 100%)"
        }} />
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 grid md:grid-cols-2 gap-8 items-center relative z-10">
          {/* Left column — text */}
          <div className="space-y-5">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium">
              <Heart className="w-4 h-4" /> Proteção Inteligente e Discreta
            </span>

            <p className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">Sua segurança é nossa prioridade</p>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              O AMPARA é um sistema de proteção inteligente que combina tecnologia de ponta com inteligência artificial para proteger vítimas de violência doméstica de forma invisível, discreta e eficaz.
            </p>

            {/* Quote card */}
            <div className="relative rounded-xl border-l-4 border-primary bg-card/80 backdrop-blur p-4 max-w-lg">
              <p className="text-sm text-foreground/90 italic leading-relaxed">
                "O AMPARA é mais do que uma ferramenta - é um abraço tecnológico, uma mão estendida, uma voz que diz: 'Eu acredito em você'"
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/cadastro" className="ampara-btn-primary !w-auto flex items-center gap-2">
                <Shield className="w-4 h-4" /> Fazer Pré-cadastro
              </Link>
              <button onClick={() => scrollTo("sobre")} className="ampara-btn-secondary !w-auto flex items-center gap-2">
                Saiba Mais
              </button>
            </div>

            {/* ── Tracking code box ── */}
            <div className="mt-2 p-4 rounded-2xl border border-border bg-card/90 backdrop-blur">
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" /> Monitorar link temporário
              </p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <input
                  className="ampara-input flex-1"
                  placeholder="Digite o código (ex: 482731)"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value.replace(/\s/g, ""))}
                  maxLength={20}
                />
                <button type="submit" disabled={!trackCode.trim()} className="ampara-btn-primary !w-auto !py-2.5 flex items-center gap-2 shrink-0">
                  <MapPin className="w-4 h-4" /> Monitorar
                </button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Insira o código recebido para acompanhar a localização em tempo real.
              </p>
            </div>
          </div>

          {/* Right column — hero image */}
          <div className="hidden md:flex justify-center relative">
            <img
              src={heroWoman}
              alt="Mulher protegida pela tecnologia AMPARA"
              className="max-h-[520px] w-auto object-contain drop-shadow-2xl"
            />
            {/* Floating badge bottom-right */}
            <div className="absolute bottom-4 right-4 bg-card rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">Proteção sempre que você precisar.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ SOBRE ══════ */}
      <section id="sobre" className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Sobre o AMPARA Mulher</h2>
          <p className="ampara-section-subtitle">
            Uma plataforma criada para proteger, monitorar e apoiar mulheres em situação de vulnerabilidade, com tecnologia, acolhimento e informação.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Heart, title: "Missão", text: "Oferecer proteção integral e suporte contínuo para mulheres em situação de risco, utilizando tecnologia acessível e humanizada." },
              { icon: Shield, title: "Visão", text: "Ser referência nacional em proteção feminina, integrando tecnologia, redes de apoio e políticas públicas para um futuro mais seguro." },
              { icon: Users, title: "Propósito", text: "Acreditamos que toda mulher merece viver sem medo. O AMPARA é a ponte entre a vulnerabilidade e a segurança plena." },
            ].map((c) => (
              <div key={c.title} className="ampara-card flex flex-col items-center text-center gap-4">
                <div className="ampara-icon-circle"><c.icon className="w-7 h-7" /></div>
                <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
                <p className="text-muted-foreground text-sm">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {IMPACT_NUMBERS.map((n) => (
              <div key={n.label} className="ampara-card text-center py-6">
                <p className="text-3xl md:text-4xl font-bold text-primary">{n.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{n.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FUNCIONALIDADES ══════ */}
      <section id="funcionalidades" className="py-16 md:py-24" style={{ background: "var(--ampara-gradient-soft)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Funcionalidades</h2>
          <p className="ampara-section-subtitle">Tudo o que você precisa para se proteger, em um só lugar.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="ampara-feature-card flex flex-col items-center gap-4">
                <div className="ampara-icon-circle"><f.icon className="w-7 h-7" /></div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ COMO FUNCIONA ══════ */}
      <section id="como-funciona" className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Como Funciona</h2>
          <p className="ampara-section-subtitle">Em 4 passos simples, você ativa sua proteção.</p>
          <div className="grid md:grid-cols-4 gap-8 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-center text-center gap-3 relative">
                <div className="ampara-badge-number w-10 h-10 text-lg">{s.num}</div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-5 top-4 text-primary/40 w-6 h-6" />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/cadastro" className="ampara-btn-primary !w-auto text-base inline-flex items-center gap-2 mx-auto">
              <Shield className="w-5 h-5" /> Comece agora
            </Link>
          </div>
        </div>
      </section>

      {/* ══════ DEPOIMENTOS ══════ */}
      <section id="depoimentos" className="py-16 md:py-24" style={{ background: "var(--ampara-gradient-soft)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Depoimentos</h2>
          <p className="ampara-section-subtitle">Histórias reais de quem já faz parte da rede AMPARA.</p>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="ampara-quote flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ background: "var(--ampara-gradient)" }}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section id="faq" className="py-16 md:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="ampara-section-title">Perguntas Frequentes</h2>
          <p className="ampara-section-subtitle mb-8">Tire suas dúvidas sobre a plataforma.</p>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-foreground">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ══════ FAÇA PARTE ══════ */}
      <section id="cadastro" className="py-16 md:py-24 text-primary-foreground" style={{ background: "var(--ampara-panel-bg)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold">Faça Parte da Rede AMPARA</h2>
              <p className="text-primary-foreground/80 text-base">
                Proteja-se com tecnologia, acolhimento e informação. Ao se cadastrar, você terá acesso a:
              </p>
              <ul className="space-y-3">
                {[
                  "Monitoramento em tempo real",
                  "Suporte personalizado 24/7",
                  "Recursos de emergência",
                  "Comunidade de apoio",
                  "Análise inteligente de risco",
                  "Total sigilo e proteção dos dados",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm">
                    <Check className="w-5 h-5 text-[hsl(var(--ampara-cyan))] shrink-0" /> {b}
                  </li>
                ))}
              </ul>
              <p className="text-primary-foreground/60 text-xs mt-4 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Seus dados são protegidos por criptografia de ponta a ponta.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-primary-foreground/90 text-lg max-w-md">
                Sua segurança é prioridade. Faça parte da nossa comunidade e nunca esteja sozinha!
              </p>
              <Link to="/cadastro" className="ampara-btn-primary !bg-card !text-primary hover:!opacity-90 !w-auto text-lg inline-flex items-center gap-2 px-10 py-4">
                <Shield className="w-6 h-6" /> Cadastre-se gratuitamente
              </Link>
              <p className="text-primary-foreground/60 text-sm">
                Já tem uma conta? <Link to="/login" className="text-primary-foreground font-medium underline">Acessar o Portal</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS ══════ */}
      <section id="parceiros" className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Parceiros e Impacto Social</h2>
          <p className="ampara-section-subtitle">Juntos, construímos uma rede de proteção mais forte.</p>
          <div className="grid sm:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Building2, label: "Órgãos Governamentais", desc: "Parcerias com delegacias, Ministério Público e secretarias de segurança." },
              { icon: Heart, label: "ONGs e Grupos de Apoio", desc: "Colaboração com organizações dedicadas à proteção e empoderamento feminino." },
              { icon: Users2, label: "Comunidade AMPARA", desc: "Rede de guardiões, voluntários e profissionais comprometidos com a causa." },
            ].map((p) => (
              <div key={p.label} className="ampara-feature-card flex flex-col items-center gap-4">
                <div className="ampara-icon-circle"><p.icon className="w-7 h-7" /></div>
                <h3 className="font-semibold text-foreground">{p.label}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <p className="text-muted-foreground">Quer ser um parceiro?</p>
            <button onClick={() => scrollTo("contato")} className="ampara-btn-secondary !w-auto mt-3 mx-auto flex items-center gap-2">
              Entre em contato <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════ CONTATO ══════ */}
      <section id="contato" className="py-16 md:py-24" style={{ background: "var(--ampara-gradient-soft)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="ampara-section-title">Contato e Suporte</h2>
          <p className="ampara-section-subtitle">Estamos aqui para ajudar. Entre em contato ou acione ajuda de emergência.</p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 p-4 rounded-2xl border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <span className="font-semibold text-destructive">Em caso de emergência:</span>
            <span className="flex items-center gap-2 font-bold text-foreground"><Phone className="w-4 h-4 text-primary" /> Ligue 180</span>
            <span className="flex items-center gap-2 font-bold text-foreground"><Phone className="w-4 h-4 text-primary" /> Ligue 190</span>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mt-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <span className="text-foreground">contato@amparamulher.com.br</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary" />
                <span className="text-foreground">Central de Atendimento: Ligue 180</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Nosso time de suporte está disponível para ajudar com dúvidas, orientações e situações de emergência. Seu contato é confidencial.
              </p>
            </div>
            <form onSubmit={handleContact} className="space-y-4">
              <input className="ampara-input" placeholder="Seu nome" value={contact.nome} maxLength={100}
                onChange={(e) => setContact({ ...contact, nome: e.target.value })} required />
              <input type="email" className="ampara-input" placeholder="Seu email" value={contact.email} maxLength={255}
                onChange={(e) => setContact({ ...contact, email: e.target.value })} required />
              <textarea className="ampara-input min-h-[100px] resize-none" placeholder="Sua mensagem" value={contact.mensagem}
                onChange={(e) => setContact({ ...contact, mensagem: e.target.value })} required maxLength={1000} />
              <button type="submit" className="ampara-btn-primary !w-auto flex items-center gap-2">
                <Mail className="w-4 h-4" /> Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-12 text-primary-foreground" style={{ background: "var(--ampara-panel-bg)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <img src={amparaLogo} alt="AMPARA Mulher" className="h-8 brightness-0 invert mb-4" />
              <p className="text-primary-foreground/70 text-sm">
                Proteção, monitoramento e apoio para mulheres em situação de vulnerabilidade. Tecnologia a serviço da vida.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Links Rápidos</h4>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((l) => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="text-sm text-primary-foreground/70 hover:text-primary-foreground text-left transition-colors">
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Institucional</h4>
              <div className="flex flex-col gap-2">
                <Link to="/privacidade" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Política de Privacidade</Link>
                <Link to="/login" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Portal da Mulher</Link>
                <Link to="/cadastro" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Cadastre-se</Link>
                <Link to="/transparencia" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Portal de Transparência</Link>
              </div>
            </div>
          </div>
          <hr className="border-primary-foreground/20 my-8" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-primary-foreground/60">
            <p>© {new Date().getFullYear()} AMPARA Mulher. Todos os direitos reservados.</p>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span>Emergência: <strong>Ligue 180</strong> ou <strong>190</strong></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
