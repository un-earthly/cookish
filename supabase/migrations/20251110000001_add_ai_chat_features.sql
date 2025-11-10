/*
  # AI Chat Features Migration

  ## Overview
  This migration extends the existing recipe app schema to support AI-powered conversational recipe generation.
  It adds chat functionality, image support, and enhanced recipe metadata while preserving all existing data.

  ## New Tables

  ### 1. `chat_sessions`
  Tracks conversation sessions for recipe generation
  - `id` (uuid, primary key) - Unique session identifier
  - `user_id` (uuid) - Reference to auth.users
  - `title` (text) - Optional session title/summary
  - `started_at` (timestamptz) - When session began
  - `last_activity` (timestamptz) - Last message timestamp
  - `message_count` (integer) - Number of messages in session
  - `is_active` (boolean) - Whether session is still active

  ### 2. `chat_messages`
  Stores individual messages within chat sessions
  - `id` (uuid, primary key) - Unique message identifier
  - `session_id` (uuid) - Reference to chat_sessions
  - `role` (text) - 'user' or 'assistant'
  - `content` (text) - Message content
  - `voice_input` (boolean) - Whether message came from voice
  - `recipe_id` (uuid) - Optional reference to generated recipe
  - `processing_time` (integer) - Time taken to generate response (ms)
  - `created_at` (timestamptz) - Message timestamp

  ## Table Extensions

  ### Extended `daily_recipes` table
  Adds new fields to support AI chat features:
  - `image_url` (text) - URL to recipe image
  - `image_source` (text) - Source of image ('unsplash', 'pexels', 'placeholder')
  - `image_attribution` (text) - Image attribution text
  - `created_via` (text) - How recipe was created ('chat', 'daily', 'manual')
  - `chat_session_id` (uuid) - Reference to originating chat session
  - `ai_model_used` (text) - Which AI model generated the recipe
  - `difficulty` (text) - Recipe difficulty level
  - `cuisine_type` (text) - Type of cuisine
  - `tags` (jsonb) - Recipe tags array
  - `variations` (jsonb) - Recipe variation suggestions
  - `cooking_tips` (jsonb) - Additional cooking tips

  ### Extended `user_preferences` table
  Adds new fields for AI features:
  - `subscription_tier` (text) - 'free' or 'premium'
  - `preferred_ai_model` (text) - User's preferred AI model
  - `voice_enabled` (boolean) - Whether voice input is enabled
  - `image_preferences` (jsonb) - Image source preferences
  - `dietary_restrictions` (jsonb) - Detailed dietary restrictions
  - `cooking_skill_level` (text) - User's cooking skill level
  - `preferred_cuisines` (jsonb) - Preferred cuisine types
*/

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  started_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  voice_input boolean DEFAULT false,
  recipe_id uuid REFERENCES daily_recipes(id) ON DELETE SET NULL,
  processing_time integer,
  created_at timestamptz DEFAULT now()
);

-- Extend daily_recipes table with AI features
ALTER TABLE daily_recipes 
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS image_source text CHECK (image_source IN ('unsplash', 'pexels', 'placeholder', 'ai_generated')),
ADD COLUMN IF NOT EXISTS image_attribution text,
ADD COLUMN IF NOT EXISTS created_via text DEFAULT 'daily' CHECK (created_via IN ('chat', 'daily', 'manual')),
ADD COLUMN IF NOT EXISTS chat_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_model_used text,
ADD COLUMN IF NOT EXISTS difficulty text CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
ADD COLUMN IF NOT EXISTS cuisine_type text,
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS variations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cooking_tips jsonb DEFAULT '[]'::jsonb;

-- Extend user_preferences table with AI features
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
ADD COLUMN IF NOT EXISTS preferred_ai_model text,
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS image_preferences jsonb DEFAULT '{"enabled": true, "sources": ["unsplash", "pexels"]}'::jsonb,
ADD COLUMN IF NOT EXISTS dietary_restrictions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cooking_skill_level text DEFAULT 'beginner' CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced')),
ADD COLUMN IF NOT EXISTS preferred_cuisines jsonb DEFAULT '[]'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_activity ON chat_sessions(user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_chat_session ON daily_recipes(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_created_via ON daily_recipes(user_id, created_via);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_cuisine ON daily_recipes(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_difficulty ON daily_recipes(difficulty);

-- Enable Row Level Security for new tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages from own sessions"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own sessions"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own sessions"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from own sessions"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Function to update chat session activity
CREATE OR REPLACE FUNCTION update_chat_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET 
    last_activity = NEW.created_at,
    message_count = message_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update session activity when messages are added
CREATE TRIGGER update_session_activity_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_activity();

-- Function to generate session titles based on first user message
CREATE OR REPLACE FUNCTION generate_session_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' AND OLD.title IS NULL THEN
    UPDATE chat_sessions 
    SET title = CASE 
      WHEN LENGTH(NEW.content) > 50 
      THEN LEFT(NEW.content, 47) || '...'
      ELSE NEW.content
    END
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate session titles
CREATE TRIGGER generate_session_title_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION generate_session_title();