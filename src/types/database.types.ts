export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          bio: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      dogs: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          breed: string | null;
          age_years: number | null;
          bio: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          breed?: string | null;
          age_years?: number | null;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          breed?: string | null;
          age_years?: number | null;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      locations: {
        Row: {
          owner_id: string;
          lat: number;
          lng: number;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          lat: number;
          lng: number;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          lat?: number;
          lng?: number;
          updated_at?: string;
        };
      };
      friend_requests: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_a?: string;
          user_b?: string;
          created_at?: string;
        };
      };
      walks: {
        Row: {
          id: string;
          friendship_id: string;
          scheduled_at: string;
          meeting_lat: number | null;
          meeting_lng: number | null;
          meeting_note: string | null;
          status: 'planned' | 'completed' | 'cancelled';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          friendship_id: string;
          scheduled_at: string;
          meeting_lat?: number | null;
          meeting_lng?: number | null;
          meeting_note?: string | null;
          status?: 'planned' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          friendship_id?: string;
          scheduled_at?: string;
          meeting_lat?: number | null;
          meeting_lng?: number | null;
          meeting_note?: string | null;
          status?: 'planned' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          friendship_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          friendship_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          friendship_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Dog = Database['public']['Tables']['dogs']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];
export type FriendRequest = Database['public']['Tables']['friend_requests']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type Walk = Database['public']['Tables']['walks']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
