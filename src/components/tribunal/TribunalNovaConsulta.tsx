import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, FileJson, FileText, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onConsultaCriada?: () => void;
}

export default function TribunalNovaConsulta({ onConsultaCriada }: Props) {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const [modo, setModo] = useState("analitico");
  const [incluirAmpara, setIncluirAmpara] = useState(true);

  // Vítima
  const [vitimaNome, setVitimaNome] = useState("");
  const [vitimaCpf4, setVitimaCpf4] = useState("");
  const [vitimaTelefone, setVitimaTelefone] = useState("");

  // Agressor
  const [agressorNome, setAgressorNome] = useState("");
  const [agressorCpf4, setAgressorCpf4] = useState("");

  // Processo
  const [processoTipo, setProcessoTipo] = useState("processo");
  const [processoNumero, setProcessoNumero] = useState("");
  const [processoResumo, setProcessoResumo] = useState("");
  const [processoConteudo, setProcessoConteudo] = useState("");

  const handleSubmit = async () => {
    if (!processoConteudo && !processoResumo) {
      toast({ title: "Erro", description: "Informe ao menos o resumo ou conteúdo do processo.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResultado(null);
    try {
      const body: any = {
        action: "consulta",
        session_token: sessionToken,
        modo_saida: modo,
        incluir_dados_ampara: incluirAmpara,
      };

      if (vitimaNome || vitimaCpf4 || vitimaTelefone) {
        body.dados_vitima = {};
        if (vitimaNome) body.dados_vitima.nome = vitimaNome;
        if (vitimaCpf4) body.dados_vitima.cpf_last4 = vitimaCpf4;
        if (vitimaTelefone) body.dados_vitima.telefone = vitimaTelefone;
      }

      if (agressorNome || agressorCpf4) {
        body.dados_agressor = {};
        if (agressorNome) body.dados_agressor.nome = agressorNome;
        if (agressorCpf4) body.dados_agressor.cpf_last4 = agressorCpf4;
      }

      body.dados_processo = {
        tipo: processoTipo,
        numero: processoNumero || undefined,
        resumo: processoResumo || undefined,
        conteudo: processoConteudo || undefined,
      };

      const { data, error } = await supabase.functions.invoke("tribunal-api", { body });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      setResultado(data);
      toast({ title: "Consulta realizada", description: `Modo: ${modo} - ID: ${data.consulta_id?.substring(0, 8)}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        {/* Mode selector */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Modo de Saída</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[
                { value: "analitico", label: "Analítico", icon: FileJson, desc: "JSON estruturado" },
                { value: "despacho", label: "Despacho", icon: FileText, desc: "Texto institucional" },
                { value: "parecer", label: "Parecer", icon: BookOpen, desc: "Parecer técnico" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModo(m.value)}
                  className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                    modo === m.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <m.icon className="w-4 h-4 mb-1" />
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Switch checked={incluirAmpara} onCheckedChange={setIncluirAmpara} />
              <Label className="text-sm">Incluir dados internos AMPARA</Label>
            </div>
          </CardContent>
        </Card>

        {/* Vítima */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados da Vítima (opcional)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input value={vitimaNome} onChange={(e) => setVitimaNome(e.target.value)} placeholder="Nome completo ou parcial" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Últimos 4 dígitos CPF</Label><Input value={vitimaCpf4} onChange={(e) => setVitimaCpf4(e.target.value)} maxLength={4} /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={vitimaTelefone} onChange={(e) => setVitimaTelefone(e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        {/* Agressor */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados do Agressor (opcional)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input value={agressorNome} onChange={(e) => setAgressorNome(e.target.value)} placeholder="Nome completo ou parcial" /></div>
            <div><Label className="text-xs">Últimos 4 dígitos CPF</Label><Input value={agressorCpf4} onChange={(e) => setAgressorCpf4(e.target.value)} maxLength={4} /></div>
          </CardContent>
        </Card>

        {/* Processo */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados do Processo / Documento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={processoTipo} onValueChange={setProcessoTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="processo">Processo</SelectItem>
                    <SelectItem value="bo">Boletim de Ocorrência</SelectItem>
                    <SelectItem value="medida_protetiva">Medida Protetiva</SelectItem>
                    <SelectItem value="depoimento">Depoimento</SelectItem>
                    <SelectItem value="laudo">Laudo</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Número</Label><Input value={processoNumero} onChange={(e) => setProcessoNumero(e.target.value)} placeholder="Nº do processo/BO" /></div>
            </div>
            <div><Label className="text-xs">Resumo</Label><Textarea value={processoResumo} onChange={(e) => setProcessoResumo(e.target.value)} rows={2} placeholder="Resumo breve do documento" /></div>
            <div><Label className="text-xs">Conteúdo completo</Label><Textarea value={processoConteudo} onChange={(e) => setProcessoConteudo(e.target.value)} rows={6} placeholder="Cole aqui o conteúdo do documento, depoimento, relato..." /></div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {loading ? "Analisando..." : "Gerar Análise"}
        </Button>
      </div>

      {/* Result */}
      <div>
        {!resultado && !loading && (
          <Card className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">O resultado da análise aparecerá aqui</p>
          </Card>
        )}

        {loading && (
          <Card className="h-64 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Processando análise no modo {modo}...</p>
            </div>
          </Card>
        )}

        {resultado && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Resultado</CardTitle>
                <Badge>{modo === "analitico" ? "JSON" : modo === "despacho" ? "Despacho" : "Parecer"}</Badge>
                {resultado.vitima_vinculada && <Badge variant="outline" className="text-xs">Vítima vinculada</Badge>}
                {resultado.agressor_vinculado && <Badge variant="outline" className="text-xs">Agressor vinculado</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[60vh]">
                {modo === "analitico" ? (
                  <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
                    {JSON.stringify(resultado.analise, null, 2)}
                  </pre>
                ) : (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                    {resultado.texto}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
