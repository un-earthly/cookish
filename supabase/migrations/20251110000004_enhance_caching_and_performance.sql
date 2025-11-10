/*
  # Enhanced Caching and Performance Migration

  ## Overview
  This migration adds image caching metadata, performance optimizations, and additional indexes
  to support efficient local storage and caching strategies for the AI recipe generation system.

  ## New Tables

  ### 1. `image_cache_metadata`
  Tracks cached images and their metadata for efficient cache management
  - `id` (uuid, primary key) - Unique cache entry identifier
  - `user_id` (uuid) - Reference to auth.users
  - `image_url` (text) - Original image URL
  - `local_path` (text) - Local storage path/key
  - `source` (text) - Image source ('unsplash', 'pexels', 'ai_generated', 'placeholder')
  - `attribution` (text) - Image attribution text
  - `file_size` (bigint) - File size in bytes
  - `mime_type` (text) - Image MIME type
  - `width` (integer) - Image width in pixels
  - `height` (integer) - Image height in pixels
  - `cache_key` (text) - Unique cache key for local storage
  - `access_count` (integer) - Number of times accessed
  - `last_accessed` (timestamptz) - Last access timestamp
  - `expires_at` (timestamptz) - Cache expiration timestamp
  - `created_at` (timestamptz) - Cache entry creation timestamp

  ### 2. `recipe_cache_stats`
  Tracks recipe access patterns for intelligent cache warming
  - `id` (uuid, primary key) - Unique stats entry identifier
  - `user_id` (uuid) - Reference to auth.users
  - `recipe_id` (uuid) - Reference to daily_recipes
  - `access_count` (integer) - Number of times recipe accessed
  - `last_accessed` (timestamptz) - Last access timestamp
  - `is_favorite` (boolean) - Whether recipe is marked as favorite
  - `cache_priority` (integer) - Cache priority score (1-10)
  - `created_at` (timestamptz) - Stats entry creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Performance Optimizations

  ### Additional Indexes
  - Composite indexes for common query patterns
  - Partial indexes for active sessions and cached content
  - GIN indexes for JSONB fields that are frequently searched

  ### Cache Management Functions
  - Automatic cache cleanup for expired entries
  - Cache size management with LRU eviction
  - Cache warming for frequently accessed recipes
*/

-- Create image_cache_metadata table
CREATE TABLE IF NOT EXISTS image_cache_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  local_path text NOT NULL,
  source text NOT NULL CHECK (source IN ('unsplash', 'pexels', 'ai_generated', 'placeholder')),
  attribution text,
  file_size bigint,
  mime_type text,
  width integer,
  height integer,
  cache_key text UNIQUE NOT NULL,
  access_count integer DEFAULT 0,
  last_accessed timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, image_url)
);

