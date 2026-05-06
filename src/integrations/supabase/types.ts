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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          addons: Json | null
          booking_number: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          driver_age: number | null
          extra_driver: boolean | null
          id: string
          notes: string | null
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
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          addons?: Json | null
          booking_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          driver_age?: number | null
          extra_driver?: boolean | null
          id?: string
          notes?: string | null
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
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          addons?: Json | null
          booking_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          driver_age?: number | null
          extra_driver?: boolean | null
          id?: string
          notes?: string | null
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
        ]
      }
      customers: {
        Row: {
          address: string | null
          complement: string | null
          created_at: string
          date_of_birth: string | null
          document_number: string | null
          driver_license: string | null
          driver_license_file_url: string | null
          email: string | null
          full_name: string
          house_number: string | null
          id: string
          nationality: string | null
          notes: string | null
          phone: string | null
          preferred_language: string
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
          document_number?: string | null
          driver_license?: string | null
          driver_license_file_url?: string | null
          email?: string | null
          full_name: string
          house_number?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string
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
          document_number?: string | null
          driver_license?: string | null
          driver_license_file_url?: string | null
          email?: string | null
          full_name?: string
          house_number?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
          user_id?: string | null
          welcome_sent?: boolean
          zip_code?: string | null
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
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
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
          last_login_at?: string | null
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      vehicle_expenses: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean | null
          receipt_url: string | null
          supplier: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          receipt_url?: string | null
          supplier?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          receipt_url?: string | null
          supplier?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicles: {
        Row: {
          acquired_date: string | null
          bags: number
          battery_condition: string | null
          body_condition: string | null
          brake_condition: string | null
          category: string
          color: string | null
          created_at: string
          current_odometer: number | null
          daily_price_usd: number
          doors: number | null
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
          name: string
          next_service_km: number | null
          notes: string | null
          passengers: number
          published: boolean
          purchase_price: number | null
          registration_expiry: string | null
          status: string
          tire_condition: string | null
          transmission: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          acquired_date?: string | null
          bags?: number
          battery_condition?: string | null
          body_condition?: string | null
          brake_condition?: string | null
          category?: string
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          daily_price_usd?: number
          doors?: number | null
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
          name: string
          next_service_km?: number | null
          notes?: string | null
          passengers?: number
          published?: boolean
          purchase_price?: number | null
          registration_expiry?: string | null
          status?: string
          tire_condition?: string | null
          transmission?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          acquired_date?: string | null
          bags?: number
          battery_condition?: string | null
          body_condition?: string | null
          brake_condition?: string | null
          category?: string
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          daily_price_usd?: number
          doors?: number | null
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
          name?: string
          next_service_km?: number | null
          notes?: string | null
          passengers?: number
          published?: boolean
          purchase_price?: number | null
          registration_expiry?: string | null
          status?: string
          tire_condition?: string | null
          transmission?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      record_last_login: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "finance" | "operations" | "support"
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
      app_role: ["admin", "user", "finance", "operations", "support"],
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
