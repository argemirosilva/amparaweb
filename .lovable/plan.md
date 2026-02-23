

## Adicionar Templates WhatsApp nas Integrações

### O que será feito

Adicionar dois novos campos de configuração na seção "WhatsApp Business — Notificações" da tela de Integrações:

1. **Template de ativação e validação do telefone** — nome do template Meta usado para validar/ativar o número de telefone da usuária.
2. **Template de validação de segurança para o suporte** — nome do template Meta usado para validação de segurança em interações de suporte.

### Etapas

**1. Inserir os dois novos registros na tabela `admin_settings`**

Serão criados via migração SQL:

- `whatsapp_template_ativacao` (categoria `integracao_whatsapp`) — com descrição explicativa
- `whatsapp_template_suporte` (categoria `integracao_whatsapp`) — com descrição explicativa

Ambos iniciarão com valor vazio para que o administrador preencha o nome do template aprovado pela Meta.

**2. Adicionar labels amigáveis no front-end**

No arquivo `src/pages/admin/AdminIntegracoes.tsx`, adicionar ao objeto `FRIENDLY_LABELS`:

- `whatsapp_template_ativacao` → "Template de ativação/validação"
- `whatsapp_template_suporte` → "Template de segurança (suporte)"

Nenhuma outra alteração de código é necessária — os novos campos aparecerão automaticamente na interface porque o componente já renderiza todos os settings da categoria `integracao_whatsapp`.

