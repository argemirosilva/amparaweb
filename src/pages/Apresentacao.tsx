import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, AlertTriangle, TrendingDown, Users, Clock,
  Shield, Mic, MapPin, Brain, Headphones, Eye, Lock, Smartphone,
  Rocket, Target, Zap, Star, Check, ArrowRight, Mail, Globe,
  BarChart3, Layers, Settings, FileText
} from "lucide-react";
import amparaLogo from "@/assets/ampara-logo.png";
import orizonLogo from "@/assets/orizon-tech-logo-transparent.png";
import partnerFacimus from "@/assets/partner-facimus.png";
import partnerHpe from "@/assets/partner-hpe.svg";
import partnerAggregar from "@/assets/partner-aggregar-v3.png";
import partnerSinergytech from "@/assets/partner-sinergytech.png";

const TOTAL_SLIDES = 10;

/* ── Slide transition variants ── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

/* ── Stagger children helper ── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ══════════════════════════════════════════
   SLIDE COMPONENTS
   ══════════════════════════════════════════ */

function SlideCapa() {
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6" variants={stagger} initial="hidden" animate="visible">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <motion.div variants={fadeUp} className="relative">
        <img src={amparaLogo} alt="AMPARA Mulher" className="h-20 md:h-28 object-contain drop-shadow-lg" />
      </motion.div>
      <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white font-display">
        AMPARA Mulher
      </motion.h1>
      <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-300 max-w-2xl">
        Tecnologia de proteção inteligente para mulheres em situação de violência doméstica
      </motion.p>
      <motion.div variants={fadeUp} className="mt-2 px-4 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
        Pitch Deck 2026
      </motion.div>
      <motion.div variants={fadeUp} className="absolute bottom-10 opacity-40">
        <img src={orizonLogo} alt="Orizon Tech" className="h-6 object-contain drop-shadow-lg" />
      </motion.div>
    </motion.div>
  );
}

