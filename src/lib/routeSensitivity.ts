/**
 * Route sensitivity classification — preparação para step-up auth futuro.
 *
 * Hoje `requiresStepUp` retorna sempre false. No futuro pode bloquear
 * rotas `high` quando a sessão veio via SSO mobile (`origin === 'web_sso'`)
 * e exigir reautenticação por PIN, biometria ou senha.
 */
export type Sensitivity = "low" | "medium" | "high";

export const ROUTE_SENSITIVITY: Record<string, Sensitivity> = {
  "/home": "low",
  "/mapa": "low",
  "/gravacoes": "low",
  "/suporte": "low",
  "/support": "low",
  "/perfil": "medium",
  "/fonar": "medium",
  "/fonar/historico": "medium",
  "/busca-perfil": "medium",
  "/configuracoes": "high",
};

export function getSensitivity(path: string): Sensitivity {
  if (ROUTE_SENSITIVITY[path]) return ROUTE_SENSITIVITY[path];
  // fallback: prefixos mais específicos vencem
  const match = Object.keys(ROUTE_SENSITIVITY)
    .filter((p) => path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_SENSITIVITY[match] : "low";
}

export interface SessionStepUpInfo {
  origin?: string;
  last_step_up_at?: string | null;
}

/**
 * Placeholder. Hoje sempre false.
 * Futuro: retornar true quando rota é 'high' e sessão veio de web_sso
 * sem step-up recente.
 */
export function requiresStepUp(_path: string, _session: SessionStepUpInfo): boolean {
  return false;
}
