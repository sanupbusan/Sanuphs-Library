export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
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
          location: string | null
          published_year: number | null
          publisher: string | null
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
          location?: string | null
          published_year?: number | null
          publisher?: string | null
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
          location?: string | null
          published_year?: number | null
          publisher?: string | null
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
      search_books: {
        Args: { search_query?: string | null }
        Returns: {
          author: string
          available_copies: number
          category: string
          id: string
          isbn: string | null
          location: string | null
          publisher: string | null
          title: string
          total_copies: number
        }[]
      }
    }
    Enums: {
      loan_status: 'rented' | 'returned'
      request_status: 'pending' | 'approved' | 'rejected' | 'purchased'
    }
    CompositeTypes: Record<string, never>
  }
}
