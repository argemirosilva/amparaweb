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
          created_at: string
          device_id: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          status?: string
          user_id?: string
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
          codigo_verificacao: string | null
          codigo_verificacao_expira: string | null
          created_at: string
          email: string
          email_verificado: boolean
          id: string
          nome_completo: string
          senha_coacao_hash: string | null
          senha_hash: string
          status: Database["public"]["Enums"]["user_status"]
          telefone: string
          termos_aceitos_em: string | null
          tipo_interesse: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          codigo_verificacao?: string | null
          codigo_verificacao_expira?: string | null
          created_at?: string
          email: string
          email_verificado?: boolean
          id?: string
          nome_completo: string
          senha_coacao_hash?: string | null
          senha_hash: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone: string
          termos_aceitos_em?: string | null
          tipo_interesse?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          codigo_verificacao?: string | null
          codigo_verificacao_expira?: string | null
          created_at?: string
          email?: string
          email_verificado?: boolean
          id?: string
          nome_completo?: string
          senha_coacao_hash?: string | null
          senha_hash?: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string
          termos_aceitos_em?: string | null
          tipo_interesse?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
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
