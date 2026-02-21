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
      admin_settings: {
        Row: {
          categoria: string
          chave: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          categoria?: string
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          categoria?: string
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
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
      aggressor_incidents: {
        Row: {
          aggressor_id: string
          confidence: number | null
          created_at: string
          description_sanitized: string | null
          id: string
          occurred_at_month: string | null
          pattern_tags: string[] | null
          reporter_user_id: string
          severity: number | null
          source_type: string | null
          violence_types: string[] | null
        }
        Insert: {
          aggressor_id: string
          confidence?: number | null
          created_at?: string
          description_sanitized?: string | null
          id?: string
          occurred_at_month?: string | null
          pattern_tags?: string[] | null
          reporter_user_id: string
          severity?: number | null
          source_type?: string | null
          violence_types?: string[] | null
        }
        Update: {
          aggressor_id?: string
          confidence?: number | null
          created_at?: string
          description_sanitized?: string | null
          id?: string
          occurred_at_month?: string | null
          pattern_tags?: string[] | null
          reporter_user_id?: string
          severity?: number | null
          source_type?: string | null
          violence_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "aggressor_incidents_aggressor_id_fkey"
            columns: ["aggressor_id"]
            isOneToOne: false
            referencedRelation: "agressores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggressor_incidents_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agressores: {
        Row: {
          aliases: string[] | null
          appearance_notes: string | null
          appearance_tags: string[] | null
          approx_age_max: number | null
          approx_age_min: number | null
          company_public: string | null
          cor_raca: string | null
          created_at: string
          data_nascimento: string | null
          display_name_masked: string | null
          email_clues: Json | null
          escolaridade: string | null
          father_first_name: string | null
          father_name_partial_normalized: string | null
          flags: string[] | null
          forca_seguranca: boolean | null
          geo_area_tags: string[] | null
          id: string
          last_incident_at: string | null
          mother_first_name: string | null
          mother_name_partial_normalized: string | null
          name_normalized: string | null
          neighborhoods: string[] | null
          nome: string
          nome_mae_parcial: string | null
          nome_pai_parcial: string | null
          phone_clues: Json | null
          primary_city_uf: string | null
          profession: string | null
          quality_score: number | null
          reference_points: string[] | null
          risk_level: string | null
          risk_score: number | null
          search_tokens: string[] | null
          sector: string | null
          telefone: string | null
          tem_arma_em_casa: boolean | null
          updated_at: string
          vehicles: Json | null
          violence_profile_probs: Json | null
        }
        Insert: {
          aliases?: string[] | null
          appearance_notes?: string | null
          appearance_tags?: string[] | null
          approx_age_max?: number | null
          approx_age_min?: number | null
          company_public?: string | null
          cor_raca?: string | null
          created_at?: string
          data_nascimento?: string | null
          display_name_masked?: string | null
          email_clues?: Json | null
          escolaridade?: string | null
          father_first_name?: string | null
          father_name_partial_normalized?: string | null
          flags?: string[] | null
          forca_seguranca?: boolean | null
          geo_area_tags?: string[] | null
          id?: string
          last_incident_at?: string | null
          mother_first_name?: string | null
          mother_name_partial_normalized?: string | null
          name_normalized?: string | null
          neighborhoods?: string[] | null
          nome: string
          nome_mae_parcial?: string | null
          nome_pai_parcial?: string | null
          phone_clues?: Json | null
          primary_city_uf?: string | null
          profession?: string | null
          quality_score?: number | null
          reference_points?: string[] | null
          risk_level?: string | null
          risk_score?: number | null
          search_tokens?: string[] | null
          sector?: string | null
          telefone?: string | null
          tem_arma_em_casa?: boolean | null
          updated_at?: string
          vehicles?: Json | null
          violence_profile_probs?: Json | null
        }
        Update: {
          aliases?: string[] | null
          appearance_notes?: string | null
          appearance_tags?: string[] | null
          approx_age_max?: number | null
          approx_age_min?: number | null
          company_public?: string | null
          cor_raca?: string | null
          created_at?: string
          data_nascimento?: string | null
          display_name_masked?: string | null
          email_clues?: Json | null
          escolaridade?: string | null
          father_first_name?: string | null
          father_name_partial_normalized?: string | null
          flags?: string[] | null
          forca_seguranca?: boolean | null
          geo_area_tags?: string[] | null
          id?: string
          last_incident_at?: string | null
          mother_first_name?: string | null
          mother_name_partial_normalized?: string | null
          name_normalized?: string | null
          neighborhoods?: string[] | null
          nome?: string
          nome_mae_parcial?: string | null
          nome_pai_parcial?: string | null
          phone_clues?: Json | null
          primary_city_uf?: string | null
          profession?: string | null
          quality_score?: number | null
          reference_points?: string[] | null
          risk_level?: string | null
          risk_score?: number | null
          search_tokens?: string[] | null
          sector?: string | null
          telefone?: string | null
          tem_arma_em_casa?: boolean | null
          updated_at?: string
          vehicles?: Json | null
          violence_profile_probs?: Json | null
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
      audio_generation_items: {
        Row: {
          created_at: string
          duration_sec: number | null
          gravacao_id: string | null
          id: string
          item_index: number
          job_id: string
          last_error: string | null
          script: Json | null
          status: string
          storage_url: string | null
          topic: string | null
          tries: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          gravacao_id?: string | null
          id?: string
          item_index: number
          job_id: string
          last_error?: string | null
          script?: Json | null
          status?: string
          storage_url?: string | null
          topic?: string | null
          tries?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          gravacao_id?: string | null
          id?: string
          item_index?: number
          job_id?: string
          last_error?: string | null
          script?: Json | null
          status?: string
          storage_url?: string | null
          topic?: string | null
          tries?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_generation_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_generation_jobs: {
        Row: {
          created_at: string
          created_by: string
          done_count: number
          failed_count: number
          id: string
          logs: Json | null
          settings: Json | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          done_count?: number
          failed_count?: number
          id?: string
          logs?: Json | null
          settings?: Json | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          done_count?: number
          failed_count?: number
          id?: string
          logs?: Json | null
          settings?: Json | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
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
      compartilhamento_gps: {
        Row: {
          alerta_id: string | null
          ativo: boolean
          codigo: string
          criado_em: string
          expira_em: string
          id: string
          tipo: string
          user_id: string
        }
        Insert: {
          alerta_id?: string | null
          ativo?: boolean
          codigo: string
          criado_em?: string
          expira_em: string
          id?: string
          tipo?: string
          user_id: string
        }
        Update: {
          alerta_id?: string | null
          ativo?: boolean
          codigo?: string
          criado_em?: string
          expira_em?: string
          id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compartilhamento_gps_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas_panico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compartilhamento_gps_user_id_fkey"
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
      support_access_grants: {
        Row: {
          active: boolean
          expires_at: string
          granted_at: string
          id: string
          request_id: string
          revoked_at: string | null
          revoked_by: Database["public"]["Enums"]["support_revoked_by"] | null
        }
        Insert: {
          active?: boolean
          expires_at?: string
          granted_at?: string
          id?: string
          request_id: string
          revoked_at?: string | null
          revoked_by?: Database["public"]["Enums"]["support_revoked_by"] | null
        }
        Update: {
          active?: boolean
          expires_at?: string
          granted_at?: string
          id?: string
          request_id?: string
          revoked_at?: string | null
          revoked_by?: Database["public"]["Enums"]["support_revoked_by"] | null
        }
        Relationships: [
          {
            foreignKeyName: "support_access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access_requests: {
        Row: {
          agent_id: string
          attempts: number
          code_expires_at: string
          code_hash: string
          created_at: string
          id: string
          justification_text: string
          requested_scope: Database["public"]["Enums"]["support_access_scope"]
          resource_id: string
          resource_type: Database["public"]["Enums"]["support_resource_type"]
          session_id: string
          status: Database["public"]["Enums"]["support_access_status"]
          user_id: string
        }
        Insert: {
          agent_id: string
          attempts?: number
          code_expires_at: string
          code_hash: string
          created_at?: string
          id?: string
          justification_text: string
          requested_scope: Database["public"]["Enums"]["support_access_scope"]
          resource_id: string
          resource_type: Database["public"]["Enums"]["support_resource_type"]
          session_id: string
          status?: Database["public"]["Enums"]["support_access_status"]
          user_id: string
        }
        Update: {
          agent_id?: string
          attempts?: number
          code_expires_at?: string
          code_hash?: string
          created_at?: string
          id?: string
          justification_text?: string
          requested_scope?: Database["public"]["Enums"]["support_access_scope"]
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["support_resource_type"]
          session_id?: string
          status?: Database["public"]["Enums"]["support_access_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_access_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      support_agent_reauth_log: {
        Row: {
          agent_id: string
          id: string
          method: string
          mfa_used: boolean
          reauth_at: string
          success: boolean
        }
        Insert: {
          agent_id: string
          id?: string
          method?: string
          mfa_used?: boolean
          reauth_at?: string
          success?: boolean
        }
        Update: {
          agent_id?: string
          id?: string
          method?: string
          mfa_used?: boolean
          reauth_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "support_agent_reauth_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      support_audit_timeline: {
        Row: {
          created_at: string
          description: string
          event_type: Database["public"]["Enums"]["support_audit_event"]
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          event_type: Database["public"]["Enums"]["support_audit_event"]
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: Database["public"]["Enums"]["support_audit_event"]
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_audit_timeline_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_audit_timeline_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      support_data_access_log: {
        Row: {
          action: string
          agent_device: string | null
          agent_id: string
          agent_ip: string | null
          created_at: string
          grant_id: string
          id: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["support_resource_type"]
          session_id: string
          user_id: string
        }
        Insert: {
          action: string
          agent_device?: string | null
          agent_id: string
          agent_ip?: string | null
          created_at?: string
          grant_id: string
          id?: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["support_resource_type"]
          session_id: string
          user_id: string
        }
        Update: {
          action?: string
          agent_device?: string | null
          agent_id?: string
          agent_ip?: string | null
          created_at?: string
          grant_id?: string
          id?: string
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["support_resource_type"]
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_data_access_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_data_access_log_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "support_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_data_access_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_data_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message_text: string
          redacted: boolean
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_text: string
          redacted?: boolean
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_text?: string
          redacted?: boolean
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["support_sender_type"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          agent_id: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          sensitivity_level: string
          status: Database["public"]["Enums"]["support_session_status"]
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          sensitivity_level?: string
          status?: Database["public"]["Enums"]["support_session_status"]
          user_id: string
        }
        Update: {
          agent_id?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          sensitivity_level?: string
          status?: Database["public"]["Enums"]["support_session_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          created_at: string
          email_contato: string | null
          endereco: string | null
          id: string
          max_usuarios: number
          nome: string
          responsavel_email: string | null
          responsavel_nome: string | null
          sigla: string
          telefone_contato: string | null
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          max_usuarios?: number
          nome: string
          responsavel_email?: string | null
          responsavel_nome?: string | null
          sigla: string
          telefone_contato?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          max_usuarios?: number
          nome?: string
          responsavel_email?: string | null
          responsavel_nome?: string | null
          sigla?: string
          telefone_contato?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["admin_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
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
          avatar_url: string | null
          codigo_verificacao: string | null
          codigo_verificacao_expira: string | null
          compartilhar_gps_panico: boolean
          compartilhar_gps_risco_alto: boolean
          configuracao_alertas: Json
          cor_raca: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          email_verificado: boolean
          emotional_avatars: Json | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_fixo: string | null
          endereco_lat: number | null
          endereco_logradouro: string | null
          endereco_lon: number | null
          endereco_numero: string | null
          endereco_referencia: string | null
          endereco_uf: string | null
          escolaridade: string | null
          gps_duracao_minutos: number
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
          compartilhar_gps_panico?: boolean
          compartilhar_gps_risco_alto?: boolean
          configuracao_alertas?: Json
          cor_raca?: string | null
          created_at?: string
          data_nascimento?: string | null
          email: string
          email_verificado?: boolean
          emotional_avatars?: Json | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_fixo?: string | null
          endereco_lat?: number | null
          endereco_logradouro?: string | null
          endereco_lon?: number | null
          endereco_numero?: string | null
          endereco_referencia?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          gps_duracao_minutos?: number
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
          compartilhar_gps_panico?: boolean
          compartilhar_gps_risco_alto?: boolean
          configuracao_alertas?: Json
          cor_raca?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          email_verificado?: boolean
          emotional_avatars?: Json | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_fixo?: string | null
          endereco_lat?: number | null
          endereco_logradouro?: string | null
          endereco_lon?: number | null
          endereco_numero?: string | null
          endereco_referencia?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          gps_duracao_minutos?: number
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
      has_admin_role: {
        Args: {
          p_role: Database["public"]["Enums"]["admin_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      normalize_text: { Args: { input: string }; Returns: string }
      search_agressor_candidates: {
        Args: {
          p_age_approx?: number
          p_alias?: string
          p_city_uf?: string
          p_ddd?: string
          p_father_first?: string
          p_mother_first?: string
          p_name?: string
          p_neighborhood?: string
          p_phone_last_digits?: string
          p_plate_prefix?: string
          p_profession?: string
        }
        Returns: {
          aliases: string[]
          appearance_tags: string[]
          approx_age_max: number
          approx_age_min: number
          data_nascimento: string
          display_name_masked: string
          father_first_name: string
          father_name_partial_normalized: string
          flags: string[]
          forca_seguranca: boolean
          id: string
          last_incident_at: string
          mother_first_name: string
          mother_name_partial_normalized: string
          name_normalized: string
          name_similarity: number
          neighborhoods: string[]
          nome: string
          phone_clues: Json
          primary_city_uf: string
          profession: string
          quality_score: number
          reference_points: string[]
          risk_level: string
          risk_score: number
          sector: string
          tem_arma_em_casa: boolean
          total_vinculos: number
          vehicles: Json
          violence_profile_probs: Json
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      admin_role: "admin_master" | "admin_tenant" | "operador"
      support_access_scope:
        | "read_metadata"
        | "read_transcription"
        | "read_audio_stream"
        | "read_analysis"
        | "read_logs"
      support_access_status:
        | "pending"
        | "granted"
        | "denied"
        | "expired"
        | "blocked"
      support_audit_event:
        | "session_created"
        | "agent_assigned"
        | "access_requested"
        | "code_shown"
        | "access_granted"
        | "data_accessed"
        | "access_revoked"
        | "access_expired"
        | "session_closed"
        | "password_reset_initiated"
      support_category:
        | "app_issue"
        | "playback"
        | "upload"
        | "gps"
        | "notifications"
        | "account"
        | "recording_question"
        | "transcription_question"
        | "analysis_question"
        | "other"
      support_resource_type:
        | "recording"
        | "transcription"
        | "analysis"
        | "metadata"
        | "logs"
      support_revoked_by: "system" | "user" | "agent"
      support_sender_type: "user" | "agent" | "system"
      support_session_status:
        | "open"
        | "waiting_user"
        | "waiting_consent"
        | "active"
        | "closed"
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
      admin_role: ["admin_master", "admin_tenant", "operador"],
      support_access_scope: [
        "read_metadata",
        "read_transcription",
        "read_audio_stream",
        "read_analysis",
        "read_logs",
      ],
      support_access_status: [
        "pending",
        "granted",
        "denied",
        "expired",
        "blocked",
      ],
      support_audit_event: [
        "session_created",
        "agent_assigned",
        "access_requested",
        "code_shown",
        "access_granted",
        "data_accessed",
        "access_revoked",
        "access_expired",
        "session_closed",
        "password_reset_initiated",
      ],
      support_category: [
        "app_issue",
        "playback",
        "upload",
        "gps",
        "notifications",
        "account",
        "recording_question",
        "transcription_question",
        "analysis_question",
        "other",
      ],
      support_resource_type: [
        "recording",
        "transcription",
        "analysis",
        "metadata",
        "logs",
      ],
      support_revoked_by: ["system", "user", "agent"],
      support_sender_type: ["user", "agent", "system"],
      support_session_status: [
        "open",
        "waiting_user",
        "waiting_consent",
        "active",
        "closed",
      ],
      user_status: ["pendente", "ativo", "inativo", "bloqueado"],
    },
  },
} as const
