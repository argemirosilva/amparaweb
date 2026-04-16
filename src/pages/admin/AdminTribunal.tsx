import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import TribunalConsultas from "@/components/tribunal/TribunalConsultas";
import TribunalNovaConsulta from "@/components/tribunal/TribunalNovaConsulta";
import { Scale } from "lucide-react";

export default function AdminTribunal() {
  const [activeTab, setActiveTab] = useState("consultas");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Scale}
        breadcrumb="Judiciário"
        title="AMPARA Judiciário"
        description="Motor de análise multi-saída para o sistema judiciário"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/80 border">
          <TabsTrigger value="consultas">Consultas</TabsTrigger>
          <TabsTrigger value="nova">Nova Consulta</TabsTrigger>
        </TabsList>

        <TabsContent value="consultas">
          <TribunalConsultas />
        </TabsContent>
        <TabsContent value="nova">
          <TribunalNovaConsulta onConsultaCriada={() => setActiveTab("consultas")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
