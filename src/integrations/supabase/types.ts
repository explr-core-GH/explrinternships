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
      interns: {
        Row: {
          additional_questions: string | null
          admin_notes: string | null
          bike_program: string | null
          biomedical: string | null
          cleveland_clinic: string | null
          construction_mgmt: string | null
          created_at: string
          cs_course_taken: string | null
          dob: string | null
          education_internship: string | null
          email_submission: string | null
          env_climate: string | null
          env_field_science: string | null
          env_justice: string | null
          first_name: string
          gender: string | null
          grade: string | null
          healthcare: string | null
          id: string
          iers_center: string | null
          intake_date: string | null
          intake_location: string | null
          intake_time: string | null
          is_cmsd: boolean | null
          is_duplicate: boolean | null
          is_ell: boolean | null
          is_newest: boolean | null
          it_certification: string | null
          it_interests: string[] | null
          journalism: string | null
          last_name: string
          magnet_manufacturing: string | null
          other_school: string | null
          parent_guardian_email: string | null
          parent_guardian_phone: string | null
          parent_phone: string | null
          phone: string | null
          programs: string[] | null
          race_ethnicity: string | null
          school: string | null
          source_sheet_url: string | null
          specific_interests: string | null
          status: string
          student_email: string | null
          timestamp: string | null
          updated_at: string
          video_games: string | null
        }
        Insert: {
          additional_questions?: string | null
          admin_notes?: string | null
          bike_program?: string | null
          biomedical?: string | null
          cleveland_clinic?: string | null
          construction_mgmt?: string | null
          created_at?: string
          cs_course_taken?: string | null
          dob?: string | null
          education_internship?: string | null
          email_submission?: string | null
          env_climate?: string | null
          env_field_science?: string | null
          env_justice?: string | null
          first_name: string
          gender?: string | null
          grade?: string | null
          healthcare?: string | null
          id?: string
          iers_center?: string | null
          intake_date?: string | null
          intake_location?: string | null
          intake_time?: string | null
          is_cmsd?: boolean | null
          is_duplicate?: boolean | null
          is_ell?: boolean | null
          is_newest?: boolean | null
          it_certification?: string | null
          it_interests?: string[] | null
          journalism?: string | null
          last_name: string
          magnet_manufacturing?: string | null
          other_school?: string | null
          parent_guardian_email?: string | null
          parent_guardian_phone?: string | null
          parent_phone?: string | null
          phone?: string | null
          programs?: string[] | null
          race_ethnicity?: string | null
          school?: string | null
          source_sheet_url?: string | null
          specific_interests?: string | null
          status?: string
          student_email?: string | null
          timestamp?: string | null
          updated_at?: string
          video_games?: string | null
        }
        Update: {
          additional_questions?: string | null
          admin_notes?: string | null
          bike_program?: string | null
          biomedical?: string | null
          cleveland_clinic?: string | null
          construction_mgmt?: string | null
          created_at?: string
          cs_course_taken?: string | null
          dob?: string | null
          education_internship?: string | null
          email_submission?: string | null
          env_climate?: string | null
          env_field_science?: string | null
          env_justice?: string | null
          first_name?: string
          gender?: string | null
          grade?: string | null
          healthcare?: string | null
          id?: string
          iers_center?: string | null
          intake_date?: string | null
          intake_location?: string | null
          intake_time?: string | null
          is_cmsd?: boolean | null
          is_duplicate?: boolean | null
          is_ell?: boolean | null
          is_newest?: boolean | null
          it_certification?: string | null
          it_interests?: string[] | null
          journalism?: string | null
          last_name?: string
          magnet_manufacturing?: string | null
          other_school?: string | null
          parent_guardian_email?: string | null
          parent_guardian_phone?: string | null
          parent_phone?: string | null
          phone?: string | null
          programs?: string[] | null
          race_ethnicity?: string | null
          school?: string | null
          source_sheet_url?: string | null
          specific_interests?: string | null
          status?: string
          student_email?: string | null
          timestamp?: string | null
          updated_at?: string
          video_games?: string | null
        }
        Relationships: []
      }
      placements: {
        Row: {
          created_at: string
          id: string
          intern_id: string
          worksite_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intern_id: string
          worksite_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intern_id?: string
          worksite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: true
            referencedRelation: "interns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_worksite_id_fkey"
            columns: ["worksite_id"]
            isOneToOne: false
            referencedRelation: "worksites"
            referencedColumns: ["id"]
          },
        ]
      }
      school_aliases: {
        Row: {
          alias: string
          canonical_name: string
          created_at: string
          id: string
        }
        Insert: {
          alias: string
          canonical_name: string
          created_at?: string
          id?: string
        }
        Update: {
          alias?: string
          canonical_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      school_contacts: {
        Row: {
          contact_email: string
          contact_name: string
          created_at: string
          id: string
          role: string
          school_name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_name: string
          created_at?: string
          id?: string
          role: string
          school_name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          role?: string
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_config: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          sheet_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          sheet_url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          sheet_url?: string
        }
        Relationships: []
      }
      worksites: {
        Row: {
          capacity: number | null
          category: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          filled: number | null
          id: string
          interest_field_keys: string[]
          labels: Json
          location: string | null
          name: string
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          category: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          filled?: number | null
          id?: string
          interest_field_keys?: string[]
          labels?: Json
          location?: string | null
          name: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          filled?: number | null
          id?: string
          interest_field_keys?: string[]
          labels?: Json
          location?: string | null
          name?: string
          status?: string
          tags?: string[] | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
