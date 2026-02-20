import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Cadastro from "./pages/Cadastro";
import ValidarEmail from "./pages/ValidarEmail";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Gravacoes from "./pages/Gravacoes";
import Perfil from "./pages/Perfil";
import Configuracoes from "./pages/Configuracoes";
import BuscaPerfil from "./pages/BuscaPerfil";
import Mapa from "./pages/Mapa";
import NotFound from "./pages/NotFound";
import DocApi from "./pages/DocApi";
import Rastreamento from "./pages/Rastreamento";
import Suporte from "./pages/Suporte";
import Privacidade from "./pages/Privacidade";

import PortalLayout from "./components/institucional/PortalLayout";
import TransparenciaHome from "./pages/transparencia/TransparenciaHome";
import TransparenciaMapa from "./pages/transparencia/TransparenciaMapa";
import TransparenciaMetodologia from "./pages/transparencia/TransparenciaMetodologia";
import TransparenciaDadosAbertos from "./pages/transparencia/TransparenciaDadosAbertos";
import AdminLayout from "./components/institucional/AdminLayout";
import ProtectedAdminRoute from "./components/institucional/ProtectedAdminRoute";

import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminAuditoria from "./pages/admin/AdminAuditoria";
import AdminRelatorios from "./pages/admin/AdminRelatorios";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminGeradorAudios from "./pages/admin/AdminGeradorAudios";
import AdminMapa from "./pages/admin/AdminMapa";
import AdminOrgaos from "./pages/admin/AdminOrgaos";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import AdminIntegracoes from "./pages/admin/AdminIntegracoes";
import AdminLogin from "./pages/admin/AdminLogin";
import ConfigurarConta from "./pages/ConfigurarConta";
import EsqueciSenha from "./pages/EsqueciSenha";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/validar-email" element={<ValidarEmail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/configurar-conta" element={<ConfigurarConta />} />
            <Route path="/redefinir-senha" element={<ConfigurarConta />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/mapa" element={<Mapa />} />
              <Route path="/gravacoes" element={<Gravacoes />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/busca-perfil" element={<BuscaPerfil />} />
              
            </Route>
            {/* Portal Público de Transparência */}
            <Route element={<PortalLayout />}>
              <Route path="/transparencia" element={<TransparenciaHome />} />
              <Route path="/transparencia/mapa" element={<TransparenciaMapa />} />
              <Route path="/transparencia/metodologia" element={<TransparenciaMetodologia />} />
              <Route path="/transparencia/dados-abertos" element={<TransparenciaDadosAbertos />} />
            </Route>
            {/* Admin Governamental */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminMapa />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/admin/auditoria" element={<AdminAuditoria />} />
              <Route path="/admin/relatorios" element={<AdminRelatorios />} />
              
              <Route path="/admin/orgaos" element={<AdminOrgaos />} />
              <Route path="/admin/configuracoes" element={<ProtectedAdminRoute requiredRole="admin_master"><AdminConfiguracoes /></ProtectedAdminRoute>} />
              <Route path="/admin/integracoes" element={<ProtectedAdminRoute requiredRole="admin_master"><AdminIntegracoes /></ProtectedAdminRoute>} />
              <Route path="/admin/gerador-audios-ampara" element={<ProtectedAdminRoute requiredRole="admin_master"><AdminGeradorAudios /></ProtectedAdminRoute>} />
            </Route>
            <Route path="/suporte" element={<Suporte />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/doc-api" element={<DocApi />} />
            <Route path="/:codigo" element={<Rastreamento />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
