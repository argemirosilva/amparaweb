import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  MessageCircle,
  Upload,
  ClipboardPaste,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Heart,
  Shield,
  X,
  Camera,
  Image as ImageIcon,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const EMPATHY_PHRASES = [
  "Estamos lendo com cuidado…",
  "Identificando padrões na conversa…",
  "Analisando o contexto emocional…",
  "Procurando sinais importantes…",
  "Mapeando dinâmicas da relação…",
  "Quase lá… preparando seu resultado…",
];

interface WhatsAppImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

// Parser to detect participants
function detectParticipants(text: string): string[] {
  const regex = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*-\s*([^:]+):/gm;
  const names = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name && !name.includes("criptografia") && !name.includes("mensagens") && name.length < 50) {
      names.add(name);
    }
  }
  return [...names];
}

function countMessages(text: string): number {
  const regex = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*-\s*[^:]+:/gm;
  return (text.match(regex) || []).length;
}

export default function WhatsAppImportWizard({ open, onOpenChange, onImportComplete }: WhatsAppImportWizardProps) {
  const { sessionToken } = useAuth();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [chatText, setChatText] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [empathyIdx, setEmpathyIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [analyzedChunks, setAnalyzedChunks] = useState(0);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreviews, setOcrPreviews] = useState<string[]>([]);

  const reset = () => {
    setStep(1);
    setChatText("");
    setParticipants([]);
    setSelectedPartner(null);
    setImportId(null);
    setProcessing(false);
    setEmpathyIdx(0);
    setProgress(0);
    setTotalChunks(0);
    setAnalyzedChunks(0);
    setResult(null);
    setOcrLoading(false);
    setOcrPreviews([]);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // Step 1 → Step 2: Detect participants
  const handleTextSubmit = () => {
    const detected = detectParticipants(chatText);
    const msgCount = countMessages(chatText);
    if (msgCount < 3) {
      toast({ title: "Poucas mensagens", description: "Cole mais mensagens da conversa.", variant: "destructive" });
      return;
    }
    setParticipants(detected);
    if (detected.length === 1) {
      // Only one participant found (system messages excluded) — skip step 2
      setSelectedPartner(detected[0]);
      setStep(3);
      handleImport(detected[0]);
    } else if (detected.length === 0) {
      toast({ title: "Formato não reconhecido", description: "Verifique se o texto está no formato do WhatsApp.", variant: "destructive" });
    } else {
      setStep(2);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setChatText(text);
    };
    reader.readAsText(file);
  };

  const handlePartnerSelect = (name: string) => {
    setSelectedPartner(name);
    setStep(3);
    handleImport(name);
  };

  // Step 3: Import
  const handleImport = async (partnerName: string) => {
    if (!sessionToken) return;
    setProcessing(true);

    const res = await callWebApi("importWhatsApp", sessionToken, {
      chat_text: chatText,
      contact_label: partnerName,
    });

    if (!res.ok) {
      toast({ title: "Erro ao importar", description: res.data?.error || "Tente novamente.", variant: "destructive" });
      setProcessing(false);
      setStep(1);
      return;
    }

    setImportId(res.data.import_id);
    setTotalChunks(res.data.total_chunks);

    // Process chunks and poll for progress
    processAndPoll(res.data.import_id, res.data.total_chunks);
  };

  const processAndPoll = async (impId: string, total: number) => {
    if (!sessionToken) return;

    // Process chunks in batches
    const processBatch = async () => {
      await callWebApi("processWhatsAppChunks", sessionToken, { import_id: impId });
    };

    // Initial batch
    await processBatch();

    // Poll progress
    pollRef.current = setInterval(async () => {
      const detail = await callWebApi("getWhatsAppImportDetail", sessionToken, { import_id: impId });
      if (detail.ok) {
        const imp = detail.data.import;
        setAnalyzedChunks(imp.analyzed_chunks);
        setProgress(Math.round((imp.analyzed_chunks / Math.max(total, 1)) * 100));

        if (imp.status === "done") {
          if (pollRef.current) clearInterval(pollRef.current);
          setResult(detail.data);
          setStep(4);
          setProcessing(false);
          onImportComplete?.();
        } else if (imp.analyzed_chunks < total) {
          // Process next batch
          await processBatch();
        }
      }
    }, 3000);
  };

  // Empathy phrases rotation
  useEffect(() => {
    if (step !== 3) return;
    const interval = setInterval(() => {
      setEmpathyIdx(i => (i + 1) % EMPATHY_PHRASES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [step]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const msgCount = countMessages(chatText);

  const content = (
    <div className="p-4 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      {/* Close button */}
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Paste / Upload ── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-[#25D366]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Analisar conversa do WhatsApp</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Cole o texto da conversa abaixo ou envie o arquivo <code className="text-xs bg-muted px-1 rounded">.txt</code> exportado do WhatsApp.
              </p>
            </div>

            <Textarea
              placeholder={`Exemplo:\n22/03/2026 14:30 - João: você não sabe fazer nada\n22/03/2026 14:31 - Maria: para de falar assim`}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              className="min-h-[200px] text-sm font-mono bg-muted/30 border-dashed"
            />

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Enviar .txt
              </Button>
              {msgCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {msgCount} mensagens detectadas
                </span>
              )}
            </div>

            {/* Mini tutorial */}
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Como exportar do WhatsApp
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
                <li>Abra a conversa no WhatsApp</li>
                <li>Toque nos 3 pontinhos → <strong>Mais</strong> → <strong>Exportar conversa</strong></li>
                <li>Escolha <strong>"Sem mídia"</strong></li>
                <li>Cole o texto aqui ou envie o arquivo .txt</li>
              </ol>
            </div>

            <Button
              className="w-full gap-2 rounded-xl"
              disabled={msgCount < 3}
              onClick={handleTextSubmit}
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* ── STEP 2: Select partner ── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Quem é o parceiro?</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Identificamos {participants.length} participantes. Toque no nome do parceiro para análise.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {participants.map((name) => (
                <button
                  key={name}
                  onClick={() => handlePartnerSelect(name)}
                  className="px-4 py-2.5 rounded-xl border-2 border-border bg-card text-sm font-medium text-foreground hover:border-primary hover:bg-primary/5 transition-all"
                >
                  {name}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="w-full text-xs">
              ← Voltar
            </Button>
          </motion.div>
        )}

        {/* ── STEP 3: Processing ── */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 text-center py-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Analisando sua conversa</h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={empathyIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-muted-foreground"
                >
                  {EMPATHY_PHRASES[empathyIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="max-w-xs mx-auto space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {analyzedChunks} / {totalChunks} trechos analisados
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Heart className="w-3.5 h-3.5 text-pink-400" />
              <span>Estamos aqui por você</span>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Result ── */}
        {step === 4 && result && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Análise concluída</h3>
              <p className="text-sm text-muted-foreground">
                {result.import?.total_messages} mensagens analisadas em {result.consolidated?.total_analyzed} trechos
              </p>
            </div>

            {/* Risk summary */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${
                  result.consolidated?.predominant_risk === "critico" ? "text-red-500" :
                  result.consolidated?.predominant_risk === "alto" ? "text-orange-500" :
                  result.consolidated?.predominant_risk === "moderado" ? "text-yellow-500" :
                  "text-green-500"
                }`} />
                <span className="font-semibold text-foreground">
                  Risco predominante: {
                    result.consolidated?.predominant_risk === "critico" ? "Crítico" :
                    result.consolidated?.predominant_risk === "alto" ? "Alto" :
                    result.consolidated?.predominant_risk === "moderado" ? "Moderado" :
                    "Sem risco"
                  }
                </span>
              </div>

              {/* Violence types */}
              {Object.keys(result.consolidated?.violence_types || {}).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Tipos de violência detectados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.consolidated.violence_types).map(([type, count]) => (
                      <span key={type} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-lg">
                        {type.replace("violencia_", "").replace(/_/g, " ")} ({count as number})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tactics */}
              {(result.consolidated?.top_taticas || []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Táticas detectadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.consolidated.top_taticas.map((t: string) => (
                      <span key={t} className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk timeline */}
              {(result.results || []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Evolução por trecho</p>
                  <div className="flex gap-1 items-end h-8">
                    {result.results.map((r: any, i: number) => {
                      const color = r.risk_level === "critico" ? "bg-red-500" :
                        r.risk_level === "alto" ? "bg-orange-500" :
                        r.risk_level === "moderado" ? "bg-yellow-500" :
                        "bg-green-500";
                      const h = r.risk_level === "critico" ? "h-8" :
                        r.risk_level === "alto" ? "h-6" :
                        r.risk_level === "moderado" ? "h-4" : "h-2";
                      return (
                        <div key={i} className={`flex-1 rounded-sm ${color} ${h} min-w-[4px]`} title={`Trecho ${i+1}: ${r.risk_level}`} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Orientações */}
            {(result.consolidated?.orientacoes || []).length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  Orientações para você
                </p>
                <ul className="text-sm text-foreground space-y-1.5">
                  {result.consolidated.orientacoes.slice(0, 5).map((o: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button className="w-full rounded-xl" onClick={handleClose}>
              Fechar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Importar conversa do WhatsApp</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Importar conversa do WhatsApp</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
