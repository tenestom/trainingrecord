-- Drop existing tables if they exist to start fresh (optional, but good for MVP)
DROP TABLE IF EXISTS sets;
DROP TABLE IF EXISTS sessions;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    lake TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sets table
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    satisfaction INTEGER CHECK (satisfaction >= 0 AND satisfaction <= 5),
    notes TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- RLS Policies for 'sessions'
-- --------------------------------------------------------

-- SELECT: Users can only see their own sessions
CREATE POLICY "Users can view their own sessions" 
    ON sessions FOR SELECT 
    USING (auth.uid() = user_id);

-- INSERT: Users can only insert sessions for themselves
CREATE POLICY "Users can insert their own sessions" 
    ON sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own sessions
CREATE POLICY "Users can update their own sessions" 
    ON sessions FOR UPDATE 
    USING (auth.uid() = user_id);

-- DELETE: Users can only delete their own sessions
CREATE POLICY "Users can delete their own sessions" 
    ON sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- RLS Policies for 'sets'
-- --------------------------------------------------------

-- SELECT: Users can view sets if they own the parent session
CREATE POLICY "Users can view sets of their sessions" 
    ON sets FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = sets.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- INSERT: Users can insert sets if they own the parent session
CREATE POLICY "Users can insert sets to their sessions" 
    ON sets FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = sets.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- UPDATE: Users can update sets if they own the parent session
CREATE POLICY "Users can update sets of their sessions" 
    ON sets FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = sets.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- DELETE: Users can delete sets if they own the parent session
CREATE POLICY "Users can delete sets of their sessions" 
    ON sets FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = sets.session_id 
            AND sessions.user_id = auth.uid()
        )
    );
