export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          login_id: string
          role: Database['public']['Enums']['admin_role']
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          login_id: string
          role?: Database['public']['Enums']['admin_role']
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          login_id?: string
          role?: Database['public']['Enums']['admin_role']
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_requests: {
        Row: {
          author: string | null
          created_at: string
          id: string
          reason: string | null
          requester_name: string
          status: Database['public']['Enums']['request_status']
          student_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requester_name: string
          status?: Database['public']['Enums']['request_status']
          student_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requester_name?: string
          status?: Database['public']['Enums']['request_status']
          student_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'book_requests_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      books: {
        Row: {
          author: string
          available_copies: number
          category: string
          created_at: string
          id: string
          isbn: string | null
          publisher: string | null
          school_book_code: string | null
          title: string
          total_copies: number
          updated_at: string
        }
        Insert: {
          author: string
          available_copies?: number
          category?: string
          created_at?: string
          id?: string
          isbn?: string | null
          publisher?: string | null
          school_book_code?: string | null
          title: string
          total_copies?: number
          updated_at?: string
        }
        Update: {
          author?: string
          available_copies?: number
          category?: string
          created_at?: string
          id?: string
          isbn?: string | null
          publisher?: string | null
          school_book_code?: string | null
          title?: string
          total_copies?: number
          updated_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          book_id: string
          borrowed_on: string
          created_at: string
          due_on: string
          id: string
          notes: string | null
          returned_on: string | null
          status: Database['public']['Enums']['loan_status']
          student_id: string
          updated_at: string
        }
        Insert: {
          book_id: string
          borrowed_on?: string
          created_at?: string
          due_on?: string
          id?: string
          notes?: string | null
          returned_on?: string | null
          status?: Database['public']['Enums']['loan_status']
          student_id: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          borrowed_on?: string
          created_at?: string
          due_on?: string
          id?: string
          notes?: string | null
          returned_on?: string | null
          status?: Database['public']['Enums']['loan_status']
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'loans_book_id_fkey'
            columns: ['book_id']
            isOneToOne: false
            referencedRelation: 'books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'loans_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      students: {
        Row: {
          class_number: number
          created_at: string
          email: string | null
          grade: number
          id: string
          loan_banned_until: string | null
          name: string
          seat_number: number
          student_number: string
          updated_at: string
        }
        Insert: {
          class_number: number
          created_at?: string
          email?: string | null
          grade: number
          id?: string
          loan_banned_until?: string | null
          name: string
          seat_number: number
          student_number: string
          updated_at?: string
        }
        Update: {
          class_number?: number
          created_at?: string
          email?: string | null
          grade?: number
          id?: string
          loan_banned_until?: string | null
          name?: string
          seat_number?: number
          student_number?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      dashboard_recent_loans: {
        Row: {
          book_title: string | null
          id: string | null
          rental_date: string | null
          return_date: string | null
          status: string | null
          student_name: string | null
        }
        Relationships: []
      }
      dashboard_summary: {
        Row: {
          active_loans: number | null
          available_copies: number | null
          overdue_loans: number | null
          total_books: number | null
          total_copies: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_public_loan: {
        Args: {
          input_book_id: string
          input_notes?: string | null
          input_student_id: string
        }
        Returns: {
          active_loan_count: number
          book_title: string
          borrower_label: string
          borrower_type: string
          due_on: string
          loan_id: string
          loan_limit: number
          remaining_loan_count: number
          student_name: string
        }[]
      }
      get_returnable_loan_by_school_book_code: {
        Args: { input_school_book_code: string }
        Returns: {
          book_title: string
          borrowed_on: string
          due_on: string
          loan_id: string
          school_book_code: string | null
          student_name: string
        }[]
      }
      is_admin: {
        Args: { check_user_id?: string | null }
        Returns: boolean
      }
      lookup_student_for_loan: {
        Args: { input_student_number: string }
        Returns: {
          active_loan_count: number
          borrower_label: string
          borrower_type: string
          class_number: number
          grade: number
          id: string
          loan_ban_remaining_days: number
          loan_banned_until: string | null
          loan_limit: number
          name: string
          overdue_days: number
          remaining_loan_count: number
          seat_number: number
          student_number: string
        }[]
      }
      return_loans_by_school_book_codes: {
        Args: { input_school_book_codes: string[] }
        Returns: {
          book_title: string
          loan_banned_until: string | null
          loan_id: string
          overdue_days: number
          returned_on: string
          school_book_code: string | null
          student_name: string
        }[]
      }
      search_books: {
        Args: { search_query?: string | null }
        Returns: {
          author: string
          available_copies: number
          category: string
          id: string
          isbn: string | null
          publisher: string | null
          title: string
          total_copies: number
        }[]
      }
    }
    Enums: {
      admin_role: 'admin'
      loan_status: 'rented' | 'returned'
      request_status: 'pending' | 'approved' | 'rejected' | 'purchased'
    }
    CompositeTypes: Record<string, never>
  }
}
