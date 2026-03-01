

# Auto-rebind de dispositivo no ping

## Problema
Quando a usuaria faz login pelo app em um celular novo, o `device_id` deveria ser vinculado durante o login. Porem, por alguma razao o app nao enviou o `device_id` no payload de login, ou o binding falhou. O resultado e que todos os pings subsequentes sao ignorados com "device_not_bound", e o dashboard mostra o dispositivo como offline.

## Solucao
Alterar o handler `handlePing` na `mobile-api` para que, quando receber um ping de um dispositivo nao vinculado mas com sessao valida, ele **automaticamente re-vincule** o dispositivo (removendo o anterior e criando um novo registro em `device_status`), em vez de ignorar o ping.

## Detalhes tecnicos

### Arquivo: `supabase/functions/mobile-api/index.ts`

**Trecho a alterar** (linhas 660-669 - bloco "Device not bound"):

Comportamento atual:
- Ignora o ping e retorna `device_not_bound`

Novo comportamento:
1. Deletar todos os registros `device_status` anteriores do usuario
2. Inserir um novo registro com o `device_id` do ping atual e os dados de telemetria recebidos
3. Registrar no `audit_logs` a acao `device_auto_rebound`
4. Continuar o fluxo normal do ping (processar GPS, etc.) em vez de retornar imediatamente

Isso garante que, mesmo que o login nao tenha enviado o `device_id`, o primeiro ping com sessao valida ja resolve o vinculo automaticamente.

### Seguranca
- A sessao ja foi validada antes desse ponto (linha 624), entao sabemos que e a usuaria legitima
- O comportamento de "um dispositivo por usuario" e mantido (deleta os anteriores)
- Um log de auditoria e criado para rastreabilidade