function SlideProblema() {
  const problems = [
    { icon: AlertTriangle, title: "Dados chegam tarde demais", desc: "Os levantamentos sobre violência doméstica levam de 2 a 4 anos para serem publicados. Quando viram políticas públicas, a realidade já mudou — e as soluções nascem obsoletas. (Fonte: FBSP — ciclo de publicação do Anuário de Segurança Pública)" },
    { icon: TrendingDown, title: "Zero dados preventivos", desc: "Hoje só existem dados reativos: contagem de boletins de ocorrência e feminicídios consumados. Não há nenhum sistema nacional que capture sinais de risco antes da agressão acontecer. (Fonte: IPEA — Atlas da Violência 2024)" },
    { icon: Clock, title: "Ciclo lento gera soluções ineficazes", desc: "O caminho coleta → análise → política pública leva em média 3 a 5 anos. Nesse intervalo, o perfil das vítimas, agressores e dinâmicas de violência se transforma, tornando as ações defasadas. (Fonte: CNJ / DataSenado, 2023)" },
    { icon: Users, title: "Vítimas invisíveis ao sistema", desc: "Apenas 10% das mulheres em situação de violência registram ocorrência. As demais ficam fora de qualquer base de dados, sem proteção e sem voz. (Fonte: DataSenado — Pesquisa Violência Doméstica, 2023)" },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">O Desafio</motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400 text-center max-w-2xl">A violência doméstica é uma crise sistêmica que afeta milhões de mulheres e demanda soluções tecnológicas urgentes.</motion.p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        {problems.map((p, i) => (
          <motion.div key={i} variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm hover:scale-[1.02] transition-transform cursor-default">
            <p.icon className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-white font-semibold text-lg mb-1">{p.title}</h3>
            <p className="text-slate-400 text-sm">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlideSolucao() {
  const features = [
    { icon: Mic, color: "text-indigo-400", title: "Monitoramento por IA", desc: "Análise contínua do ambiente sonoro com detecção de padrões de violência." },
    { icon: Shield, color: "text-cyan-400", title: "Botão de Pânico Silencioso", desc: "Acionamento discreto de guardiões e autoridades com localização em tempo real." },
    { icon: Brain, color: "text-violet-400", title: "Análise de Risco Inteligente", desc: "IA classifica gravações e gera relatórios de evolução de risco." },
    { icon: MapPin, color: "text-emerald-400", title: "Rastreamento GPS", desc: "Compartilhamento de localização com guardiões via código de monitoramento." },
    { icon: Lock, color: "text-amber-400", title: "Senha de Coação", desc: "Tela falsa ativada por senha alternativa, enviando alertas silenciosos." },
    { icon: Headphones, color: "text-rose-400", title: "Suporte Humanizado", desc: "Equipe preparada para atendimento com acolhimento e sigilo total." },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display text-center">
        A Solução: <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AMPARA</span>
      </motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400 text-center max-w-2xl">Plataforma integrada de proteção que combina inteligência artificial, monitoramento contínuo e rede de apoio para proteger mulheres em situação de violência.</motion.p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
        {features.map((f, i) => (
          <motion.div key={i} variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <f.icon className={`w-7 h-7 ${f.color} mb-3`} />
            <h3 className="text-white font-semibold mb-1">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlidePlataforma() {
  const features = [
    { icon: Mic, label: "Gravação Inteligente", color: "from-rose-500 to-pink-600" },
    { icon: Bell, label: "Botão de Pânico", color: "from-amber-500 to-orange-600" },
    { icon: BarChart3, label: "Dashboard de Risco", color: "from-cyan-500 to-blue-600" },
    { icon: MapPin, label: "GPS em Tempo Real", color: "from-emerald-500 to-green-600" },
    { icon: Brain, label: "IA Preditiva", color: "from-violet-500 to-purple-600" },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-10 px-6 relative" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">A Plataforma</motion.h2>

      {/* Central hero card */}
      <motion.div variants={fadeUp} className="relative w-full max-w-4xl">
        {/* Outer glow */}
        <div className="absolute -inset-6 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/15 rounded-3xl p-8 md:p-12 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-4"
            >
              <Smartphone className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="text-2xl md:text-3xl font-bold text-white font-display">App Móvel + Painel Web</h3>
            <p className="text-slate-400 mt-2 max-w-lg mx-auto">Aplicativo nativo para mulheres atendidas e painel administrativo para gestores governamentais</p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 300 }}
                  whileHover={{ scale: 1.08, y: -4 }}
                  className="flex items-center gap-3 bg-white/[0.06] border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-sm cursor-default"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm md:text-base font-medium text-white">{f.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SlideDiferenciais() {
  const diffs = [
    { title: "Gratuito e 100% acessível", desc: "Financiado por órgãos públicos, sem custo para as mulheres atendidas." },
    { title: "IA proprietária de análise de risco", desc: "Modelo treinado especificamente para detectar padrões de violência doméstica no áudio." },
    { title: "Conformidade total com LGPD", desc: "Criptografia ponta a ponta, logs de auditoria e controle total do usuário sobre seus dados." },
    { title: "Integração com órgãos públicos", desc: "Painel governamental com dashboard, mapa de calor e relatórios para políticas públicas." },
    { title: "Portal de transparência público", desc: "Dados abertos e metodologia publicada para accountability e pesquisa acadêmica." },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">Por que AMPARA?</motion.h2>
      <div className="w-full max-w-4xl space-y-3">
        {diffs.map((d, i) => (
          <motion.div key={i} variants={fadeUp} className="flex gap-4 items-start bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <span className="text-2xl font-bold bg-gradient-to-br from-indigo-400 to-violet-400 bg-clip-text text-transparent min-w-[48px]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-white font-semibold text-lg">{d.title}</h3>
              <p className="text-slate-400 text-sm mt-0.5">{d.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlideMercado() {
  const segments = [
    { label: "TAM", title: "Mercado Total Endereçável", value: "R$ 12 bi", desc: "Mulheres em situação de vulnerabilidade no Brasil (~17 milhões) (Fonte: IBGE/PNAD 2023)", color: "from-violet-500 to-violet-700", size: "w-64 h-64 md:w-72 md:h-72" },
    { label: "SAM", title: "Mercado Alcançável", value: "R$ 2,4 bi", desc: "Municípios com secretarias de proteção à mulher (~2.500) (Fonte: MUNIC/IBGE 2023)", color: "from-cyan-500 to-cyan-700", size: "w-48 h-48 md:w-56 md:h-56" },
    { label: "SOM", title: "Mercado Obtível", value: "R$ 80–100 mi", desc: "Convênios estaduais e municipais ativos — meta 3 anos (Estimativa interna Orizon Tech)", color: "from-emerald-500 to-emerald-700", size: "w-36 h-36 md:w-44 md:h-44" },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">Mercado Endereçável</motion.h2>
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
        {segments.map((s, i) => (
          <motion.div key={i} variants={fadeUp} className={`${s.size} rounded-full bg-gradient-to-br ${s.color} flex flex-col items-center justify-center text-center p-4 shadow-lg shadow-${s.color.split(" ")[0].replace("from-", "")}/20`}>
            <span className="text-xs font-bold text-white/60 tracking-widest uppercase">{s.label}</span>
            <span className="text-2xl md:text-3xl font-bold text-white">{s.value}</span>
            <span className="text-[11px] text-white/70 mt-1 max-w-[140px]">{s.desc}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlideRoadmap() {
  const milestones = [
    { period: "2024 Q3–Q4", title: "MVP & Piloto", items: ["App móvel com gravação e IA", "Painel governamental básico", "Piloto em 2 municípios"], status: "done" },
    { period: "2025 Q1–Q2", title: "Expansão Regional", items: ["Integração com COPOM/190", "Portal de transparência", "5 municípios ativos"], status: "done" },
    { period: "2025 Q3–Q4", title: "Escala Estadual", items: ["Suporte humanizado integrado", "API para parceiros", "20 municípios ativos"], status: "current" },
    { period: "2026 Q1–Q2", title: "Plataforma Nacional", items: ["SDK para apps parceiros", "Modelo SaaS para estados", "IA multilíngue (Libras)"], status: "future" },
    { period: "2026 Q3+", title: "Internacionalização", items: ["Expansão LATAM", "Parcerias ONU/ONG", "Modelo open-source parcial"], status: "future" },
  ];
  const dotColor = { done: "bg-emerald-400", current: "bg-indigo-400 animate-pulse", future: "bg-slate-600" };
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-6 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">Roadmap</motion.h2>
      <div className="relative w-full max-w-3xl">
        {/* Vertical line */}
        <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-white/10" />
        <div className="space-y-5">
          {milestones.map((m, i) => (
            <motion.div key={i} variants={fadeUp} className="relative flex gap-4 md:gap-6 items-start pl-10 md:pl-14">
              <div className={`absolute left-2.5 md:left-4.5 top-1.5 w-3 h-3 rounded-full ${dotColor[m.status as keyof typeof dotColor]} ring-2 ring-slate-900`} />
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-slate-500">{m.period}</span>
                  {m.status === "done" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Concluído</span>}
                  {m.status === "current" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Em andamento</span>}
                </div>
                <h3 className="text-white font-semibold">{m.title}</h3>
                <ul className="mt-1.5 space-y-0.5">
                  {m.items.map((item, j) => (
                    <li key={j} className="text-slate-400 text-sm flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-slate-500 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SlideModelo() {
  const plans = [
    {
      name: "Municipal",
      price: "R$ 2.800",
      unit: "/mês",
      features: ["Até 500 usuárias", "Painel governamental", "Relatórios mensais", "Suporte por e-mail"],
      popular: false,
    },
    {
      name: "Estadual",
      price: "R$ 9.500",
      unit: "/mês",
      features: ["Até 5.000 usuárias", "Dashboard multimunicípio", "API de integração", "Suporte prioritário", "Portal de transparência"],
      popular: true,
    },
    {
      name: "Federal",
      price: "Sob consulta",
      unit: "",
      features: ["Usuárias ilimitadas", "Multi-estado", "IA customizada", "SLA dedicado", "Treinamento presencial"],
      popular: false,
    },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">Modelo de Negócio</motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400 text-center max-w-2xl">100% gratuito para as mulheres. Financiamento via convênios com órgãos governamentais.</motion.p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
        {plans.map((p, i) => (
          <motion.div key={i} variants={fadeUp} className={`rounded-2xl p-6 backdrop-blur-sm border flex flex-col ${p.popular ? "bg-indigo-500/10 border-indigo-400/30 ring-1 ring-indigo-400/20" : "bg-white/5 border-white/10"}`}>
            {p.popular && <span className="self-start text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium mb-3">Popular</span>}
            <h3 className="text-white font-bold text-xl">{p.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-white">{p.price}</span>
              <span className="text-slate-400 text-sm">{p.unit}</span>
            </div>
            <ul className="space-y-2 flex-1">
              {p.features.map((f, j) => (
                <li key={j} className="text-slate-300 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button className={`mt-5 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${p.popular ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-white/10 text-white hover:bg-white/20"}`}>
              Saiba mais
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlideParceiros() {
  const partners = [
    { img: partnerFacimus, name: "Facimus" },
    { img: partnerHpe, name: "HPE" },
    { img: partnerAggregar, name: "Aggregar" },
    { img: partnerSinergytech, name: "Sinergytech" },
    { img: orizonLogo, name: "Orizon Tech" },
  ];
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6" variants={stagger} initial="hidden" animate="visible">
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display">Parceiros & Apoiadores</motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400 text-center max-w-2xl">Ecossistema de parceiros estratégicos que sustentam a operação e o desenvolvimento da plataforma.</motion.p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 w-full max-w-4xl">
        {partners.map((p, i) => (
          <motion.div key={i} variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-center h-24 w-40 md:w-48 backdrop-blur-sm">
            <img src={p.img} alt={p.name} className="max-h-12 max-w-full object-contain opacity-90 rounded-xl" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlideCTA() {
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6" variants={stagger} initial="hidden" animate="visible">
      {/* Animated glow */}
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }} transition={{ duration: 3, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
      <motion.div variants={fadeUp}>
        <img src={amparaLogo} alt="AMPARA Mulher" className="h-24 md:h-32 object-contain drop-shadow-lg relative z-10" />
      </motion.div>
      <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white font-display max-w-3xl relative z-10">
        Tecnologia que <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">salva vidas</span>
      </motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400 max-w-xl text-lg relative z-10">Vamos juntos construir um Brasil mais seguro para todas as mulheres.</motion.p>
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mt-2 relative z-10">
        <a href="mailto:contato@orizontech.com.br" className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-white text-sm hover:bg-white/20 transition-colors">
          <Mail className="w-4 h-4" /> contato@orizontech.com.br
        </a>
        <a href="https://ampamamulher.lovable.app" target="_blank" rel="noopener" className="flex items-center gap-2 bg-indigo-500 rounded-xl px-5 py-3 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors">
          <Globe className="w-4 h-4" /> Acessar Plataforma
        </a>
      </motion.div>
      <motion.div variants={fadeUp} className="absolute bottom-10 opacity-40">
        <img src={orizonLogo} alt="Orizon Tech" className="h-6 object-contain drop-shadow-lg" />
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════ */

const SLIDES = [SlideCapa, SlideProblema, SlideSolucao, SlidePlataforma, SlideDiferenciais, SlideMercado, SlideRoadmap, SlideModelo, SlideParceiros, SlideCTA];

export default function Apresentacao() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const go = useCallback((to: number) => {
    if (to < 0 || to >= TOTAL_SLIDES) return;
    setDirection(to > current ? 1 : -1);
    setCurrent(to);
  }, [current]);

  const next = useCallback(() => go(current + 1), [go, current]);
  const prev = useCallback(() => go(current - 1), [go, current]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const CurrentSlide = SLIDES[current];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden select-none">
      {/* Decorative blurred circles */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-900/15 blur-[130px] pointer-events-none" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-4">
        <img src={amparaLogo} alt="AMPARA" className="h-6 object-contain drop-shadow-lg opacity-60" />
        <span className="text-sm font-mono text-slate-500">
          {String(current + 1).padStart(2, "0")}/{String(TOTAL_SLIDES).padStart(2, "0")}
        </span>
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <CurrentSlide />
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next buttons */}
      {current > 0 && (
        <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {current < TOTAL_SLIDES - 1 && (
        <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500"
          initial={false}
          animate={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-indigo-400 w-6" : "bg-white/20 hover:bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
