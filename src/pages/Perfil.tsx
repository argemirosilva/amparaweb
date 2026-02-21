import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserCircle, Users, AlertTriangle, Loader2, Plus, Trash2, Edit2, X, Check, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { EnderecoForm, emptyEndereco, EnderecoFields } from "@/components/EnderecoForm";
import { useToast } from "@/hooks/use-toast";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const TIPOS_VINCULO = [
  "Marido", "Ex-marido", "Namorado", "Ex-namorado",
  "Noivo", "Ex-noivo", "Companheiro", "Ex-companheiro", "Outro",
];

interface PerfilData {
  nome_completo: string;
  email: string;
  telefone: string;
  data_nascimento: string | null;
  endereco_fixo: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_referencia: string | null;
  tem_filhos: boolean;
  mora_com_agressor: boolean;
  avatar_url: string | null;
}

interface GuardiaoData {
  id: string;
  nome: string;
  vinculo: string;
  telefone_whatsapp: string;
}

interface VinculoData {
  id: string;
  tipo_vinculo: string;
  agressor_id: string;
  agressor: {
    nome: string;
    data_nascimento: string | null;
    telefone: string | null;
    forca_seguranca: boolean;
    tem_arma_em_casa: boolean;
    aliases: string[] | null;
    nome_pai_parcial: string | null;
    nome_mae_parcial: string | null;
    primary_city_uf: string | null;
    neighborhoods: string[] | null;
    profession: string | null;
    vehicles: any[] | null;
    sector: string | null;
    risk_level: string | null;
    risk_score: number | null;
    display_name_masked: string | null;
  };
}

const FORCAS_SEGURANCA = [
  "Polícia Militar",
  "Polícia Civil",
  "Polícia Federal",
  "Polícia Rodoviária Federal",
  "Guarda Municipal",
  "Corpo de Bombeiros",
  "Forças Armadas (Exército)",
  "Forças Armadas (Marinha)",
  "Forças Armadas (Aeronáutica)",
  "Agente penitenciário",
  "Outra",
] as const;

interface AgressorEditForm {
  nome: string;
  tipo_vinculo: string;
  data_nascimento: string;
  telefone: string;
  nome_pai_parcial: string;
  nome_mae_parcial: string;
  forca_seguranca: boolean;
  forca_seguranca_tipo: string;
  tem_arma_em_casa: boolean;
  
  cidade_uf: string;
  bairro: string;
  profissao: string;
  placa_parcial: string;
  veiculo_modelo: string;
  veiculo_cor: string;
  
}

