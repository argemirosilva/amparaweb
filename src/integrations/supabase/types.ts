export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamentos_monitoramento: {
        Row: {
          id: string
          periodos_semana: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          periodos_semana?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          periodos_semana?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_monitoramento_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agressores: {
        Row: {
          created_at: string
          data_nascimento: string | null
          forca_seguranca: boolean | null
          id: string
          nome: string
          nome_mae_parcial: string | null
          nome_pai_parcial: string | null
          telefone: string | null
          tem_arma_em_casa: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          forca_seguranca?: boolean | null
          id?: string
          nome: string
          nome_mae_parcial?: string | null
          nome_pai_parcial?: string | null
          telefone?: string | null
          tem_arma_em_casa?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          forca_seguranca?: boolean | null
          id?: string
          nome?: string
          nome_mae_parcial?: string | null
          nome_pai_parcial?: string | null
          telefone?: string | null
          tem_arma_em_casa?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      alertas_panico: {
        Row: {
          autoridades_acionadas: boolean
          cancelado_dentro_janela: boolean | null
          cancelado_em: string | null
          criado_em: string
          device_id: string | null
          guardioes_notificados: boolean
          id: string
          latitude: number | null
          longitude: number | null
          motivo_cancelamento: string | null
          protocolo: string | null
          status: string
          tempo_ate_cancelamento_segundos: number | null
          tipo_acionamento: string | null
          tipo_cancelamento: string | null
          user_id: string
          window_id: string | null
          window_selada: boolean
        }
        Insert: {
          autoridades_acionadas?: boolean
          cancelado_dentro_janela?: boolean | null
          cancelado_em?: string | null
          criado_em?: string
          device_id?: string | null
          guardioes_notificados?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_cancelamento?: string | null
          protocolo?: string | null
          status?: string
          tempo_ate_cancelamento_segundos?: number | null
          tipo_acionamento?: string | null
          tipo_cancelamento?: string | null
          user_id: string
          window_id?: string | null
          window_selada?: boolean
        }
        Update: {
          autoridades_acionadas?: boolean
          cancelado_dentro_janela?: boolean | null
          cancelado_em?: string | null
          criado_em?: string
          device_id?: string | null
          guardioes_notificados?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_cancelamento?: string | null
          protocolo?: string | null
          status?: string
          tempo_ate_cancelamento_segundos?: number | null
          tipo_acionamento?: string | null
          tipo_cancelamento?: string | null
          user_id?: string
          window_id?: string | null
          window_selada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alertas_panico_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      device_status: {
        Row: {
          bateria_percentual: number | null
          created_at: string
          device_id: string
          dispositivo_info: string | null
          id: string
          is_charging: boolean | null
          is_monitoring: boolean
          is_recording: boolean
          last_ping_at: string | null
          status: string
          timezone: string | null
          timezone_offset_minutes: number | null
          updated_at: string
          user_id: string
          versao_app: string | null
        }
        Insert: {
          bateria_percentual?: number | null
          created_at?: string
          device_id: string
          dispositivo_info?: string | null
          id?: string
          is_charging?: boolean | null
          is_monitoring?: boolean
          is_recording?: boolean
          last_ping_at?: string | null
          status?: string
          timezone?: string | null
          timezone_offset_minutes?: number | null
          updated_at?: string
          user_id: string
          versao_app?: string | null
        }
        Update: {
          bateria_percentual?: number | null
          created_at?: string
          device_id?: string
          dispositivo_info?: string | null
          id?: string
          is_charging?: boolean | null
          is_monitoring?: boolean
          is_recording?: boolean
          last_ping_at?: string | null
          status?: string
          timezone?: string | null
          timezone_offset_minutes?: number | null
          updated_at?: string
          user_id?: string
          versao_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacoes: {
        Row: {
          created_at: string
          device_id: string | null
          duracao_segundos: number | null
          erro_processamento: string | null
          file_url: string | null
          id: string
          monitor_session_id: string | null
          processado_em: string | null
          status: string
          storage_path: string | null
          tamanho_mb: number | null
          timezone: string | null
          timezone_offset_minutes: number | null
          transcricao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          duracao_segundos?: number | null
          erro_processamento?: string | null
          file_url?: string | null
          id?: string
          monitor_session_id?: string | null
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          tamanho_mb?: number | null
          timezone?: string | null
          timezone_offset_minutes?: number | null
          transcricao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          duracao_segundos?: number | null
          erro_processamento?: string | null
          file_url?: string | null
          id?: string
          monitor_session_id?: string | null
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          tamanho_mb?: number | null
          timezone?: string | null
          timezone_offset_minutes?: number | null
          transcricao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gravacoes_monitor_session_id_fkey"
            columns: ["monitor_session_id"]
            isOneToOne: false
            referencedRelation: "monitoramento_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gravacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacoes_analises: {
        Row: {
          analise_completa: Json | null
          categorias: string[] | null
          created_at: string
          gravacao_id: string
          id: string
          modelo_usado: string | null
          nivel_risco: string | null
          palavras_chave: string[] | null
          resumo: string | null
          sentimento: string | null
          user_id: string
        }
        Insert: {
          analise_completa?: Json | null
          categorias?: string[] | null
          created_at?: string
          gravacao_id: string
          id?: string
          modelo_usado?: string | null
          nivel_risco?: string | null
          palavras_chave?: string[] | null
          resumo?: string | null
          sentimento?: string | null
          user_id: string
        }
        Update: {
          analise_completa?: Json | null
          categorias?: string[] | null
          created_at?: string
          gravacao_id?: string
          id?: string
          modelo_usado?: string | null
          nivel_risco?: string | null
          palavras_chave?: string[] | null
          resumo?: string | null
          sentimento?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gravacoes_analises_gravacao_id_fkey"
            columns: ["gravacao_id"]
            isOneToOne: false
            referencedRelation: "gravacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gravacoes_analises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacoes_segmentos: {
        Row: {
          created_at: string
          device_id: string | null
          duracao_segundos: number | null
          file_url: string | null
          id: string
          monitor_session_id: string | null
          received_at: string
          segmento_idx: number | null
          storage_path: string | null
          tamanho_mb: number | null
          timezone: string | null
          timezone_offset_minutes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          duracao_segundos?: number | null
          file_url?: string | null
          id?: string
          monitor_session_id?: string | null
          received_at?: string
          segmento_idx?: number | null
          storage_path?: string | null
          tamanho_mb?: number | null
          timezone?: string | null
          timezone_offset_minutes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          duracao_segundos?: number | null
          file_url?: string | null
          id?: string
          monitor_session_id?: string | null
          received_at?: string
          segmento_idx?: number | null
          storage_path?: string | null
          tamanho_mb?: number | null
          timezone?: string | null
          timezone_offset_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gravacoes_segmentos_monitor_session_id_fkey"
            columns: ["monitor_session_id"]
            isOneToOne: false
            referencedRelation: "monitoramento_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gravacoes_segmentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      guardioes: {
        Row: {
          created_at: string
          id: string
          nome: string
          telefone_whatsapp: string
          updated_at: string
          usuario_id: string
          vinculo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          telefone_whatsapp: string
          updated_at?: string
          usuario_id: string
          vinculo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          telefone_whatsapp?: string
          updated_at?: string
          usuario_id?: string
          vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardioes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      localizacoes: {
        Row: {
          alerta_id: string | null
          bateria_percentual: number | null
          created_at: string
          device_id: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          precisao_metros: number | null
          speed: number | null
          timestamp_gps: string | null
          user_id: string
        }
        Insert: {
          alerta_id?: string | null
          bateria_percentual?: number | null
          created_at?: string
          device_id?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          precisao_metros?: number | null
          speed?: number | null
          timestamp_gps?: string | null
          user_id: string
        }
        Update: {
          alerta_id?: string | null
          bateria_percentual?: number | null
          created_at?: string
          device_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          precisao_metros?: number | null
          speed?: number | null
          timestamp_gps?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "localizacoes_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas_panico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "localizacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramento_sessoes: {
        Row: {
          closed_at: string | null
          created_at: string
          device_id: string | null
          final_gravacao_id: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          origem: string | null
          sealed_reason: string | null
          status: string
          total_duration_seconds: number
          total_segments: number
          user_id: string
          window_end_at: string | null
          window_start_at: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          device_id?: string | null
          final_gravacao_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          origem?: string | null
          sealed_reason?: string | null
          status?: string
          total_duration_seconds?: number
          total_segments?: number
          user_id: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          device_id?: string | null
          final_gravacao_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          origem?: string | null
          sealed_reason?: string | null
          status?: string
          total_duration_seconds?: number
          total_segments?: number
          user_id?: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoramento_sessoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_attempts: {
        Row: {
          action_type: string
          attempted_at: string
          id: string
          identifier: string
        }
        Insert: {
          action_type: string
          attempted_at?: string
          id?: string
          identifier: string
        }
        Update: {
          action_type?: string
          attempted_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          replaced_by: string | null
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          replaced_by?: string | null
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          replaced_by?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "refresh_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          computed_at: string
          fatores: Json | null
          id: string
          period_end: string
          period_start: string
          resumo_tecnico: string | null
          risk_level: string
          risk_score: number
          trend: string
          trend_percentage: number | null
          usuario_id: string
          window_days: number
        }
        Insert: {
          computed_at?: string
          fatores?: Json | null
          id?: string
          period_end: string
          period_start: string
          resumo_tecnico?: string | null
          risk_level: string
          risk_score: number
          trend: string
          trend_percentage?: number | null
          usuario_id: string
          window_days: number
        }
        Update: {
          computed_at?: string
          fatores?: Json | null
          id?: string
          period_end?: string
          period_start?: string
          resumo_tecnico?: string | null
          risk_level?: string
          risk_score?: number
          trend?: string
          trend_percentage?: number | null
          usuario_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          avatar_url: string | null
          codigo_verificacao: string | null
          codigo_verificacao_expira: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          email_verificado: boolean
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_fixo: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_referencia: string | null
          endereco_uf: string | null
          id: string
          mora_com_agressor: boolean | null
          nome_completo: string
          onboarding_completo: boolean | null
          retencao_dias_sem_risco: number
          senha_coacao_hash: string | null
          senha_hash: string
          status: Database["public"]["Enums"]["user_status"]
          telefone: string
          tem_filhos: boolean | null
          termos_aceitos_em: string | null
          tipo_interesse: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          codigo_verificacao?: string | null
          codigo_verificacao_expira?: string | null
          created_at?: string
          data_nascimento?: string | null
          email: string
          email_verificado?: boolean
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_fixo?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_referencia?: string | null
          endereco_uf?: string | null
          id?: string
          mora_com_agressor?: boolean | null
          nome_completo: string
          onboarding_completo?: boolean | null
          retencao_dias_sem_risco?: number
          senha_coacao_hash?: string | null
          senha_hash: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone: string
          tem_filhos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_interesse?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          codigo_verificacao?: string | null
          codigo_verificacao_expira?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          email_verificado?: boolean
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_fixo?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_referencia?: string | null
          endereco_uf?: string | null
          id?: string
          mora_com_agressor?: boolean | null
          nome_completo?: string
          onboarding_completo?: boolean | null
          retencao_dias_sem_risco?: number
          senha_coacao_hash?: string | null
          senha_hash?: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string
          tem_filhos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_interesse?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vitimas_agressores: {
        Row: {
          agressor_id: string
          created_at: string
          id: string
          status_relacao: string | null
          tipo_vinculo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          agressor_id: string
          created_at?: string
          id?: string
          status_relacao?: string | null
          tipo_vinculo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          agressor_id?: string
          created_at?: string
          id?: string
          status_relacao?: string | null
          tipo_vinculo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitimas_agressores_agressor_id_fkey"
            columns: ["agressor_id"]
            isOneToOne: false
            referencedRelation: "agressores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitimas_agressores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_status: "pendente" | "ativo" | "inativo" | "bloqueado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_status: ["pendente", "ativo", "inativo", "bloqueado"],
    },
  },
} as const
