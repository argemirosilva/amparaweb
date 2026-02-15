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
import Copom from "./pages/Copom";

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
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/validar-email" element={<ValidarEmail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/mapa" element={<Mapa />} />
              <Route path="/gravacoes" element={<Gravacoes />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/busca-perfil" element={<BuscaPerfil />} />
              <Route path="/copom" element={<Copom />} />
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
