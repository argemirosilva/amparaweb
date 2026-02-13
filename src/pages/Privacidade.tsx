import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Privacidade() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Política de Privacidade
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Última atualização: 13 de fevereiro de 2026
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introdução</h2>
            <p>
              O <strong>AMPARA</strong> ("nós", "nosso") é um aplicativo voltado à proteção de mulheres em situação de vulnerabilidade.
              Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos as informações pessoais dos nossos usuários ("você").
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Dados Coletados</h2>
            <p>Podemos coletar os seguintes dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados cadastrais:</strong> nome completo, e-mail, telefone, data de nascimento e endereço.</li>
              <li><strong>Dados de localização:</strong> coordenadas GPS coletadas durante alertas de pânico e compartilhamento voluntário.</li>
              <li><strong>Gravações de áudio:</strong> captadas durante os períodos de monitoramento configurados por você.</li>
              <li><strong>Dados do dispositivo:</strong> modelo, sistema operacional, nível de bateria e versão do aplicativo.</li>
              <li><strong>Dados de uso:</strong> interações com o aplicativo para melhoria contínua do serviço.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Finalidade do Tratamento</h2>
            <p>Seus dados são utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prover funcionalidades de monitoramento e proteção.</li>
              <li>Enviar alertas de emergência aos guardiões cadastrados.</li>
              <li>Analisar gravações com inteligência artificial para identificar situações de risco.</li>
              <li>Compartilhar localização em tempo real durante situações de emergência.</li>
              <li>Melhorar e personalizar a experiência do usuário.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Compartilhamento de Dados</h2>
            <p>
              Seus dados <strong>não são vendidos</strong> a terceiros. Podemos compartilhar informações apenas nas seguintes situações:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Com guardiões cadastrados por você, durante alertas de pânico.</li>
              <li>Com autoridades competentes, mediante determinação judicial ou em caso de risco iminente à vida.</li>
              <li>Com prestadores de serviço essenciais ao funcionamento do aplicativo (ex.: servidores em nuvem), sob acordos de confidencialidade.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Armazenamento e Segurança</h2>
            <p>
              Todos os dados são armazenados em servidores seguros com criptografia em trânsito e em repouso.
              Gravações sem risco identificado são automaticamente excluídas conforme o período de retenção configurado por você.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Seus Direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar seus dados pessoais.</li>
              <li>Corrigir dados incompletos ou desatualizados.</li>
              <li>Solicitar a exclusão dos seus dados.</li>
              <li>Revogar o consentimento para tratamento de dados.</li>
              <li>Solicitar a portabilidade dos seus dados.</li>
            </ul>
            <p>
              Para exercer seus direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:suporte@amparamulher.com.br" className="text-primary hover:underline">
                suporte@amparamulher.com.br
              </a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos você sobre alterações significativas por meio do aplicativo ou e-mail cadastrado.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Contato</h2>
            <p>
              Em caso de dúvidas sobre esta política, entre em contato conosco:
            </p>
            <p>
              <strong>E-mail:</strong>{" "}
              <a href="mailto:suporte@amparamulher.com.br" className="text-primary hover:underline">
                suporte@amparamulher.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
