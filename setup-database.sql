-- Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    rating INTEGER DEFAULT 1200 NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL,
    wins INTEGER DEFAULT 0 NOT NULL,
    losses INTEGER DEFAULT 0 NOT NULL,
    draws INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create the games table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    white_player_id UUID REFERENCES public.profiles(id),
    black_player_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
    winner_id UUID REFERENCES public.profiles(id),
    draw_offered_by UUID REFERENCES public.profiles(id),
    game_state JSONB NOT NULL,
    move_history JSONB DEFAULT '[]'::jsonb NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    initial_time INTEGER DEFAULT 600 NOT NULL, -- default 10 minutes in seconds
    increment_time INTEGER DEFAULT 0 NOT NULL, -- default 0 second increment
    white_time_remaining INTEGER DEFAULT 600 NOT NULL,
    black_time_remaining INTEGER DEFAULT 600 NOT NULL,
    last_move_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create the messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create the game_invites table
CREATE TABLE IF NOT EXISTS public.game_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create the online_players table
CREATE TABLE IF NOT EXISTS public.online_players (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status TEXT DEFAULT 'online' NOT NULL CHECK (status IN ('online', 'away', 'busy')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for online_players table
ALTER TABLE public.online_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online players are viewable by everyone"
    ON public.online_players
    FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own online status"
    ON public.online_players
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own online status"
    ON public.online_players
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own online status"
    ON public.online_players
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create RLS policies to secure the tables
-- For profiles, allow users to read all profiles but only update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles
    FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- For games, allow reading for everyone but only participants can update
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
    ON public.games
    FOR SELECT
    USING (true);

CREATE POLICY "Game participants can update game"
    ON public.games
    FOR UPDATE
    USING (
        auth.uid() = white_player_id OR 
        auth.uid() = black_player_id
    );

-- Set up a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
