export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    username: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    rating: number;
                    games_played: number;
                    wins: number;
                    losses: number;
                    draws: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    username: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    rating?: number;
                    games_played?: number;
                    wins?: number;
                    losses?: number;
                    draws?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    username?: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    rating?: number;
                    games_played?: number;
                    wins?: number;
                    losses?: number;
                    draws?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_id_fkey";
                        columns: ["id"];
                        isOneToOne: true;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
            games: {
                Row: {
                    id: string;
                    white_player_id: string | null;
                    black_player_id: string | null;
                    status: "waiting" | "active" | "completed" | "abandoned";
                    winner_id: string | null;
                    draw_offered_by: string | null;
                    game_state: Json;
                    move_history: Json;
                    start_time: string;
                    end_time: string | null;
                    initial_time: number;
                    increment_time: number;
                    white_time_remaining: number;
                    black_time_remaining: number;
                    last_move_time: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    white_player_id?: string | null;
                    black_player_id?: string | null;
                    status?: "waiting" | "active" | "completed" | "abandoned";
                    winner_id?: string | null;
                    draw_offered_by?: string | null;
                    game_state: Json;
                    move_history?: Json;
                    start_time?: string;
                    end_time?: string | null;
                    initial_time?: number;
                    increment_time?: number;
                    white_time_remaining?: number;
                    black_time_remaining?: number;
                    last_move_time?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    white_player_id?: string | null;
                    black_player_id?: string | null;
                    status?: "waiting" | "active" | "completed" | "abandoned";
                    winner_id?: string | null;
                    draw_offered_by?: string | null;
                    game_state?: Json;
                    move_history?: Json;
                    start_time?: string;
                    end_time?: string | null;
                    initial_time?: number;
                    increment_time?: number;
                    white_time_remaining?: number;
                    black_time_remaining?: number;
                    last_move_time?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "games_black_player_id_fkey";
                        columns: ["black_player_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "games_draw_offered_by_fkey";
                        columns: ["draw_offered_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "games_white_player_id_fkey";
                        columns: ["white_player_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "games_winner_id_fkey";
                        columns: ["winner_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            messages: {
                Row: {
                    id: string;
                    game_id: string;
                    user_id: string;
                    content: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    game_id: string;
                    user_id: string;
                    content: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    game_id?: string;
                    user_id?: string;
                    content?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "messages_game_id_fkey";
                        columns: ["game_id"];
                        isOneToOne: false;
                        referencedRelation: "games";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "messages_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            game_invites: {
                Row: {
                    id: string;
                    sender_id: string;
                    receiver_id: string;
                    status: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    sender_id: string;
                    receiver_id: string;
                    status?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    sender_id?: string;
                    receiver_id?: string;
                    status?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "game_invites_receiver_id_fkey";
                        columns: ["receiver_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "game_invites_sender_id_fkey";
                        columns: ["sender_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            online_players: {
                Row: {
                    id: string;
                    username: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    rating: number;
                    last_seen: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    username: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    rating?: number;
                    last_seen: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    username?: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    rating?: number;
                    last_seen?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "online_players_id_fkey";
                        columns: ["id"];
                        isOneToOne: true;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}

// Các kiểu dữ liệu phụ trợ cho các component
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Game = Database['public']['Tables']['games']['Row'] & {
    white_player?: Profile;
    black_player?: Profile;
};
export type Message = Database['public']['Tables']['messages']['Row'] & {
    username?: string;
    avatar_url?: string;
};
export type GameInvite = Database['public']['Tables']['game_invites']['Row'];

// Kiểu dữ liệu kết quả trận đấu
export interface GameResult {
    winner: string | null;
    reason: 'checkmate' | 'stalemate' | 'resignation' | 'timeout' | 'draw';
}