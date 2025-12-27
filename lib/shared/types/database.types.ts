/**
 * Database type definitions
 *
 * This file re-exports the generated Supabase types and provides
 * convenient flat type aliases for common use cases.
 */

// Re-export everything from the generated types
export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.types.generated';

// Import the generated Database type
import type { Database } from './database.types.generated';

// =============================================================================
// FLAT TYPE ALIASES (for convenience)
// =============================================================================

// Organizations
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type CreateOrganization = Database['public']['Tables']['organizations']['Insert'];
export type UpdateOrganization = Database['public']['Tables']['organizations']['Update'];

// Leads
export type Lead = Database['public']['Tables']['leads']['Row'];
export type CreateLead = Database['public']['Tables']['leads']['Insert'];
export type UpdateLead = Database['public']['Tables']['leads']['Update'];

// Messages
export type Message = Database['public']['Tables']['messages']['Row'];
export type CreateMessage = Database['public']['Tables']['messages']['Insert'];
export type UpdateMessage = Database['public']['Tables']['messages']['Update'];

// Members
export type Member = Database['public']['Tables']['members']['Row'];
export type CreateMember = Database['public']['Tables']['members']['Insert'];
export type UpdateMember = Database['public']['Tables']['members']['Update'];

// WhatsApp Sessions
export type WhatsAppSession = Database['public']['Tables']['whatsapp_sessions']['Row'];
export type CreateWhatsAppSession = Database['public']['Tables']['whatsapp_sessions']['Insert'];
export type UpdateWhatsAppSession = Database['public']['Tables']['whatsapp_sessions']['Update'];
