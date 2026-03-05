-- ============================================
-- USER PROFILES & SOCIAL LINKING
-- ============================================

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    about_me TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social accounts linking
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'steam', 'epic', 'discord', 'twitch', etc.
    provider_account_id TEXT NOT NULL,
    username TEXT,
    avatar_url TEXT,
    profile_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- User game preferences
CREATE TABLE IF NOT EXISTS public.user_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_name TEXT NOT NULL,
    platform TEXT, -- 'steam', 'epic', 'xbox', 'playstation', 'switch'
    playtime_hours INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT false,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, game_name, platform)
);

-- User news preferences/tags they follow
CREATE TABLE IF NOT EXISTS public.user_news_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    weight INTEGER DEFAULT 1, -- for recommendation ranking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tag)
);

-- Steam specific data
CREATE TABLE IF NOT EXISTS public.steam_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    steam_id TEXT UNIQUE NOT NULL,
    persona_name TEXT,
    profile_url TEXT,
    avatar_full TEXT,
    country_code TEXT,
    total_games INTEGER DEFAULT 0,
    recent_playtime_2weeks INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_games_user ON public.user_games(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_news_preferences(user_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_news_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Social accounts: viewable by everyone, manage own
CREATE POLICY "Social accounts are viewable by everyone" 
ON public.social_accounts FOR SELECT USING (true);

CREATE POLICY "Users can manage own social accounts" 
ON public.social_accounts FOR ALL USING (auth.uid() = user_id);

-- User games: viewable by everyone, manage own
CREATE POLICY "User games are viewable by everyone" 
ON public.user_games FOR SELECT USING (true);

CREATE POLICY "Users can manage own games" 
ON public.user_games FOR ALL USING (auth.uid() = user_id);

-- News preferences: private to user
CREATE POLICY "Users can view own preferences" 
ON public.user_news_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" 
ON public.user_news_preferences FOR ALL USING (auth.uid() = user_id);

-- Steam profiles: viewable by everyone, manage own
CREATE POLICY "Steam profiles are viewable by everyone" 
ON public.steam_profiles FOR SELECT USING (true);

CREATE POLICY "Users can manage own steam profile" 
ON public.steam_profiles FOR ALL USING (auth.uid() = user_id);

-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (
    new.id,
    new.email,
    LOWER(SPLIT_PART(new.email, '@', 1)),
    SPLIT_PART(new.email, '@', 1)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
