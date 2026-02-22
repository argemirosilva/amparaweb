// Only show negative/offensive adjectives directed at women
export const OFFENSE_WORDS = new Set([
  // Xingamentos sexualizados
  "vadia", "vagabunda", "puta", "piranha", "safada", "oferecida", "galinha",
  // Inteligência / capacidade
  "burra", "inútil", "incompetente", "idiota", "imbecil", "retardada", "ignorante", "incapaz", "imprestável",
  // Sanidade / estabilidade
  "louca", "maluca", "histérica", "doida", "perturbada", "desequilibrada", "descontrolada", "pirada", "surtada",
  // Aparência / corpo
  "feia", "gorda", "horrorosa", "nojenta", "repugnante", "asquerosa",
  // Caráter / moral
  "falsa", "mentirosa", "manipuladora", "ardilosa", "traiçoeira", "covarde",
  "ingrata", "interesseira", "aproveitadora", "mercenária", "oportunista",
  // Depreciativos gerais
  "ridícula", "patética", "insignificante", "desprezível", "miserável",
  "desgraçada", "insuportável", "detestável", "desprezada", "ordinária",
  "cretina", "otária", "besta", "trouxa", "mesquinha", "medíocre",
]);
