-- ─── SUPABASE POSTGRESQL SCHEMA FOR IPL AUCTION APP ───


-- 1. AUCTIONS TABLE
CREATE TABLE IF NOT EXISTS public.auctions (
    id TEXT PRIMARY KEY,
    host_id TEXT,
    host_name TEXT DEFAULT 'Manager',
    host_online BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'waiting',
    auction_type TEXT DEFAULT 'mega',
    squad_limit INTEGER DEFAULT 25,
    overseas_limit INTEGER DEFAULT 8,
    players JSONB DEFAULT '[]'::jsonb,
    banned_players JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    player_order JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    auction_id TEXT,
    user_id TEXT,
    team_id TEXT,
    team_name TEXT,
    budget_remaining NUMERIC DEFAULT 120.0,
    spent NUMERIC DEFAULT 0.0,
    squad JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER FANTASY SQUADS TABLE
CREATE TABLE IF NOT EXISTS public.user_squads (
    id TEXT PRIMARY KEY,
    auction_id TEXT,
    user_id TEXT,
    user_name TEXT,
    team_id TEXT,
    captain_id TEXT,
    vice_captain_id TEXT,
    players JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FANTASY CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.fantasy_config (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LIVE AUCTION STATE. Versioned JSONB rows support atomic compare-and-set.
CREATE TABLE IF NOT EXISTS public.auction_states (
    id TEXT PRIMARY KEY,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL DEFAULT 'Not provided',
    user_name TEXT NOT NULL DEFAULT 'Anonymous',
    auth_type TEXT NOT NULL DEFAULT 'anonymous',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_photo TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    rating INTEGER NOT NULL DEFAULT 1 CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT NOT NULL,
    admin_note TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    is_starred BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 7. PLAYER SEED DATA
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FANTASY MATCH PROCESSING AND LEADERBOARD DATA
CREATE TABLE IF NOT EXISTS public.player_match_points (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    match_id TEXT NOT NULL,
    match_name TEXT,
    points NUMERIC NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processed_matches (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    name TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.match_stats (
    id TEXT PRIMARY KEY,
    week_id TEXT NOT NULL,
    calculated_points JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fantasy_profiles (
    id TEXT PRIMARY KEY,
    total_fantasy_points NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fantasy_leaderboard (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    weekly_points NUMERIC NOT NULL DEFAULT 0,
    total_points NUMERIC NOT NULL DEFAULT 0,
    squad_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ENABLE ROW LEVEL SECURITY (RLS) & SECURE POLICIES ───

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_leaderboard ENABLE ROW LEVEL SECURITY;

-- 1. AUCTIONS POLICIES
DROP POLICY IF EXISTS "Allow public all access on auctions" ON public.auctions;
CREATE POLICY "Allow public read access on auctions" ON public.auctions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on auctions" ON public.auctions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on auctions" ON public.auctions FOR UPDATE USING (true) WITH CHECK (true);

-- 2. TEAMS POLICIES
DROP POLICY IF EXISTS "Allow public all access on teams" ON public.teams;
CREATE POLICY "Allow public read access on teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on teams" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on teams" ON public.teams FOR UPDATE USING (true) WITH CHECK (true);

-- 3. USER SQUADS POLICIES
DROP POLICY IF EXISTS "Allow public all access on user_squads" ON public.user_squads;
CREATE POLICY "Allow public read access on user_squads" ON public.user_squads FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on user_squads" ON public.user_squads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on user_squads" ON public.user_squads FOR UPDATE USING (true) WITH CHECK (true);

-- 4. FANTASY CONFIG POLICIES
DROP POLICY IF EXISTS "Allow public all access on fantasy_config" ON public.fantasy_config;
CREATE POLICY "Allow public read access on fantasy_config" ON public.fantasy_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on fantasy_config" ON public.fantasy_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on fantasy_config" ON public.fantasy_config FOR UPDATE USING (true) WITH CHECK (true);

-- LIVE AUCTION STATE POLICIES
DROP POLICY IF EXISTS "Allow public read access on auction_states" ON public.auction_states;
DROP POLICY IF EXISTS "Allow authenticated insert access on auction_states" ON public.auction_states;
DROP POLICY IF EXISTS "Allow authenticated update access on auction_states" ON public.auction_states;
DROP POLICY IF EXISTS "Allow host delete access on auction_states" ON public.auction_states;
CREATE POLICY "Allow public read access on auction_states" ON public.auction_states
    FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert access on auction_states" ON public.auction_states
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated update access on auction_states" ON public.auction_states
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow host delete access on auction_states" ON public.auction_states
    FOR DELETE TO authenticated USING ((state -> 'room' ->> 'hostId') = auth.uid()::text);

-- Feedback may be submitted by guests; only the configured admin manages it.
DROP POLICY IF EXISTS "Allow public feedback submission" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow admin feedback management" ON public.feedbacks;
CREATE POLICY "Allow public feedback submission" ON public.feedbacks
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin feedback management" ON public.feedbacks
    FOR ALL TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'shaurya01836@gmail.com')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'shaurya01836@gmail.com');

-- Player seed data is publicly readable and admin-writable.
DROP POLICY IF EXISTS "Allow public player reads" ON public.players;
DROP POLICY IF EXISTS "Allow admin player writes" ON public.players;
CREATE POLICY "Allow public player reads" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow admin player writes" ON public.players
    FOR ALL TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'shaurya01836@gmail.com')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'shaurya01836@gmail.com');

-- Atomic row-version compare-and-set used by the live auction adapter.
CREATE OR REPLACE FUNCTION public.compare_and_set_auction_state(
    p_id TEXT,
    p_expected_version INTEGER,
    p_state JSONB
)
RETURNS TABLE(committed BOOLEAN, version INTEGER, state JSONB)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    updated_version INTEGER;
    updated_state JSONB;
BEGIN
    IF p_expected_version = 0 THEN
        INSERT INTO public.auction_states (id, state, version)
        VALUES (p_id, p_state, 1)
        ON CONFLICT (id) DO NOTHING;
        IF FOUND THEN
            RETURN QUERY SELECT true, 1, p_state;
            RETURN;
        END IF;
    ELSE
        UPDATE public.auction_states
        SET state = p_state,
            version = auction_states.version + 1,
            updated_at = NOW()
        WHERE id = p_id AND auction_states.version = p_expected_version
        RETURNING auction_states.version, auction_states.state
        INTO updated_version, updated_state;
        IF FOUND THEN
            RETURN QUERY SELECT true, updated_version, updated_state;
            RETURN;
        END IF;
    END IF;

    SELECT auction_states.version, auction_states.state
    INTO updated_version, updated_state
    FROM public.auction_states
    WHERE id = p_id;
    RETURN QUERY SELECT false, COALESCE(updated_version, 0), updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_server_time_ms()
RETURNS BIGINT
LANGUAGE SQL
VOLATILE
AS $$
    SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
$$;

GRANT EXECUTE ON FUNCTION public.compare_and_set_auction_state(TEXT, INTEGER, JSONB)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_time_ms()
    TO anon, authenticated;

-- Enable row changes for Supabase Realtime subscriptions.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'auction_states'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_states;
    END IF;
END;
$$;

-- ─── CLEANUP UNWANTED/PERMISSIVE SECURITY DEFINER FUNCTIONS ───
DROP FUNCTION IF EXISTS public.rls_auto_enable();
