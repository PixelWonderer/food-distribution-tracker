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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      allocations: {
        Row: {
          allocated_quantity: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          destination_id: string
          id: string
          is_confirmed: boolean | null
          is_distributed: boolean | null
          order_id: string
          received_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          allocated_quantity: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          destination_id: string
          id?: string
          is_confirmed?: boolean | null
          is_distributed?: boolean | null
          order_id: string
          received_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          allocated_quantity?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          destination_id?: string
          id?: string
          is_confirmed?: boolean | null
          is_distributed?: boolean | null
          order_id?: string
          received_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_items: {
        Row: {
          added_by: string | null
          created_at: string | null
          destination_id: string
          id: string
          inventory_item_id: string | null
          is_packed: boolean | null
          item_name: string
          quantity: number
          unit: string | null
          updated_at: string | null
          week_date: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          destination_id: string
          id?: string
          inventory_item_id?: string | null
          is_packed?: boolean | null
          item_name: string
          quantity: number
          unit?: string | null
          updated_at?: string | null
          week_date: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          destination_id?: string
          id?: string
          inventory_item_id?: string | null
          is_packed?: boolean | null
          item_name?: string
          quantity?: number
          unit?: string | null
          updated_at?: string | null
          week_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_items_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          default_timing: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_custom: boolean | null
          is_direct: boolean | null
          name: string
          sheet_column_index: number | null
          short_name: string | null
          timing: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          default_timing?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_direct?: boolean | null
          name: string
          sheet_column_index?: number | null
          short_name?: string | null
          timing?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          default_timing?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_direct?: boolean | null
          name?: string
          sheet_column_index?: number | null
          short_name?: string | null
          timing?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      distribution_tracking: {
        Row: {
          allocation_id: string
          created_at: string | null
          distributed_at: string | null
          distributed_by: string | null
          id: string
          is_distributed: boolean | null
          updated_at: string | null
        }
        Insert: {
          allocation_id: string
          created_at?: string | null
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          is_distributed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allocation_id?: string
          created_at?: string | null
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          is_distributed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_tracking_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_tracking_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "v_allocation_summary"
            referencedColumns: ["allocation_id"]
          },
        ]
      }
      order_confirmation_resets: {
        Row: {
          id: number
          reset_at: string
          reset_by: string | null
          week_date: string
        }
        Insert: {
          id?: number
          reset_at?: string
          reset_by?: string | null
          week_date: string
        }
        Update: {
          id?: number
          reset_at?: string
          reset_by?: string | null
          week_date?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          quantity: number
          ran_out: boolean | null
          storage_type: string | null
          unit: string | null
          updated_at: string | null
          week_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          quantity: number
          ran_out?: boolean | null
          storage_type?: string | null
          unit?: string | null
          updated_at?: string | null
          week_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          quantity?: number
          ran_out?: boolean | null
          storage_type?: string | null
          unit?: string | null
          updated_at?: string | null
          week_date?: string
        }
        Relationships: []
      }
      redirections: {
        Row: {
          allocation_id: string
          id: string
          quantity: number
          redirected_at: string | null
          redirected_by: string | null
          source_destination_id: string
          target_destination_id: string
          week_date: string
        }
        Insert: {
          allocation_id: string
          id?: string
          quantity: number
          redirected_at?: string | null
          redirected_by?: string | null
          source_destination_id: string
          target_destination_id: string
          week_date: string
        }
        Update: {
          allocation_id?: string
          id?: string
          quantity?: number
          redirected_at?: string | null
          redirected_by?: string | null
          source_destination_id?: string
          target_destination_id?: string
          week_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirections_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirections_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_allocation_summary"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "redirections_source_destination_id_fkey"
            columns: ["source_destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirections_target_destination_id_fkey"
            columns: ["target_destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          destination_id: string
          destination_name: string
          id: string
          new_timing: string
          previous_timing: string | null
          week_date: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          destination_id: string
          destination_name: string
          id?: string
          new_timing: string
          previous_timing?: string | null
          week_date?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          destination_id?: string
          destination_name?: string
          id?: string
          new_timing?: string
          previous_timing?: string | null
          week_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_history_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_tracking: {
        Row: {
          allocation_id: string
          created_at: string | null
          id: string
          is_stored: boolean | null
          stored_at: string | null
          stored_by: string | null
          updated_at: string | null
        }
        Insert: {
          allocation_id: string
          created_at?: string | null
          id?: string
          is_stored?: boolean | null
          stored_at?: string | null
          stored_by?: string | null
          updated_at?: string | null
        }
        Update: {
          allocation_id?: string
          created_at?: string | null
          id?: string
          is_stored?: boolean | null
          stored_at?: string | null
          stored_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_tracking_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_tracking_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "v_allocation_summary"
            referencedColumns: ["allocation_id"]
          },
        ]
      }
      surplus_claims: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          group_name: string
          id: string
          order_id: string
          picked_up: boolean | null
          picked_up_at: string | null
          picked_up_by: string | null
          picked_up_qty: number | null
          quantity_claimed: number
          week_date: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          group_name: string
          id?: string
          order_id: string
          picked_up?: boolean | null
          picked_up_at?: string | null
          picked_up_by?: string | null
          picked_up_qty?: number | null
          quantity_claimed: number
          week_date: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          group_name?: string
          id?: string
          order_id?: string
          picked_up?: boolean | null
          picked_up_at?: string | null
          picked_up_by?: string | null
          picked_up_qty?: number | null
          quantity_claimed?: number
          week_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "surplus_claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      surplus_groups: {
        Row: {
          created_at: string | null
          date_added: string | null
          group_name: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          date_added?: string | null
          group_name: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          date_added?: string | null
          group_name?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      sync_metadata: {
        Row: {
          change_count: number | null
          created_at: string | null
          id: string
          last_modified_at: string
          modified_by: string | null
        }
        Insert: {
          change_count?: number | null
          created_at?: string | null
          id?: string
          last_modified_at?: string
          modified_by?: string | null
        }
        Update: {
          change_count?: number | null
          created_at?: string | null
          id?: string
          last_modified_at?: string
          modified_by?: string | null
        }
        Relationships: []
      }
      tunnel_config: {
        Row: {
          id: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          id?: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          id?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_allocation_summary: {
        Row: {
          allocated_quantity: number | null
          allocation_id: string | null
          destination_code: string | null
          destination_name: string | null
          distributed_at: string | null
          distributed_by: string | null
          is_direct: boolean | null
          is_distributed: boolean | null
          is_stored: boolean | null
          item_name: string | null
          ran_out: boolean | null
          storage_type: string | null
          stored_at: string | null
          stored_by: string | null
          timing: string | null
          total_quantity: number | null
          unit: string | null
          week_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_and_import_data: {
        Args: { p_allocations: Json; p_orders: Json }
        Returns: {
          allocations_upserted: number
          orders_upserted: number
        }[]
      }
      clear_and_import_data_v2: {
        Args: { allocations_data: Json; orders_data: Json }
        Returns: Json
      }
      confirm_all_items_at_expected: {
        Args: { p_confirmed_by?: string; p_week_date: string }
        Returns: number
      }
      confirm_item_at_expected: {
        Args: { p_confirmed_by?: string; p_order_id: string }
        Returns: undefined
      }
      create_custom_destination: {
        Args: {
          p_created_by?: string
          p_is_direct?: boolean
          p_name: string
          p_timing?: string
        }
        Returns: string
      }
      deactivate_custom_destination: {
        Args: { p_destination_id: string }
        Returns: boolean
      }
      get_active_user_count: { Args: Record<PropertyKey, never>; Returns: number }
      get_all_custom_items: {
        Args: Record<PropertyKey, never>
        Returns: {
          added_by: string
          destination_code: string
          destination_name: string
          inventory_item_id: string | null
          is_packed: boolean
          item_id: string
          item_name: string
          quantity: number
          unit: string
        }[]
      }
      get_all_supplies_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          destination_code: string
          destination_name: string
          is_packed: boolean
          quantity: number
          supply_id: string
          supply_type: string
        }[]
      }
      get_all_week_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          allocated_quantity: number
          allocation_id: string
          confirmed_at: string
          confirmed_by: string
          destination_code: string
          destination_id: string
          destination_name: string
          distributed_at: string
          distributed_by: string
          is_confirmed: boolean
          is_distributed: boolean
          is_stored: boolean
          item_name: string
          order_id: string
          quantity: number
          ran_out: boolean
          received_quantity: number
          storage_type: string
          stored_at: string
          stored_by: string
          unit: string
        }[]
      }
      get_confirmation_status: {
        Args: { p_week_date: string }
        Returns: {
          all_confirmed: boolean
          confirmed_items: number
          total_items: number
        }[]
      }
      get_custom_items: {
        Args: { target_date?: string }
        Returns: {
          added_by: string
          created_at: string
          destination_code: string
          destination_name: string
          is_packed: boolean
          item_id: string
          item_name: string
          quantity: number
          unit: string
        }[]
      }
      get_dashboard_summary: {
        Args: { target_date?: string }
        Returns: {
          custom_items_count: number
          distribution_complete: number
          storage_complete: number
          supplies_count: number
          total_destinations: number
          total_items: number
        }[]
      }
      get_order_confirmation_items: {
        Args: Record<PropertyKey, never>
        Returns: {
          allocation_count: number
          confirmed_at: string
          confirmed_by: string
          expected_quantity: number
          is_confirmed: boolean
          item_name: string
          order_id: string
          ran_out: boolean
          received_quantity: number
          storage_type: string
          unit: string
        }[]
      }
      get_supplies_status: {
        Args: { target_date?: string }
        Returns: {
          destination_code: string
          destination_name: string
          is_packed: boolean
          notes: string
          quantity: number
          supply_id: string
          supply_type: string
        }[]
      }
      get_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_users: number
          change_count: number
          last_modified_at: string
        }[]
      }
      get_week_data: {
        Args: { target_date: string }
        Returns: {
          allocated_quantity: number
          allocation_id: string
          destination_code: string
          destination_id: string
          destination_name: string
          distributed_at: string
          distributed_by: string
          is_distributed: boolean
          is_stored: boolean
          item_name: string
          order_id: string
          quantity: number
          storage_type: string
          stored_at: string
          stored_by: string
          unit: string
        }[]
      }
      mark_item_ran_out: {
        Args: { p_confirmed_by?: string; p_order_id: string }
        Returns: undefined
      }
      pack_all_distribution: {
        Args: {
          p_destination_code: string
          p_user_name?: string
          p_week_date: string
        }
        Returns: number
      }
      pack_all_storage: {
        Args: {
          p_destination_code: string
          p_user_name?: string
          p_week_date: string
        }
        Returns: number
      }
      reactivate_custom_destination: {
        Args: { p_destination_id: string }
        Returns: boolean
      }
      redirect_item: {
        Args: {
          p_allocation_id: string
          p_quantity: number
          p_redirected_by?: string
          p_target_destination_id: string
        }
        Returns: {
          source_remaining: number
          target_allocation_id: string
          target_new_quantity: number
        }[]
      }
      replace_week_data: {
        Args: { p_allocations: Json; p_orders: Json; p_week_date: string }
        Returns: {
          allocations_upserted: number
          orders_upserted: number
        }[]
      }
      reset_confirmations:
        | { Args: { p_week_date: string }; Returns: number }
        | {
            Args: { p_reset_by?: string; p_week_date: string }
            Returns: number
          }
      reset_destination_timings: { Args: Record<PropertyKey, never>; Returns: undefined }
      sync_from_sheets: {
        Args: { p_allocations: Json; p_orders: Json; p_week_date: string }
        Returns: {
          allocations_upserted: number
          orders_upserted: number
        }[]
      }
      toggle_custom_item_packed: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      toggle_distribution: {
        Args: { p_allocation_id: string; p_user_name?: string }
        Returns: boolean
      }
      toggle_storage: {
        Args: { p_allocation_id: string; p_user_name?: string }
        Returns: boolean
      }
      toggle_supply_packed: { Args: { p_supply_id: string }; Returns: boolean }
      update_allocations_proportionally: {
        Args: {
          p_confirmed_by?: string
          p_order_id: string
          p_received_quantity: number
        }
        Returns: {
          allocation_id: string
          destination_code: string
          new_qty: number
          original_qty: number
        }[]
      }
      update_destination_timing: {
        Args: {
          p_changed_by?: string
          p_destination_id: string
          p_new_timing: string
        }
        Returns: undefined
      }
      upsert_user_session: {
        Args: {
          p_ip_address?: string
          p_session_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
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