export default function PerfilPage() {
  const { usuario, sessionToken } = useAuth();
  const { toast } = useToast();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [guardioes, setGuardioes] = useState<GuardiaoData[]>([]);
  const [vinculos, setVinculos] = useState<VinculoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPerfil, setEditingPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState<Partial<PerfilData>>({});
  const [enderecoForm, setEnderecoForm] = useState<EnderecoFields>(emptyEndereco);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New guardian form
  const [showAddGuardiao, setShowAddGuardiao] = useState(false);
  const [newGuardiao, setNewGuardiao] = useState({ nome: "", vinculo: "", telefone_whatsapp: "" });

  // Guardian editing
  const [editingGuardiaoId, setEditingGuardiaoId] = useState<string | null>(null);
  const [guardiaoEditForm, setGuardiaoEditForm] = useState({ nome: "", vinculo: "", telefone_whatsapp: "" });

  // Aggressor edit
  const [editingAgressorId, setEditingAgressorId] = useState<string | null>(null);
  const [agressorForm, setAgressorForm] = useState<AgressorEditForm | null>(null);
  const [editingVinculoId, setEditingVinculoId] = useState<string | null>(null);

  const api = (action: string, params: Record<string, any> = {}) =>
    callWebApi(action, sessionToken!, params);

  const loadData = async () => {
    setLoading(true);
    const [meRes, gRes, aRes] = await Promise.all([
      api("getMe"),
      api("getGuardioes"),
      api("getMyAgressores"),
    ]);
    if (meRes.ok) setPerfil(meRes.data.usuario);
    if (gRes.ok) setGuardioes(gRes.data.guardioes);
    if (aRes.ok) setVinculos(aRes.data.vinculos);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionToken) loadData();
  }, [sessionToken]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Selecione uma imagem (JPG, PNG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${usuario.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await api("updateMe", { avatar_url: avatarUrl });
      setPerfil(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast({ title: "Foto atualizada!" });

    } catch (err) {
      console.error("Avatar upload error:", err);
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const savePerfil = async () => {
    setSaving(true);
    await api("updateMe", { ...perfilForm, ...enderecoForm,
      endereco_fixo: `${enderecoForm.endereco_logradouro}, ${enderecoForm.endereco_numero} - ${enderecoForm.endereco_bairro}, ${enderecoForm.endereco_cidade}/${enderecoForm.endereco_uf}`,
    });
    await loadData();
    setEditingPerfil(false);
    setSaving(false);
  };

  const addGuardiao = async () => {
    if (!newGuardiao.nome.trim() || !newGuardiao.vinculo.trim() || newGuardiao.telefone_whatsapp.replace(/\D/g, "").length < 10) return;
    setSaving(true);
    await api("createGuardiao", newGuardiao);
    setNewGuardiao({ nome: "", vinculo: "", telefone_whatsapp: "" });
    setShowAddGuardiao(false);
    await loadData();
    setSaving(false);
  };

  const deleteGuardiao = async (id: string) => {
    await api("deleteGuardiao", { guardiao_id: id });
    await loadData();
  };

  const startEditingGuardiao = (g: GuardiaoData) => {
    setEditingGuardiaoId(g.id);
    setGuardiaoEditForm({ nome: g.nome, vinculo: g.vinculo, telefone_whatsapp: formatPhone(g.telefone_whatsapp) });
  };

  const saveGuardiao = async () => {
    if (!editingGuardiaoId || !guardiaoEditForm.nome.trim() || !guardiaoEditForm.vinculo.trim() || guardiaoEditForm.telefone_whatsapp.replace(/\D/g, "").length < 10) return;
    setSaving(true);
    const res = await api("updateGuardiao", { guardiao_id: editingGuardiaoId, ...guardiaoEditForm });
    if (res.ok) {
      toast({ title: "Guardião atualizado" });
      setEditingGuardiaoId(null);
      await loadData();
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };
  const deleteVinculo = async (id: string) => {
    await api("deleteVinculo", { vinculo_id: id });
    await loadData();
  };

  const startEditingAgressor = (v: VinculoData) => {
    const ag = v.agressor;
    const firstVehicle = Array.isArray(ag.vehicles) && ag.vehicles.length > 0 ? ag.vehicles[0] : null;
    setEditingAgressorId(v.agressor_id);
    setEditingVinculoId(v.id);
    setAgressorForm({
      nome: ag.nome || "",
      tipo_vinculo: v.tipo_vinculo || "",
      data_nascimento: ag.data_nascimento || "",
      telefone: ag.telefone || "",
      nome_pai_parcial: ag.nome_pai_parcial || "",
      nome_mae_parcial: ag.nome_mae_parcial || "",
      forca_seguranca: ag.forca_seguranca || false,
      forca_seguranca_tipo: ag.sector || "",
      tem_arma_em_casa: ag.tem_arma_em_casa || false,
      
      cidade_uf: ag.primary_city_uf || "",
      bairro: ag.neighborhoods?.length ? ag.neighborhoods[0] : "",
      profissao: ag.profession || "",
      placa_parcial: firstVehicle?.plate_partial || firstVehicle?.plate_prefix || "",
      veiculo_modelo: firstVehicle?.model || "",
      veiculo_cor: firstVehicle?.color || "",
      
    });
  };

  const cancelEditingAgressor = () => {
    setEditingAgressorId(null);
    setEditingVinculoId(null);
    setAgressorForm(null);
  };

  const saveAgressor = async () => {
    if (!agressorForm || !editingAgressorId || !editingVinculoId) return;
    setSaving(true);

    const payload: Record<string, any> = {
      agressor_id: editingAgressorId,
      nome: agressorForm.nome,
      data_nascimento: agressorForm.data_nascimento || null,
      telefone: agressorForm.telefone || null,
      nome_pai_parcial: agressorForm.nome_pai_parcial || null,
      nome_mae_parcial: agressorForm.nome_mae_parcial || null,
      forca_seguranca: agressorForm.forca_seguranca,
      tem_arma_em_casa: agressorForm.tem_arma_em_casa,
      sector: agressorForm.forca_seguranca ? (agressorForm.forca_seguranca_tipo || null) : null,
    };

    if (agressorForm.cidade_uf.trim()) payload.primary_city_uf = agressorForm.cidade_uf.trim();
    else payload.primary_city_uf = null;
    if (agressorForm.bairro.trim()) payload.neighborhoods = [agressorForm.bairro.trim()];
    else payload.neighborhoods = [];
    if (agressorForm.profissao.trim()) payload.profession = agressorForm.profissao.trim();
    else payload.profession = null;
    if (agressorForm.placa_parcial.trim() || agressorForm.veiculo_modelo.trim() || agressorForm.veiculo_cor.trim()) {
      payload.vehicles = [{
        plate_partial: agressorForm.placa_parcial.trim() || undefined,
        model: agressorForm.veiculo_modelo.trim() || undefined,
        color: agressorForm.veiculo_cor.trim() || undefined,
      }];
    } else payload.vehicles = [];

    const res = await api("updateAgressor", payload);

    // Also update vínculo if tipo_vinculo changed
    await api("updateVinculo", { vinculo_id: editingVinculoId, tipo_vinculo: agressorForm.tipo_vinculo });

    if (res.ok) {
      toast({ title: "Agressor atualizado" });
      cancelEditingAgressor();
      await loadData();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-display font-bold text-foreground">Perfil</h1>

      {/* Personal Data */}
      <div className="ampara-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden group shrink-0 ring-2 ring-border hover:ring-primary transition-colors"
            >
              {perfil?.avatar_url ? (
                <img src={perfil.avatar_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <div>
              <p className="font-semibold text-foreground">{perfil?.nome_completo}</p>
              <p className="text-sm text-muted-foreground">{perfil?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            setEditingPerfil(!editingPerfil);
            setPerfilForm({
              nome_completo: perfil?.nome_completo || "",
              telefone: perfil?.telefone || "",
              data_nascimento: perfil?.data_nascimento || "",
              tem_filhos: perfil?.tem_filhos || false,
              mora_com_agressor: perfil?.mora_com_agressor || false,
            });
            setEnderecoForm({
              endereco_cep: perfil?.endereco_cep || "",
              endereco_logradouro: perfil?.endereco_logradouro || "",
              endereco_numero: perfil?.endereco_numero || "",
              endereco_complemento: perfil?.endereco_complemento || "",
              endereco_bairro: perfil?.endereco_bairro || "",
              endereco_cidade: perfil?.endereco_cidade || "",
              endereco_uf: perfil?.endereco_uf || "",
              endereco_referencia: perfil?.endereco_referencia || "",
            });
          }}>
            {editingPerfil ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </Button>
        </div>

        {!editingPerfil ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Telefone</p><p className="text-foreground">{perfil?.telefone || "—"}</p></div>
            <div><p className="text-muted-foreground">Nascimento</p><p className="text-foreground">{perfil?.data_nascimento || "—"}</p></div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Endereço</p>
              <p className="text-foreground">{perfil?.endereco_fixo || "—"}</p>
              {perfil?.endereco_referencia && <p className="text-xs text-muted-foreground mt-0.5">Ref: {perfil.endereco_referencia}</p>}
            </div>
            <div><p className="text-muted-foreground">Tem filhos?</p><p className="text-foreground">{perfil?.tem_filhos ? "Sim" : "Não"}</p></div>
            <div><p className="text-muted-foreground">Mora com agressor?</p><p className="text-foreground">{perfil?.mora_com_agressor ? "Sim" : "Não"}</p></div>
          </div>
        ) : (
          <div className="space-y-3">
            <input type="text" className="ampara-input" placeholder="Nome completo" value={perfilForm.nome_completo || ""}
              onChange={e => setPerfilForm({ ...perfilForm, nome_completo: e.target.value })} />
            <input type="tel" className="ampara-input" placeholder="Telefone" value={formatPhone(perfilForm.telefone || "")}
              onChange={e => setPerfilForm({ ...perfilForm, telefone: e.target.value })} />
            <input type="date" className="ampara-input" value={perfilForm.data_nascimento || ""}
              onChange={e => setPerfilForm({ ...perfilForm, data_nascimento: e.target.value })} />
            <EnderecoForm value={enderecoForm} onChange={setEnderecoForm} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={perfilForm.tem_filhos || false}
                onChange={e => setPerfilForm({ ...perfilForm, tem_filhos: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary" />
              <span className="text-sm">Tem filhos?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={perfilForm.mora_com_agressor || false}
                onChange={e => setPerfilForm({ ...perfilForm, mora_com_agressor: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary" />
              <span className="text-sm">Mora com agressor?</span>
            </label>
            <Button onClick={savePerfil} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Salvar</>}
            </Button>
          </div>
        )}
      </div>

      {/* Guardians */}
      <div className="ampara-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Rede de Apoio (Guardiões)</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddGuardiao(!showAddGuardiao)}>
            {showAddGuardiao ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {showAddGuardiao && (
          <div className="border border-border rounded-xl p-3 space-y-2">
            <input type="text" className="ampara-input" placeholder="Nome" value={newGuardiao.nome}
              onChange={e => setNewGuardiao({ ...newGuardiao, nome: e.target.value })} />
            <select className="ampara-input" value={newGuardiao.vinculo}
              onChange={e => setNewGuardiao({ ...newGuardiao, vinculo: e.target.value })}>
              <option value="" disabled>Selecione o vínculo</option>
              <option value="Amigo(a)">Amigo(a)</option>
              <option value="Irmão(ã)">Irmão(ã)</option>
              <option value="Pais">Pais</option>
            </select>
            <input type="tel" className="ampara-input" placeholder="(00) 00000-0000" value={newGuardiao.telefone_whatsapp}
              onChange={e => setNewGuardiao({ ...newGuardiao, telefone_whatsapp: formatPhone(e.target.value) })} />
            <Button onClick={addGuardiao} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        )}

        {guardioes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum guardião cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {guardioes.map(g => (
              <div key={g.id} className="border border-border rounded-xl p-3 space-y-2">
                {editingGuardiaoId === g.id ? (
                  <>
                    <input type="text" className="ampara-input" placeholder="Nome" value={guardiaoEditForm.nome}
                      onChange={e => setGuardiaoEditForm({ ...guardiaoEditForm, nome: e.target.value })} />
                    <select className="ampara-input" value={guardiaoEditForm.vinculo}
                      onChange={e => setGuardiaoEditForm({ ...guardiaoEditForm, vinculo: e.target.value })}>
                      <option value="" disabled>Selecione o vínculo</option>
                      <option value="Amigo(a)">Amigo(a)</option>
                      <option value="Irmão(ã)">Irmão(ã)</option>
                      <option value="Pais">Pais</option>
                      <option value="Vizinho(a)">Vizinho(a)</option>
                      <option value="Colega">Colega</option>
                      <option value="Outro">Outro</option>
                    </select>
                    <input type="tel" className="ampara-input" placeholder="(00) 00000-0000" value={guardiaoEditForm.telefone_whatsapp}
                      onChange={e => setGuardiaoEditForm({ ...guardiaoEditForm, telefone_whatsapp: formatPhone(e.target.value) })} />
                    <div className="flex gap-2">
                      <Button onClick={saveGuardiao} disabled={saving} size="sm" className="flex-1">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Salvar</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingGuardiaoId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{g.nome}</p>
                      <p className="text-xs text-muted-foreground">{g.vinculo} • {formatPhone(g.telefone_whatsapp)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditingGuardiao(g)} className="text-muted-foreground hover:text-foreground p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteGuardiao(g.id)} className="text-destructive hover:text-destructive/80 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggressors */}
      <div className="ampara-card space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-semibold text-foreground">Agressor(es) Vinculado(s)</h2>
        </div>

        {vinculos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agressor vinculado.</p>
        ) : (
          <div className="space-y-3">
            {vinculos.map(v => {
              const isEditing = editingAgressorId === v.agressor_id;

              return (
                <div key={v.id} className="border border-border rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{v.agressor.nome}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="ampara-tag !py-0.5 !px-2 text-xs">{v.tipo_vinculo}</span>
                        {v.agressor.risk_level && v.agressor.risk_level !== "baixo" && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            v.agressor.risk_level === "critico" ? "bg-destructive/20 text-destructive" :
                            v.agressor.risk_level === "alto" ? "bg-orange-500/20 text-orange-700" :
                            "bg-yellow-500/20 text-yellow-700"
                          }`}>
                            Risco {v.agressor.risk_level}
                          </span>
                        )}
                        {v.agressor.forca_seguranca && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Força seg.</span>
                        )}
                        {v.agressor.tem_arma_em_casa && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Arma</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => isEditing ? cancelEditingAgressor() : startEditingAgressor(v)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteVinculo(v.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-destructive hover:text-destructive/80">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* View details (collapsed) */}
                  {!isEditing && (
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2 text-xs">
                      {v.agressor.primary_city_uf && (
                        <div><span className="text-muted-foreground">Cidade/UF:</span> <span className="text-foreground">{v.agressor.primary_city_uf}</span></div>
                      )}
                      {v.agressor.profession && (
                        <div><span className="text-muted-foreground">Profissão:</span> <span className="text-foreground">{v.agressor.profession}</span></div>
                      )}
                      {v.agressor.neighborhoods?.length ? (
                        <div><span className="text-muted-foreground">Bairro:</span> <span className="text-foreground">{v.agressor.neighborhoods[0]}</span></div>
                      ) : null}
                    </div>
                  )}

                    {/* Edit form */}
                  {isEditing && agressorForm && (
                    <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do agressor</label>
                        <input type="text" className="ampara-input text-sm" placeholder="Nome completo ou parcial" value={agressorForm.nome}
                          onChange={e => setAgressorForm({ ...agressorForm, nome: e.target.value })} />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de vínculo</label>
                        <select className="ampara-input text-sm" value={agressorForm.tipo_vinculo}
                          onChange={e => setAgressorForm({ ...agressorForm, tipo_vinculo: e.target.value })}>
                          <option value="">Selecione...</option>
                          {TIPOS_VINCULO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Data de nascimento</label>
                        <input type="date" className="ampara-input text-sm" value={agressorForm.data_nascimento}
                          onChange={e => setAgressorForm({ ...agressorForm, data_nascimento: e.target.value })} />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
                        <input type="tel" className="ampara-input text-sm" placeholder="(00) 00000-0000" value={agressorForm.telefone}
                          onChange={e => setAgressorForm({ ...agressorForm, telefone: formatPhone(e.target.value) })} />
                      </div>


                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do pai</label>
                          <input type="text" className="ampara-input text-sm" placeholder="Parcial" value={agressorForm.nome_pai_parcial}
                            onChange={e => setAgressorForm({ ...agressorForm, nome_pai_parcial: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Nome da mãe</label>
                          <input type="text" className="ampara-input text-sm" placeholder="Parcial" value={agressorForm.nome_mae_parcial}
                            onChange={e => setAgressorForm({ ...agressorForm, nome_mae_parcial: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Cidade/UF</label>
                          <input type="text" className="ampara-input text-sm" placeholder="Ex: São Paulo/SP" value={agressorForm.cidade_uf}
                            onChange={e => setAgressorForm({ ...agressorForm, cidade_uf: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Bairro/Região</label>
                          <input type="text" className="ampara-input text-sm" placeholder="Bairro" value={agressorForm.bairro}
                            onChange={e => setAgressorForm({ ...agressorForm, bairro: e.target.value })} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Profissão</label>
                        <input type="text" className="ampara-input text-sm" placeholder="Profissão ou setor" value={agressorForm.profissao}
                          onChange={e => setAgressorForm({ ...agressorForm, profissao: e.target.value })} />
                      </div>

                      <div className="border border-border rounded-lg p-2.5 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Veículo</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Placa parcial</label>
                            <input type="text" className="ampara-input text-sm" placeholder="ABC1" value={agressorForm.placa_parcial} maxLength={7}
                              onChange={e => setAgressorForm({ ...agressorForm, placa_parcial: e.target.value.toUpperCase() })} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Modelo</label>
                            <input type="text" className="ampara-input text-sm" placeholder="Gol, Civic" value={agressorForm.veiculo_modelo}
                              onChange={e => setAgressorForm({ ...agressorForm, veiculo_modelo: e.target.value })} maxLength={50} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Cor</label>
                            <input type="text" className="ampara-input text-sm" placeholder="Preto" value={agressorForm.veiculo_cor}
                              onChange={e => setAgressorForm({ ...agressorForm, veiculo_cor: e.target.value })} maxLength={30} />
                          </div>
                        </div>
                      </div>


                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                          <input type="checkbox" checked={agressorForm.forca_seguranca}
                            onChange={e => setAgressorForm({ ...agressorForm, forca_seguranca: e.target.checked, forca_seguranca_tipo: e.target.checked ? agressorForm.forca_seguranca_tipo : "" })}
                            className="h-4 w-4 rounded border-input accent-primary" />
                          <span className="text-xs text-foreground">É de alguma força de segurança?</span>
                        </label>
                        {agressorForm.forca_seguranca && (
                          <div className="ml-7 space-y-1.5">
                            {FORCAS_SEGURANCA.map((forca) => (
                              <label key={forca} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="forca_seguranca_tipo"
                                  checked={agressorForm.forca_seguranca_tipo === forca}
                                  onChange={() => setAgressorForm({ ...agressorForm, forca_seguranca_tipo: forca })}
                                  className="h-3.5 w-3.5 accent-primary"
                                />
                                <span className="text-xs text-foreground">{forca}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={agressorForm.tem_arma_em_casa}
                          onChange={e => setAgressorForm({ ...agressorForm, tem_arma_em_casa: e.target.checked })}
                          className="h-4 w-4 rounded border-input accent-primary" />
                        <span className="text-xs text-foreground">Tem arma em casa?</span>
                      </label>

                      <Button onClick={saveAgressor} disabled={saving} size="sm" className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Salvar alterações</>}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
