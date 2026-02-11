import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserCircle, Users, AlertTriangle, Loader2, Plus, Trash2, Edit2, X, Check, Camera } from "lucide-react";
import { EnderecoForm, emptyEndereco, EnderecoFields } from "@/components/EnderecoForm";
import { useToast } from "@/hooks/use-toast";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

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
  agressor: {
    nome: string;
    data_nascimento: string | null;
    telefone: string | null;
    forca_seguranca: boolean;
    tem_arma_em_casa: boolean;
  };
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

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

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

  const deleteVinculo = async (id: string) => {
    await api("deleteVinculo", { vinculo_id: id });
    await loadData();
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
            {/* Avatar */}
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
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div>
              <p className="font-semibold text-foreground">{perfil?.nome_completo}</p>
              <p className="text-sm text-muted-foreground">{perfil?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            setEditingPerfil(!editingPerfil);
            setPerfilForm({
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
            <input type="text" className="ampara-input" placeholder="Vínculo (mãe, irmã...)" value={newGuardiao.vinculo}
              onChange={e => setNewGuardiao({ ...newGuardiao, vinculo: e.target.value })} />
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
              <div key={g.id} className="flex items-center justify-between border border-border rounded-xl p-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{g.nome}</p>
                  <p className="text-xs text-muted-foreground">{g.vinculo} • {formatPhone(g.telefone_whatsapp)}</p>
                </div>
                <button onClick={() => deleteGuardiao(g.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
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
          <div className="space-y-2">
            {vinculos.map(v => (
              <div key={v.id} className="flex items-center justify-between border border-border rounded-xl p-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{v.agressor.nome}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="ampara-tag !py-0.5 !px-2 text-xs">{v.tipo_vinculo}</span>
                    {v.agressor.forca_seguranca && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Força seg.</span>
                    )}
                    {v.agressor.tem_arma_em_casa && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Arma</span>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteVinculo(v.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