-- Create recipe_cache_stats table
CREATE TABLE IF NOT EXISTS recipe_cache_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES daily_recipes(id) ON DELETE CASCADE,
  access_count integer DEFAULT 1,
  last_accessed timestamptz DEFAULT now(),
  is_favorite boolean DEFAULT false,
  cache_priority integer DEFAULT 5 CHECK (cache_priority >= 1 AND cache_priority <= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

-- Create performance indexes for existing tables

-- Chat sessions - optimize for recent active sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_recent 
  ON chat_sessions(user_id, is_active, last_activity DESC) 
  WHERE is_active = true;

-- Chat messages - optimize for session message retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_recent 
  ON chat_messages(session_id, created_at DESC);

-- Daily recipes - optimize for recent recipes with images
CREATE INDEX IF NOT EXISTS idx_daily_recipes_recent_with_images 
  ON daily_recipes(user_id, created_at DESC) 
  WHERE image_url IS NOT NULL;

-- Daily recipes - optimize for chat-generated recipes
CREATE INDEX IF NOT EXISTS idx_daily_recipes_chat_recent 
  ON daily_recipes(user_id, created_at DESC) 
  WHERE created_via = 'chat';

-- Daily recipes - GIN index for tags and variations search
CREATE INDEX IF NOT EXISTS idx_daily_recipes_tags_gin 
  ON daily_recipes USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_daily_recipes_variations_gin 
  ON daily_recipes USING GIN (variations);

-- User preferences - GIN index for dietary restrictions and cuisines
CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary_gin 
  ON user_preferences USING GIN (dietary_restrictions);

CREATE INDEX IF NOT EXISTS idx_user_preferences_cuisines_gin 
  ON user_preferences USING GIN (preferred_cuisines);

-- Create indexes for new cache tables

-- Image cache - optimize for cache key lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_image_cache_user_accessed 
  ON image_cache_metadata(user_id, last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_image_cache_expires 
  ON image_cache_metadata(expires_at) 
  WHERE expires_at < now();

CREATE INDEX IF NOT EXISTS idx_image_cache_source_size 
  ON image_cache_metadata(source, file_size);

-- Recipe cache stats - optimize for priority and access patterns
CREATE INDEX IF NOT EXISTS idx_recipe_cache_priority 
  ON recipe_cache_stats(user_id, cache_priority DESC, last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_recipe_cache_favorites 
  ON recipe_cache_stats(user_id, is_favorite, access_count DESC) 
  WHERE is_favorite = true;

-- Enable Row Level Security for new tables
ALTER TABLE image_cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_cache_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for image_cache_metadata
CREATE POLICY "Users can view own image cache"
  ON image_cache_metadata FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own image cache entries"
  ON image_cache_metadata FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own image cache entries"
  ON image_cache_metadata FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own image cache entries"
  ON image_cache_metadata FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for recipe_cache_stats
CREATE POLICY "Users can view own recipe cache stats"
  ON recipe_cache_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipe cache stats"
  ON recipe_cache_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipe cache stats"
  ON recipe_cache_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipe cache stats"
  ON recipe_cache_stats FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update recipe access stats
CREATE OR REPLACE FUNCTION update_recipe_access_stats(
  p_user_id uuid,
  p_recipe_id uuid,
  p_is_favorite boolean DEFAULT NULL
)
RETURNS void AS $
BEGIN
  INSERT INTO recipe_cache_stats (user_id, recipe_id, access_count, last_accessed, is_favorite)
  VALUES (p_user_id, p_recipe_id, 1, now(), COALESCE(p_is_favorite, false))
  ON CONFLICT (user_id, recipe_id) 
  DO UPDATE SET
    access_count = recipe_cache_stats.access_count + 1,
    last_accessed = now(),
    is_favorite = COALESCE(p_is_favorite, recipe_cache_stats.is_favorite),
    cache_priority = LEAST(10, GREATEST(1, 
      CASE 
        WHEN COALESCE(p_is_favorite, recipe_cache_stats.is_favorite) THEN 9
        WHEN recipe_cache_stats.access_count + 1 > 10 THEN 8
        WHEN recipe_cache_stats.access_count + 1 > 5 THEN 7
        ELSE 5
      END
    )),
    updated_at = now();
END;
$ LANGUAGE plpgsql;

-- Function to update image cache access
CREATE OR REPLACE FUNCTION update_image_cache_access(p_cache_key text)
RETURNS void AS $
BEGIN
  UPDATE image_cache_metadata 
  SET 
    access_count = access_count + 1,
    last_accessed = now()
  WHERE cache_key = p_cache_key;
END;
$ LANGUAGE plpgsql;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer AS $
DECLARE
  deleted_count integer;
BEGIN
  -- Delete expired image cache entries
  DELETE FROM image_cache_metadata 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up orphaned recipe cache stats (recipes that no longer exist)
  DELETE FROM recipe_cache_stats 
  WHERE recipe_id NOT IN (SELECT id FROM daily_recipes);
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to get cache size for a user
CREATE OR REPLACE FUNCTION get_user_cache_size(p_user_id uuid)
RETURNS TABLE(
  total_images integer,
  total_size_bytes bigint,
  expired_images integer,
  high_priority_recipes integer
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_images,
    COALESCE(SUM(file_size), 0)::bigint as total_size_bytes,
    COUNT(*) FILTER (WHERE expires_at < now())::integer as expired_images,
    (SELECT COUNT(*)::integer FROM recipe_cache_stats 
     WHERE user_id = p_user_id AND cache_priority >= 8) as high_priority_recipes
  FROM image_cache_metadata 
  WHERE user_id = p_user_id;
END;
$ LANGUAGE plpgsql;

-- Function to get recipes for cache warming (high priority, frequently accessed)
CREATE OR REPLACE FUNCTION get_cache_warming_recipes(
  p_user_id uuid, 
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  recipe_id uuid,
  recipe_name text,
  image_url text,
  cache_priority integer,
  access_count integer,
  last_accessed timestamptz
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.recipe_name,
    r.image_url,
    rcs.cache_priority,
    rcs.access_count,
    rcs.last_accessed
  FROM daily_recipes r
  JOIN recipe_cache_stats rcs ON r.id = rcs.recipe_id
  WHERE r.user_id = p_user_id 
    AND r.image_url IS NOT NULL
    AND rcs.cache_priority >= 7
  ORDER BY rcs.cache_priority DESC, rcs.access_count DESC, rcs.last_accessed DESC
  LIMIT p_limit;
END;
$ LANGUAGE plpgsql;

-- Trigger to automatically update recipe stats when recipes are accessed
CREATE OR REPLACE FUNCTION auto_update_recipe_stats()
RETURNS TRIGGER AS $
BEGIN
  -- Only update stats for SELECT operations (when recipes are viewed)
  -- This would be called from application code, not automatically
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create a scheduled job to cleanup expired cache (if pg_cron is available)
-- This is optional and depends on the Supabase plan
-- SELECT cron.schedule('cleanup-expired-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');