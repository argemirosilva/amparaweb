import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Heart, Users, TrendingUp, Smartphone, Mic, FileUp,
  MapPin, Search, Headphones, Settings, Check, Star, Menu, X,
  Building2, Users2, Phone, Mail, AlertTriangle, Loader2, Eye, EyeOff,
  ChevronRight, Lock, ArrowRight
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import amparaLogo from "@/assets/ampara-logo.png";

/* ── helpers ── */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

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

/* ══════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ── cadastro form state ── */
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", termos: false });
  const [showSenha, setShowSenha] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  /* ── contact form state ── */
  const [contact, setContact] = useState({ nome: "", email: "", mensagem: "" });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    if (!form.nome.trim()) { setRegError("Nome é obrigatório"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setRegError("Email inválido"); return; }
    if (form.telefone.replace(/\D/g, "").length < 10) { setRegError("Telefone deve ter no mínimo 10 dígitos"); return; }
    if (form.senha.length < 6) { setRegError("Senha deve ter no mínimo 6 caracteres"); return; }
    if (!form.termos) { setRegError("Aceite os termos para continuar"); return; }

    setRegLoading(true);
    const result = await register({
      nome_completo: form.nome.trim(),
      telefone: form.telefone,
      email: form.email.trim().toLowerCase(),
      senha: form.senha,
      termos_aceitos: form.termos,
    });
    if (result.success) {
      navigate(`/validar-email?email=${encodeURIComponent(result.email!)}`);
    } else {
      setRegError(result.error || "Erro ao cadastrar");
    }
    setRegLoading(false);
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
          {/* desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            <NavItems />
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">Entrar</Link>
            <button onClick={() => scrollTo("cadastro")} className="ampara-btn-primary !w-auto !py-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Cadastre-se
            </button>
          </div>
          {/* mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden p-2 text-foreground" aria-label="Menu">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-12 flex flex-col gap-4">
              <NavItems onNav={() => setMobileOpen(false)} />
              <hr className="border-border" />
              <Link to="/login" className="text-sm font-medium text-foreground/70" onClick={() => setMobileOpen(false)}>Entrar</Link>
              <button onClick={() => { scrollTo("cadastro"); setMobileOpen(false); }} className="ampara-btn-primary flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" /> Cadastre-se
              </button>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden" style={{ background: "var(--ampara-gradient-soft)" }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 80% 20%, hsl(var(--ampara-magenta) / 0.15), transparent 60%)" }} />
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-6">
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-foreground">
              AMPARA Mulher — <span className="text-primary">Proteção</span>, monitoramento e apoio para você
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              No AMPARA Mulher, você nunca está sozinha. Cadastre-se e tenha acesso a ferramentas de monitoramento, suporte personalizado e uma rede de apoio pronta para ajudar em qualquer situação de risco.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => scrollTo("cadastro")} className="ampara-btn-primary !w-auto text-lg flex items-center gap-2">
                <Shield className="w-5 h-5" /> Cadastre-se agora
              </button>
              <button onClick={() => scrollTo("sobre")} className="ampara-btn-secondary !w-auto flex items-center gap-2">
                Saiba mais <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* hero illustration */}
          <div className="hidden md:flex justify-center">
            <div className="relative">
              <div className="w-64 h-64 rounded-full ampara-gradient-soft-bg flex items-center justify-center">
                <Shield className="w-24 h-24 text-primary" />
              </div>
              <div className="absolute -top-4 -right-4 ampara-icon-circle">
                <Heart className="w-7 h-7" />
              </div>
              <div className="absolute -bottom-2 -left-6 ampara-icon-circle">
                <Users className="w-7 h-7" />
              </div>
              <div className="absolute top-1/2 -right-10 ampara-icon-circle-sm">
                <Lock className="w-4 h-4" />
              </div>
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
          {/* impact numbers */}
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
            <button onClick={() => scrollTo("cadastro")} className="ampara-btn-primary !w-auto text-base flex items-center gap-2 mx-auto">
              <Shield className="w-5 h-5" /> Comece agora
            </button>
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

      {/* ══════ CADASTRO ══════ */}
      <section id="cadastro" className="py-16 md:py-24 text-primary-foreground" style={{ background: "var(--ampara-panel-bg)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* benefícios */}
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
            {/* formulário */}
            <form onSubmit={handleRegister} className="bg-card rounded-2xl p-6 md:p-8 space-y-4 text-foreground">
              <h3 className="text-lg font-semibold text-foreground">Cadastre-se gratuitamente</h3>
              {regError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{regError}</div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Nome completo</label>
                <input className="ampara-input" placeholder="Seu nome completo" value={form.nome} maxLength={100}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" className="ampara-input" placeholder="seu@email.com" value={form.email} maxLength={255}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Telefone</label>
                <input type="tel" className="ampara-input" placeholder="(00) 00000-0000" value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Senha</label>
                <div className="relative">
                  <input type={showSenha ? "text" : "password"} className="ampara-input pr-12" placeholder="Mínimo 6 caracteres"
                    value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
                  <button type="button" onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.termos} onChange={(e) => setForm({ ...form, termos: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary" />
                <span className="text-sm text-muted-foreground">
                  Aceito os <span className="text-primary font-medium">termos de uso</span> e{" "}
                  <Link to="/privacidade" className="text-primary font-medium hover:underline">política de privacidade</Link>
                </span>
              </label>
              <button type="submit" disabled={regLoading} className="ampara-btn-primary flex items-center justify-center gap-2">
                {regLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shield className="w-5 h-5" /> Cadastre-se agora</>}
              </button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
              </p>
            </form>
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

          {/* emergency banner */}
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
                <Link to="/login" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Área da Usuária</Link>
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
