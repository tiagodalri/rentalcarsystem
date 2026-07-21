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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          duration_ms: number | null
          event_name: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json | null
          os: string | null
          path: string | null
          referrer: string | null
          region: string | null
          session_id: string | null
          target_id: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_name?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          os?: string | null
          path?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          target_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_name?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          os?: string | null
          path?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          target_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          addons: Json | null
          booking_number: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clicksign_document_key: string | null
          clicksign_envelope_id: string | null
          contract_error: string | null
          contract_sent_at: string | null
          contract_signed_at: string | null
          contract_signed_pdf_url: string | null
          contract_status: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number | null
          deposit_refund_days: number | null
          deposit_refund_deadline_days: number | null
          driver_age: number | null
          extra_driver: boolean | null
          franchise_amount: number | null
          hold_expires_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          pickup_date: string
          pickup_location: string | null
          pickup_time: string | null
          plan_id: string | null
          return_date: string
          return_location: string | null
          return_time: string | null
          status: string
          stripe_session_id: string | null
          total_price: number | null
          turo_reservation_code: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          addons?: Json | null
          booking_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clicksign_document_key?: string | null
          clicksign_envelope_id?: string | null
          contract_error?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contract_signed_pdf_url?: string | null
          contract_status?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_refund_days?: number | null
          deposit_refund_deadline_days?: number | null
          driver_age?: number | null
          extra_driver?: boolean | null
          franchise_amount?: number | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_date: string
          pickup_location?: string | null
          pickup_time?: string | null
          plan_id?: string | null
          return_date: string
          return_location?: string | null
          return_time?: string | null
          status?: string
          stripe_session_id?: string | null
          total_price?: number | null
          turo_reservation_code?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          addons?: Json | null
          booking_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clicksign_document_key?: string | null
          clicksign_envelope_id?: string | null
          contract_error?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contract_signed_pdf_url?: string | null
          contract_status?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_refund_days?: number | null
          deposit_refund_deadline_days?: number | null
          driver_age?: number | null
          extra_driver?: boolean | null
          franchise_amount?: number | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_date?: string
          pickup_location?: string | null
          pickup_time?: string | null
          plan_id?: string | null
          return_date?: string
          return_location?: string | null
          return_time?: string | null
          status?: string
          stripe_session_id?: string | null
          total_price?: number | null
          turo_reservation_code?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bouncie_backfill_progress: {
        Row: {
          created_at: string
          empty_streak: number
          imei: string
          last_error: string | null
          last_run: string | null
          newest_week_done: string | null
          oldest_week_done: string | null
          stage: string
          status: string
          trips_imported: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          empty_streak?: number
          imei: string
          last_error?: string | null
          last_run?: string | null
          newest_week_done?: string | null
          oldest_week_done?: string | null
          stage?: string
          status?: string
          trips_imported?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          empty_streak?: number
          imei?: string
          last_error?: string | null
          last_run?: string | null
          newest_week_done?: string | null
          oldest_week_done?: string | null
          stage?: string
          status?: string
          trips_imported?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bouncie_backfill_progress_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bouncie_backfill_progress_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bouncie_integration: {
        Row: {
          access_token: string | null
          authorization_code: string | null
          client_id: string | null
          connected_at: string | null
          id: number
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          authorization_code?: string | null
          client_id?: string | null
          connected_at?: string | null
          id?: number
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          authorization_code?: string | null
          client_id?: string | null
          connected_at?: string | null
          id?: number
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_presence: {
        Row: {
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          clauses: Json
          company_address: string
          company_ein: string
          company_name: string
          created_at: string
          disclaimer: string
          footer_text: string
          header_subtitle: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clauses?: Json
          company_address?: string
          company_ein?: string
          company_name?: string
          created_at?: string
          disclaimer?: string
          footer_text?: string
          header_subtitle?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clauses?: Json
          company_address?: string
          company_ein?: string
          company_name?: string
          created_at?: string
          disclaimer?: string
          footer_text?: string
          header_subtitle?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      conversation_assignment_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          conversation_id: string
          id: string
          new_assigned_to: string | null
          previous_assigned_to: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          conversation_id: string
          id?: string
          new_assigned_to?: string | null
          previous_assigned_to?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          conversation_id?: string
          id?: string
          new_assigned_to?: string | null
          previous_assigned_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignment_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          added_at: string
          conversation_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          conversation_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          conversation_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          complement: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          document_number: string | null
          driver_license: string | null
          driver_license_expiry: string | null
          driver_license_file_url: string | null
          driver_license_verified_at: string | null
          driver_license_verified_by: string | null
          email: string | null
          full_name: string
          house_number: string | null
          id: string
          nationality: string | null
          notes: string | null
          phone: string | null
          preferred_language: string
          source: string
          turo_guest_id: string | null
          updated_at: string
          user_id: string | null
          welcome_sent: boolean
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          complement?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string | null
          driver_license?: string | null
          driver_license_expiry?: string | null
          driver_license_file_url?: string | null
          driver_license_verified_at?: string | null
          driver_license_verified_by?: string | null
          email?: string | null
          full_name: string
          house_number?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string
          source?: string
          turo_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
          welcome_sent?: boolean
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          complement?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string | null
          driver_license?: string | null
          driver_license_expiry?: string | null
          driver_license_file_url?: string | null
          driver_license_verified_at?: string | null
          driver_license_verified_by?: string | null
          email?: string | null
          full_name?: string
          house_number?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string
          source?: string
          turo_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
          welcome_sent?: boolean
          zip_code?: string | null
        }
        Relationships: []
      }
      demo_presentation_state: {
        Row: {
          hidden_booking_ids: string[]
          hidden_txn_ids: string[] | null
          hidden_vehicle_ids: string[]
          id: number
          started_at: string
          started_by: string | null
          target_count: number
          telemetry_snapshot: Json | null
        }
        Insert: {
          hidden_booking_ids?: string[]
          hidden_txn_ids?: string[] | null
          hidden_vehicle_ids?: string[]
          id?: number
          started_at?: string
          started_by?: string | null
          target_count: number
          telemetry_snapshot?: Json | null
        }
        Update: {
          hidden_booking_ids?: string[]
          hidden_txn_ids?: string[] | null
          hidden_vehicle_ids?: string[]
          id?: number
          started_at?: string
          started_by?: string | null
          target_count?: number
          telemetry_snapshot?: Json | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json | null
          recipient_email: string
          status?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      epass_account_activity: {
        Row: {
          account_number: string | null
          activity_date: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          import_id: string
          location: string | null
        }
        Insert: {
          account_number?: string | null
          activity_date?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          import_id: string
          location?: string | null
        }
        Update: {
          account_number?: string | null
          activity_date?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          import_id?: string
          location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epass_account_activity_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "epass_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      epass_imports: {
        Row: {
          account_number: string | null
          created_at: string
          filename: string
          id: string
          imported_by: string | null
          matched_rows: number
          period_label: string | null
          total_amount: number
          total_rows: number
          unmatched_booking_rows: number
          unmatched_vehicle_rows: number
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          filename: string
          id?: string
          imported_by?: string | null
          matched_rows?: number
          period_label?: string | null
          total_amount?: number
          total_rows?: number
          unmatched_booking_rows?: number
          unmatched_vehicle_rows?: number
        }
        Update: {
          account_number?: string | null
          created_at?: string
          filename?: string
          id?: string
          imported_by?: string | null
          matched_rows?: number
          period_label?: string | null
          total_amount?: number
          total_rows?: number
          unmatched_booking_rows?: number
          unmatched_vehicle_rows?: number
        }
        Relationships: []
      }
      epass_tolls: {
        Row: {
          amount: number
          booking_id: string | null
          charged_at: string | null
          charged_to_customer: boolean
          created_at: string
          customer_id: string | null
          dedupe_hash: string
          id: string
          import_id: string
          location: string | null
          posting_date: string | null
          status: Database["public"]["Enums"]["epass_toll_status"]
          toll_datetime: string
          toll_type: string | null
          transponder_number: string
          vehicle_id: string | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          charged_at?: string | null
          charged_to_customer?: boolean
          created_at?: string
          customer_id?: string | null
          dedupe_hash: string
          id?: string
          import_id: string
          location?: string | null
          posting_date?: string | null
          status?: Database["public"]["Enums"]["epass_toll_status"]
          toll_datetime: string
          toll_type?: string | null
          transponder_number: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          charged_at?: string | null
          charged_to_customer?: boolean
          created_at?: string
          customer_id?: string | null
          dedupe_hash?: string
          id?: string
          import_id?: string
          location?: string | null
          posting_date?: string | null
          status?: Database["public"]["Enums"]["epass_toll_status"]
          toll_datetime?: string
          toll_type?: string | null
          transponder_number?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epass_tolls_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epass_tolls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epass_tolls_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "epass_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epass_tolls_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epass_tolls_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          booking_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          id: string
          is_cancelled: boolean
          notes: string | null
          source: string
          transaction_date: string
          type: string
          vehicle_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          booking_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          id?: string
          is_cancelled?: boolean
          notes?: string | null
          source?: string
          transaction_date?: string
          type: string
          vehicle_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          booking_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          id?: string
          is_cancelled?: boolean
          notes?: string | null
          source?: string
          transaction_date?: string
          type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      job_titles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount_usd: number | null
          booking_id: string | null
          checkout_url: string | null
          cr_code: string | null
          cr_id: number | null
          cr_token: string | null
          created_at: string
          id: string
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_usd?: number | null
          booking_id?: string | null
          checkout_url?: string | null
          cr_code?: string | null
          cr_id?: number | null
          cr_token?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_usd?: number | null
          booking_id?: string | null
          checkout_url?: string | null
          cr_code?: string | null
          cr_id?: number | null
          cr_token?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_inspection_links: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          inspection_type: string
          label: string | null
          last_viewed_at: string | null
          revoked: boolean
          token: string
          view_count: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          inspection_type: string
          label?: string | null
          last_viewed_at?: string | null
          revoked?: boolean
          token: string
          view_count?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          inspection_type?: string
          label?: string | null
          last_viewed_at?: string | null
          revoked?: boolean
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_inspection_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      public_track_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          label: string | null
          last_viewed_at: string | null
          revoked: boolean
          token: string
          vehicle_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          last_viewed_at?: string | null
          revoked?: boolean
          token: string
          vehicle_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          last_viewed_at?: string | null
          revoked?: boolean
          token?: string
          vehicle_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_track_links_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_track_links_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          media_mimetype: string | null
          media_url: string | null
          message_type: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          media_mimetype?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          media_mimetype?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title_id: string | null
          last_login_at: string | null
          notes: string | null
          permissions: Json | null
          phone: string | null
          position: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          last_login_at?: string | null
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          last_login_at?: string | null
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          created_at: string
          id: string
          imei: string | null
          lat: number | null
          lng: number | null
          occurred_at: string
          raw: Json | null
          speed_mph: number | null
          trip_id: string | null
          type: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imei?: string | null
          lat?: number | null
          lng?: number | null
          occurred_at: string
          raw?: Json | null
          speed_mph?: number | null
          trip_id?: string | null
          type: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imei?: string | null
          lat?: number | null
          lng?: number | null
          occurred_at?: string
          raw?: Json | null
          speed_mph?: number | null
          trip_id?: string | null
          type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vehicle_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      turo_vehicle_mapping: {
        Row: {
          created_at: string
          created_by: string | null
          turo_vehicle_name: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          turo_vehicle_name: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          turo_vehicle_name?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turo_vehicle_mapping_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turo_vehicle_mapping_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_diagnostics: {
        Row: {
          battery_voltage: number | null
          created_at: string
          dtc_codes: string[] | null
          fuel_level_pct: number | null
          id: string
          imei: string | null
          mil_on: boolean | null
          odometer_mi: number | null
          raw: Json | null
          recorded_at: string
          vehicle_id: string | null
        }
        Insert: {
          battery_voltage?: number | null
          created_at?: string
          dtc_codes?: string[] | null
          fuel_level_pct?: number | null
          id?: string
          imei?: string | null
          mil_on?: boolean | null
          odometer_mi?: number | null
          raw?: Json | null
          recorded_at?: string
          vehicle_id?: string | null
        }
        Update: {
          battery_voltage?: number | null
          created_at?: string
          dtc_codes?: string[] | null
          fuel_level_pct?: number | null
          id?: string
          imei?: string | null
          mil_on?: boolean | null
          odometer_mi?: number | null
          raw?: Json | null
          recorded_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_diagnostics_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_diagnostics_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string | null
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          imei: string | null
          lat: number | null
          lng: number | null
          occurred_at: string
          payload: Json | null
          severity: string | null
          speed_mph: number | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          imei?: string | null
          lat?: number | null
          lng?: number | null
          occurred_at: string
          payload?: Json | null
          severity?: string | null
          speed_mph?: number | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          imei?: string | null
          lat?: number | null
          lng?: number | null
          occurred_at?: string
          payload?: Json | null
          severity?: string | null
          speed_mph?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          ai_data: Json | null
          amount: number
          booking_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          source: string
          status: string
          supplier: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          ai_data?: Json | null
          amount?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          source?: string
          status?: string
          supplier?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          ai_data?: Json | null
          amount?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          source?: string
          status?: string
          supplier?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_incidents: {
        Row: {
          actual_cost: number | null
          booking_id: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          incident_date: string
          linked_to_vehicle: boolean
          photos: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          type: Database["public"]["Enums"]["incident_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_cost?: number | null
          booking_id?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          incident_date?: string
          linked_to_vehicle?: boolean
          photos?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_cost?: number | null
          booking_id?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          incident_date?: string
          linked_to_vehicle?: boolean
          photos?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          accessories_check: Json | null
          agent_name: string | null
          agent_signature: string | null
          booking_id: string
          completed_at: string | null
          created_at: string
          customer_signature: string | null
          damages: Json | null
          exterior_photos: Json | null
          fuel_level: string | null
          id: string
          location_address: string | null
          notes: string | null
          odometer_reading: number | null
          type: string
          updated_at: string
        }
        Insert: {
          accessories_check?: Json | null
          agent_name?: string | null
          agent_signature?: string | null
          booking_id: string
          completed_at?: string | null
          created_at?: string
          customer_signature?: string | null
          damages?: Json | null
          exterior_photos?: Json | null
          fuel_level?: string | null
          id?: string
          location_address?: string | null
          notes?: string | null
          odometer_reading?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          accessories_check?: Json | null
          agent_name?: string | null
          agent_signature?: string | null
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          customer_signature?: string | null
          damages?: Json | null
          exterior_photos?: Json | null
          fuel_level?: string | null
          id?: string
          location_address?: string | null
          notes?: string | null
          odometer_reading?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_price_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          price_usd: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          price_usd: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          price_usd?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_price_overrides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_price_overrides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_price_seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          price_usd: number
          priority: number
          start_date: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          price_usd: number
          priority?: number
          start_date: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          price_usd?: number
          priority?: number
          start_date?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_price_seasons_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_price_seasons_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_pricing_rules: {
        Row: {
          min_nights: number
          monthly_discount_pct: number
          updated_at: string
          vehicle_id: string
          weekend_days: number[]
          weekend_multiplier: number
          weekly_discount_pct: number
        }
        Insert: {
          min_nights?: number
          monthly_discount_pct?: number
          updated_at?: string
          vehicle_id: string
          weekend_days?: number[]
          weekend_multiplier?: number
          weekly_discount_pct?: number
        }
        Update: {
          min_nights?: number
          monthly_discount_pct?: number
          updated_at?: string
          vehicle_id?: string
          weekend_days?: number[]
          weekend_multiplier?: number
          weekly_discount_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_pricing_rules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_pricing_rules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_telemetry: {
        Row: {
          address: string | null
          battery_status: string | null
          dtc_codes: Json | null
          fuel_level: number | null
          heading: number | null
          imei: string | null
          is_running: boolean | null
          last_event: string | null
          lat: number | null
          lng: number | null
          mil_on: boolean | null
          odometer: number | null
          reported_at: string | null
          speed: number | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          address?: string | null
          battery_status?: string | null
          dtc_codes?: Json | null
          fuel_level?: number | null
          heading?: number | null
          imei?: string | null
          is_running?: boolean | null
          last_event?: string | null
          lat?: number | null
          lng?: number | null
          mil_on?: boolean | null
          odometer?: number | null
          reported_at?: string | null
          speed?: number | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          address?: string | null
          battery_status?: string | null
          dtc_codes?: Json | null
          fuel_level?: number | null
          heading?: number | null
          imei?: string | null
          is_running?: boolean | null
          last_event?: string | null
          lat?: number | null
          lng?: number | null
          mil_on?: boolean | null
          odometer?: number | null
          reported_at?: string | null
          speed?: number | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_telemetry_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_telemetry_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_telemetry_history: {
        Row: {
          created_at: string | null
          event_type: string | null
          heading: number | null
          id: number
          lat: number | null
          lng: number | null
          raw: Json | null
          reported_at: string | null
          speed: number | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          heading?: number | null
          id?: never
          lat?: number | null
          lng?: number | null
          raw?: Json | null
          reported_at?: string | null
          speed?: number | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          heading?: number | null
          id?: never
          lat?: number | null
          lng?: number | null
          raw?: Json | null
          reported_at?: string | null
          speed?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_telemetry_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_telemetry_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_trips: {
        Row: {
          average_mpg: number | null
          avg_speed_mph: number | null
          created_at: string | null
          distance_mi: number | null
          duration_seconds: number | null
          end_address: string | null
          end_lat: number | null
          end_lng: number | null
          end_odometer: number | null
          ended_at: string | null
          fuel_consumed_gal: number | null
          gps: Json | null
          hard_accel: number | null
          hard_braking: number | null
          id: string
          idle_seconds: number | null
          imei: string | null
          max_speed_mph: number | null
          raw: Json | null
          start_address: string | null
          start_lat: number | null
          start_lng: number | null
          start_odometer: number | null
          started_at: string | null
          time_zone_offset: string | null
          transaction_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          average_mpg?: number | null
          avg_speed_mph?: number | null
          created_at?: string | null
          distance_mi?: number | null
          duration_seconds?: number | null
          end_address?: string | null
          end_lat?: number | null
          end_lng?: number | null
          end_odometer?: number | null
          ended_at?: string | null
          fuel_consumed_gal?: number | null
          gps?: Json | null
          hard_accel?: number | null
          hard_braking?: number | null
          id: string
          idle_seconds?: number | null
          imei?: string | null
          max_speed_mph?: number | null
          raw?: Json | null
          start_address?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_odometer?: number | null
          started_at?: string | null
          time_zone_offset?: string | null
          transaction_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          average_mpg?: number | null
          avg_speed_mph?: number | null
          created_at?: string | null
          distance_mi?: number | null
          duration_seconds?: number | null
          end_address?: string | null
          end_lat?: number | null
          end_lng?: number | null
          end_odometer?: number | null
          ended_at?: string | null
          fuel_consumed_gal?: number | null
          gps?: Json | null
          hard_accel?: number | null
          hard_braking?: number | null
          id?: string
          idle_seconds?: number | null
          imei?: string | null
          max_speed_mph?: number | null
          raw?: Json | null
          start_address?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_odometer?: number | null
          started_at?: string | null
          time_zone_offset?: string | null
          transaction_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acquired_date: string | null
          bags: number
          battery_condition: string | null
          body_condition: string | null
          bouncie_imei: string | null
          bouncie_raw: Json | null
          bouncie_vin: string | null
          brake_condition: string | null
          brand: string | null
          category: string
          color: string | null
          created_at: string
          current_odometer: number | null
          daily_price_usd: number
          default_deposit_amount: number
          default_franchise_amount: number
          deleted_at: string | null
          deleted_by: string | null
          doors: number | null
          e_pass_transponder: string | null
          engine_size: string | null
          engine_type: string | null
          features: string[] | null
          fuel: string
          id: string
          image_url: string | null
          initial_odometer: number | null
          insurance_expiry: string | null
          insurance_policy: string | null
          last_service_date: string | null
          license_plate: string | null
          listed_on_turo: boolean
          manufacture_year: number | null
          model: string | null
          model_year: number | null
          name: string
          next_service_km: number | null
          notes: string | null
          passengers: number
          photos: Json
          published: boolean
          purchase_price: number | null
          registration_expiry: string | null
          registry_photos: string[]
          renavam: string | null
          status: string
          tire_condition: string | null
          transmission: string
          updated_at: string
          version: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          acquired_date?: string | null
          bags?: number
          battery_condition?: string | null
          body_condition?: string | null
          bouncie_imei?: string | null
          bouncie_raw?: Json | null
          bouncie_vin?: string | null
          brake_condition?: string | null
          brand?: string | null
          category?: string
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          daily_price_usd?: number
          default_deposit_amount?: number
          default_franchise_amount?: number
          deleted_at?: string | null
          deleted_by?: string | null
          doors?: number | null
          e_pass_transponder?: string | null
          engine_size?: string | null
          engine_type?: string | null
          features?: string[] | null
          fuel?: string
          id?: string
          image_url?: string | null
          initial_odometer?: number | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          last_service_date?: string | null
          license_plate?: string | null
          listed_on_turo?: boolean
          manufacture_year?: number | null
          model?: string | null
          model_year?: number | null
          name: string
          next_service_km?: number | null
          notes?: string | null
          passengers?: number
          photos?: Json
          published?: boolean
          purchase_price?: number | null
          registration_expiry?: string | null
          registry_photos?: string[]
          renavam?: string | null
          status?: string
          tire_condition?: string | null
          transmission?: string
          updated_at?: string
          version?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          acquired_date?: string | null
          bags?: number
          battery_condition?: string | null
          body_condition?: string | null
          bouncie_imei?: string | null
          bouncie_raw?: Json | null
          bouncie_vin?: string | null
          brake_condition?: string | null
          brand?: string | null
          category?: string
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          daily_price_usd?: number
          default_deposit_amount?: number
          default_franchise_amount?: number
          deleted_at?: string | null
          deleted_by?: string | null
          doors?: number | null
          e_pass_transponder?: string | null
          engine_size?: string | null
          engine_type?: string | null
          features?: string[] | null
          fuel?: string
          id?: string
          image_url?: string | null
          initial_odometer?: number | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          last_service_date?: string | null
          license_plate?: string | null
          listed_on_turo?: boolean
          manufacture_year?: number | null
          model?: string | null
          model_year?: number | null
          name?: string
          next_service_km?: number | null
          notes?: string | null
          passengers?: number
          photos?: Json
          published?: boolean
          purchase_price?: number | null
          registration_expiry?: string | null
          registry_photos?: string[]
          renavam?: string | null
          status?: string
          tire_condition?: string | null
          transmission?: string
          updated_at?: string
          version?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      whatsapp_connection_status: {
        Row: {
          connected_phone: string | null
          id: string
          last_checked_at: string | null
          last_heartbeat_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          connected_phone?: string | null
          id?: string
          last_checked_at?: string | null
          last_heartbeat_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          connected_phone?: string | null
          id?: string
          last_checked_at?: string | null
          last_heartbeat_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          contact_name: string | null
          created_at: string
          customer_id: string | null
          external_conversation_id: string | null
          id: string
          is_group: boolean
          last_message_at: string | null
          last_message_preview: string | null
          phone: string
          stage: string
          status: string
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          external_conversation_id?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          phone: string
          stage?: string
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          external_conversation_id?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          phone?: string
          stage?: string
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events_raw: {
        Row: {
          error: string | null
          event_type: string | null
          external_message_id: string | null
          id: string
          payload: Json
          phone: string | null
          processed: boolean
          received_at: string
        }
        Insert: {
          error?: string | null
          event_type?: string | null
          external_message_id?: string | null
          id?: string
          payload: Json
          phone?: string | null
          processed?: boolean
          received_at?: string
        }
        Update: {
          error?: string | null
          event_type?: string | null
          external_message_id?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          processed?: boolean
          received_at?: string
        }
        Relationships: []
      }
      whatsapp_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string | null
          id: string
          prefilled_message: string | null
          slug: string
          target_phone: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          prefilled_message?: string | null
          slug: string
          target_phone?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          prefilled_message?: string | null
          slug?: string
          target_phone?: string | null
        }
        Relationships: []
      }
      whatsapp_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          edited_at: string | null
          external_message_id: string | null
          failure_reason: string | null
          forwarded_from_message_id: string | null
          id: string
          location_label: string | null
          location_lat: number | null
          location_lng: number | null
          media_mimetype: string | null
          media_url: string | null
          message_type: string
          pinned: boolean
          raw_payload: Json | null
          reply_to_message_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string
          timestamp: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          edited_at?: string | null
          external_message_id?: string | null
          failure_reason?: string | null
          forwarded_from_message_id?: string | null
          id?: string
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          media_mimetype?: string | null
          media_url?: string | null
          message_type?: string
          pinned?: boolean
          raw_payload?: Json | null
          reply_to_message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          timestamp?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          edited_at?: string | null
          external_message_id?: string | null
          failure_reason?: string | null
          forwarded_from_message_id?: string | null
          id?: string
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          media_mimetype?: string | null
          media_url?: string | null
          message_type?: string
          pinned?: boolean
          raw_payload?: Json | null
          reply_to_message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_forwarded_from_message_id_fkey"
            columns: ["forwarded_from_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_quick_replies: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          media_mimetype: string | null
          media_url: string | null
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_mimetype?: string | null
          media_url?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_mimetype?: string | null
          media_url?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      zapi_config: {
        Row: {
          client_token: string | null
          id: number
          instance_id: string | null
          token: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          client_token?: string | null
          id?: number
          instance_id?: string | null
          token?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          client_token?: string | null
          id?: number
          instance_id?: string | null
          token?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      zapi_contacts: {
        Row: {
          id: string
          lid: string | null
          name: string | null
          phone: string
          profile_picture_url: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          lid?: string | null
          name?: string | null
          phone: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          lid?: string | null
          name?: string | null
          phone?: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      vehicles_public: {
        Row: {
          bags: number | null
          brand: string | null
          category: string | null
          color: string | null
          created_at: string | null
          daily_price_usd: number | null
          default_deposit_amount: number | null
          default_franchise_amount: number | null
          deleted_at: string | null
          doors: number | null
          engine_size: string | null
          engine_type: string | null
          features: string[] | null
          fuel: string | null
          id: string | null
          image_url: string | null
          manufacture_year: number | null
          model: string | null
          model_year: number | null
          name: string | null
          passengers: number | null
          photos: Json | null
          published: boolean | null
          status: string | null
          transmission: string | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          bags?: number | null
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          daily_price_usd?: number | null
          default_deposit_amount?: number | null
          default_franchise_amount?: number | null
          deleted_at?: string | null
          doors?: number | null
          engine_size?: string | null
          engine_type?: string | null
          features?: string[] | null
          fuel?: string | null
          id?: string | null
          image_url?: string | null
          manufacture_year?: number | null
          model?: string | null
          model_year?: number | null
          name?: string | null
          passengers?: number | null
          photos?: Json | null
          published?: boolean | null
          status?: string | null
          transmission?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          bags?: number | null
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          daily_price_usd?: number | null
          default_deposit_amount?: number | null
          default_franchise_amount?: number | null
          deleted_at?: string | null
          doors?: number | null
          engine_size?: string | null
          engine_type?: string | null
          features?: string[] | null
          fuel?: string | null
          id?: string | null
          image_url?: string | null
          manufacture_year?: number | null
          model?: string | null
          model_year?: number | null
          name?: string | null
          passengers?: number | null
          photos?: Json | null
          published?: boolean | null
          status?: string | null
          transmission?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      bump_public_inspection_link_view: {
        Args: { _token: string }
        Returns: undefined
      }
      check_vehicle_availability: {
        Args: {
          p_exclude_id?: string
          p_pickup: string
          p_return: string
          p_vehicle_id: string
        }
        Returns: boolean
      }
      claim_scheduled_messages: {
        Args: { p_limit?: number }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          media_mimetype: string | null
          media_url: string | null
          message_type: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      demo_start_presentation: { Args: { p_count: number }; Returns: Json }
      demo_stop_presentation: { Args: never; Returns: Json }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_customer_by_phone_digits: {
        Args: { p_digits: string }
        Returns: string
      }
      get_assignable_staff: {
        Args: never
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_occupancy_rate: { Args: never; Returns: number }
      get_scheduled_messages_secret: { Args: never; Returns: string }
      get_vehicle_basic: {
        Args: { p_vehicle_id: string }
        Returns: {
          brand: string
          category: string
          color: string
          current_odometer: number
          doors: number
          fuel: string
          id: string
          image_url: string
          license_plate: string
          model: string
          name: string
          photos: Json
          status: string
          transmission: string
          year: number
        }[]
      }
      get_vehicle_for_my_booking: {
        Args: { p_booking_id: string }
        Returns: {
          category: string
          color: string
          current_odometer: number
          daily_price_usd: number
          id: string
          license_plate: string
          name: string
          year: number
        }[]
      }
      get_vehicle_pricing: {
        Args: { p_pickup: string; p_return: string; p_vehicle_id: string }
        Returns: {
          avg_per_day: number
          base_price: number
          discount_pct: number
          nights: number
          subtotal_rental: number
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_quick_reply_usage: {
        Args: { p_id: string }
        Returns: undefined
      }
      list_vehicles_basic: {
        Args: never
        Returns: {
          brand: string
          category: string
          color: string
          current_odometer: number
          id: string
          image_url: string
          license_plate: string
          model: string
          name: string
          photos: Json
          status: string
          year: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_last_login: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "finance"
        | "operations"
        | "support"
        | "driver"
      epass_toll_status: "matched" | "no_vehicle" | "no_booking" | "ignored"
      expense_type:
        | "maintenance"
        | "insurance"
        | "fine"
        | "fuel"
        | "documentation"
        | "parts"
        | "cleaning"
        | "other"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "open" | "in_progress" | "resolved" | "closed"
      incident_type:
        | "accident"
        | "breakdown"
        | "theft"
        | "vandalism"
        | "recall"
        | "other"
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
      app_role: ["admin", "user", "finance", "operations", "support", "driver"],
      epass_toll_status: ["matched", "no_vehicle", "no_booking", "ignored"],
      expense_type: [
        "maintenance",
        "insurance",
        "fine",
        "fuel",
        "documentation",
        "parts",
        "cleaning",
        "other",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["open", "in_progress", "resolved", "closed"],
      incident_type: [
        "accident",
        "breakdown",
        "theft",
        "vandalism",
        "recall",
        "other",
      ],
    },
  },
} as const
