import { ArrowLeft, Mail, Trash2, AlertTriangle, CheckCircle2, Clock, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoAmpara from "@/assets/ampara-logo-transparent.png";

export default function ExcluirConta() {
  const navigate = useNavigate();
  const supportEmail = "suporte@amparamulher.com.br";
  const subject = encodeURIComponent("Solicitação de exclusão de conta - AMPARA");
  const body = encodeURIComponent(
    "Olá, equipe AMPARA.\n\nSolicito a exclusão permanente da minha conta e dos meus dados pessoais.\n\nE-mail cadastrado: \nNome completo: \nTelefone (opcional): \n\nDeclaro estar ciente de que essa ação é irreversível.\n\nObrigada."
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={logoAmpara} alt="AMPARA" className="h-9 w-auto" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              Exclusão de conta e dados
            </h1>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="text-sm text-muted-foreground">
            Aplicativo: <strong className="text-foreground">AMPARA - Proteção da Mulher</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Desenvolvedora: <strong className="text-foreground">OrizonTech</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Última atualização: 23 de abril de 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-primary" /> Como solicitar a exclusão
          </h2>
          <p className="text-sm text-foreground/90">
            Você pode excluir sua conta e seus dados de duas formas:
          </p>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Opção 1 - Pelo aplicativo (recomendado)</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
              <li>Abra o aplicativo AMPARA e faça login com seu e-mail e senha.</li>
              <li>Acesse o menu <strong>Perfil</strong>.</li>
              <li>Role até o final da página, na seção <strong>Zona de risco</strong>.</li>
              <li>Toque em <strong>Excluir minha conta permanentemente</strong>.</li>
              <li>Digite sua senha e a palavra <strong>EXCLUIR</strong> para confirmar.</li>
              <li>Sua conta e dados serão removidos imediatamente.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Opção 2 - Por e-mail</h3>
            <p className="text-sm text-foreground/90">
              Caso não consiga acessar o app, envie um e-mail para nossa equipe solicitando a exclusão. Para confirmar sua identidade, use o mesmo e-mail cadastrado no aplicativo.
            </p>
            <a
              href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              <Mail className="w-4 h-4" />
              Solicitar exclusão por e-mail
            </a>
            <p className="text-xs text-muted-foreground">
              Responderemos em até <strong>5 dias úteis</strong> e concluiremos a exclusão em até <strong>30 dias</strong> a partir da confirmação.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Dados que serão excluídos
          </h2>
          <p className="text-sm text-foreground/90">
            Ao confirmar a exclusão, removemos permanentemente:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
            <li>Dados cadastrais (nome, e-mail, telefone, CPF, data de nascimento, endereço).</li>
            <li>Guardiões cadastrados e contatos de emergência.</li>
            <li>Gravações de áudio e respectivas transcrições.</li>
            <li>Análises de IA (relatórios MICRO e MACRO) vinculadas à sua conta.</li>
            <li>Histórico de localização GPS e telemetria do dispositivo.</li>
            <li>Alertas de pânico, sessões de monitoramento e códigos de compartilhamento.</li>
            <li>Sessões ativas, tokens de acesso e vínculos de dispositivo.</li>
            <li>Configurações pessoais (agenda de monitoramento, retenção, acionamentos).</li>
            <li>Tickets de suporte e avaliações enviadas.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Dados mantidos e período de retenção
          </h2>
          <p className="text-sm text-foreground/90">
            Por exigência legal e de segurança, alguns registros precisam ser preservados após a exclusão da conta:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
            <li>
              <strong>Logs de auditoria anonimizados:</strong> mantidos por até <strong>5 anos</strong>, conforme o Marco Civil da Internet (Lei nº 12.965/2014). Não contêm dados pessoais identificáveis após a exclusão.
            </li>
            <li>
              <strong>Registros de acionamento de autoridades</strong> (ex.: chamadas para 190/180): mantidos por até <strong>5 anos</strong> para fins de prestação de contas e eventual demanda judicial. Os dados são pseudonimizados.
            </li>
            <li>
              <strong>Dados estatísticos agregados e anonimizados:</strong> mantidos indefinidamente para o Portal de Transparência. Esses dados não permitem reidentificação individual (k-anonimato aplicado).
            </li>
            <li>
              <strong>Backups de segurança:</strong> apagados automaticamente em até <strong>90 dias</strong> após a exclusão da conta principal.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" /> Importante
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <p className="text-sm text-foreground/90">
              A exclusão é <strong>irreversível</strong>. Não conseguiremos recuperar seus dados depois de concluído o processo.
            </p>
            <p className="text-sm text-foreground/90">
              Recomendamos exportar previamente qualquer informação que você queira preservar (relatórios, gravações).
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Seus direitos (LGPD)
          </h2>
          <p className="text-sm text-foreground/90">
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), além da exclusão você pode solicitar acesso, correção, portabilidade e revogação de consentimento. Para qualquer dessas solicitações, entre em contato pelo e-mail:{" "}
            <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
              {supportEmail}
            </a>
            .
          </p>
        </section>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          OrizonTech - AMPARA Proteção da Mulher | CNPJ disponível mediante solicitação | Contato:{" "}
          <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
            {supportEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
