export type UserRole = 'user' | 'manager' | 'supervisor' | 'admin'

export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  user_metadata: {
    name?: string
  }
}

export interface UserAssignment {
  id: string
  assignee_id: string  // The user being assigned (e.g., a user assigned to a manager)
  assignor_id: string  // The user doing the assignment (e.g., the manager or supervisor)
  created_at: string
  created_by: string   // The admin/supervisor who created this assignment
  assignee?: Profile   // Optional populated assignee profile
  assignor?: Profile   // Optional populated assignor profile
}

export interface Customer {
  id: string
  name: string
  email: string
  company?: string
  phone?: string
  address?: string
  notes?: string
  created_at: string
  updated_at: string
  created_by: string  // User ID who created this customer
  updated_by?: string  // User ID who last updated this customer
  videoCount?: number  // Number of videos associated with this customer (from Vimeo)
}
