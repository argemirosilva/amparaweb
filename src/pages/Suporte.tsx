import { useState } from "react";
import { Mail, Send, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";

const faqItems = [
  {
    q: "Como funciona o monitoramento de áudio?",
    a: "O monitoramento capta áudio ambiente em períodos programados, transcreve automaticamente e analisa o conteúdo com inteligência artificial para identificar situações de risco.",
  },
  {
    q: "Meus dados são seguros?",
    a: "Sim. Todos os dados são criptografados e armazenados de forma segura. Apenas você tem acesso às suas gravações e informações pessoais.",
  },
  {
    q: "Como configuro os horários de monitoramento?",
    a: "Acesse Configurações e edite os períodos de monitoramento. Você pode definir horários diferentes para cada dia da semana.",
  },
  {
    q: "O que é o alerta de pânico?",
    a: "É um recurso que permite acionar rapidamente seus guardiões e compartilhar sua localização em tempo real em uma situação de emergência.",
  },
  {
    q: "Como adiciono guardiões?",
    a: "Na tela de Perfil, você pode cadastrar guardiões informando nome, telefone WhatsApp e o tipo de vínculo.",
  },
  {
    q: "As gravações ficam salvas por quanto tempo?",
    a: "O tempo de retenção é configurável em Configurações. Gravações sem risco identificado são removidas automaticamente após o período definido.",
  },
];

export default function SuportePage() {
  const { sessionToken } = useAuth();
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!assunto.trim() || !mensagem.trim()) {
      toast.error("Preencha o assunto e a mensagem.");
      return;
    }
    setSending(true);
    try {
      if (sessionToken) {
        await callWebApi("send_support_message", sessionToken, {
          assunto: assunto.trim(),
          mensagem: mensagem.trim(),
        });
      }
      toast.success("Mensagem enviada! Responderemos em breve.");
      setAssunto("");
      setMensagem("");
    } catch {
      toast.error("Erro ao enviar. Tente novamente ou envie por e-mail.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Suporte</h1>

      <div className="max-w-lg space-y-6">
        {/* FAQ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Contato por e-mail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Fale Conosco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie sua dúvida ou entre em contato diretamente pelo e-mail:
            </p>
            <a
              href="mailto:suporte@ampara.app"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Mail className="w-4 h-4" />
              suporte@ampara.app
            </a>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="assunto">Assunto</Label>
                <Input
                  id="assunto"
                  placeholder="Ex: Dúvida sobre monitoramento"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Descreva sua dúvida ou problema..."
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="w-full gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
