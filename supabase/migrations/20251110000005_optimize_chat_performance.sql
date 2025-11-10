/*
  # Chat Performance Optimization Migration

  ## Overview
  This migration adds additional performance optimizations specifically for chat functionality,
  including specialized indexes for chat message retrieval, session management, and 
  recipe-chat relationship queries.

  ## Performance Enhancements

  ### Chat-Specific Indexes
  - Optimized indexes for chat message pagination
  - Session-based recipe retrieval optimization
  - Voice message filtering and search
  - Processing time analytics

  ### Additional Cache Optimizations
  - Chat session cache metadata
  - Message content search optimization
  - Recipe generation performance tracking

  ### Query Optimization Functions
  - Efficient chat history retrieval
  - Session-based recipe recommendations
  - Chat analytics and insights
*/

-- Additional performance indexes for chat functionality

-- Chat messages - optimize for pagination and content search
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_pagination 
  ON chat_messages(session_id, created_at DESC, id);

-- Chat messages - optimize for voice message filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_voice_filter 
  ON chat_messages(session_id, voice_input, created_at DESC) 
  WHERE voice_input = true;

-- Chat messages - optimize for recipe-linked messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_with_recipes 
  ON chat_messages(session_id, created_at DESC) 
  WHERE recipe_id IS NOT NULL;

-- Chat messages - full-text search on content (if needed for search functionality)
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search 
  ON chat_messages USING GIN (to_tsvector('english', content));

-- Chat sessions - optimize for user session management
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_recent_active 
  ON chat_sessions(user_id, last_activity DESC, is_active) 
  WHERE is_active = true AND last_activity > (now() - interval '7 days');

-- Daily recipes - optimize for chat session recipe retrieval
CREATE INDEX IF NOT EXISTS idx_daily_recipes_chat_session_recent 
  ON daily_recipes(chat_session_id, created_at DESC) 
  WHERE chat_session_id IS NOT NULL;

-- Daily recipes - optimize for AI model performance tracking
CREATE INDEX IF NOT EXISTS idx_daily_recipes_ai_model_performance 
  ON daily_recipes(ai_model_used, created_at DESC) 
  WHERE ai_model_used IS NOT NULL;

-- Image cache - optimize for chat-generated recipe images
CREATE INDEX IF NOT EXISTS idx_image_cache_chat_recipes 
  ON image_cache_metadata(user_id, last_accessed DESC) 
  WHERE source IN ('unsplash', 'pexels');

-- Recipe cache stats - optimize for chat-based recommendations
CREATE INDEX IF NOT EXISTS idx_recipe_cache_chat_recommendations 
  ON recipe_cache_stats(user_id, cache_priority DESC, access_count DESC) 
  WHERE cache_priority >= 6;

-- Function to get chat session with message count and latest recipe
CREATE OR REPLACE FUNCTION get_chat_session_summary(p_session_id uuid)
RETURNS TABLE(
  session_id uuid,
  title text,
  message_count integer,
  last_activity timestamptz,
  latest_recipe_id uuid,
  latest_recipe_name text,
  has_voice_messages boolean,
  processing_time_avg numeric
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.title,
    cs.message_count,
    cs.last_activity,
    dr.id as latest_recipe_id,
    dr.recipe_name as latest_recipe_name,
    EXISTS(SELECT 1 FROM chat_messages WHERE session_id = cs.id AND voice_input = true) as has_voice_messages,
    (SELECT AVG(processing_time) FROM chat_messages WHERE session_id = cs.id AND processing_time IS NOT NULL) as processing_time_avg
  FROM chat_sessions cs
  LEFT JOIN daily_recipes dr ON dr.chat_session_id = cs.id
  WHERE cs.id = p_session_id
  ORDER BY dr.created_at DESC
  LIMIT 1;
END;
$ LANGUAGE plpgsql;

-- Function to get paginated chat messages with recipe information
CREATE OR REPLACE FUNCTION get_chat_messages_paginated(
  p_session_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_include_recipes boolean DEFAULT true
)
RETURNS TABLE(
  message_id uuid,
  role text,
  content text,
  voice_input boolean,
  processing_time integer,
  created_at timestamptz,
  recipe_id uuid,
  recipe_name text,
  recipe_image_url text
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.role,
    cm.content,
    cm.voice_input,
    cm.processing_time,
    cm.created_at,
    CASE WHEN p_include_recipes THEN dr.id ELSE NULL END as recipe_id,
    CASE WHEN p_include_recipes THEN dr.recipe_name ELSE NULL END as recipe_name,
    CASE WHEN p_include_recipes THEN dr.image_url ELSE NULL END as recipe_image_url
  FROM chat_messages cm
  LEFT JOIN daily_recipes dr ON cm.recipe_id = dr.id AND p_include_recipes
  WHERE cm.session_id = p_session_id
  ORDER BY cm.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$ LANGUAGE plpgsql;

-- Function to get chat-based recipe recommendations
CREATE OR REPLACE FUNCTION get_chat_recipe_recommendations(
  p_user_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  recipe_id uuid,
  recipe_name text,
  cuisine_type text,
  difficulty text,
  image_url text,
  created_at timestamptz,
  access_count integer,
  is_from_current_session boolean
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.recipe_name,
    dr.cuisine_type,
    dr.difficulty,
    dr.image_url,
    dr.created_at,
    COALESCE(rcs.access_count, 0) as access_count,
    (dr.chat_session_id = p_session_id) as is_from_current_session
  FROM daily_recipes dr
  LEFT JOIN recipe_cache_stats rcs ON dr.id = rcs.recipe_id
  WHERE dr.user_id = p_user_id 
    AND dr.created_via = 'chat'
    AND (p_session_id IS NULL OR dr.chat_session_id != p_session_id OR dr.chat_session_id IS NULL)
  ORDER BY 
    CASE WHEN rcs.is_favorite THEN 1 ELSE 2 END,
    COALESCE(rcs.cache_priority, 5) DESC,
    COALESCE(rcs.access_count, 0) DESC,
    dr.created_at DESC
  LIMIT p_limit;
END;
$ LANGUAGE plpgsql;

-- Function to analyze chat session performance
CREATE OR REPLACE FUNCTION analyze_chat_session_performance(p_session_id uuid)
RETURNS TABLE(
  total_messages integer,
  user_messages integer,
  assistant_messages integer,
  voice_messages integer,
  recipes_generated integer,
  avg_processing_time numeric,
  max_processing_time integer,
  session_duration interval,
  messages_per_hour numeric
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_messages,
    COUNT(*) FILTER (WHERE role = 'user')::integer as user_messages,
    COUNT(*) FILTER (WHERE role = 'assistant')::integer as assistant_messages,
    COUNT(*) FILTER (WHERE voice_input = true)::integer as voice_messages,
    COUNT(DISTINCT recipe_id) FILTER (WHERE recipe_id IS NOT NULL)::integer as recipes_generated,
    AVG(processing_time) FILTER (WHERE processing_time IS NOT NULL) as avg_processing_time,
    MAX(processing_time) FILTER (WHERE processing_time IS NOT NULL) as max_processing_time,
    (MAX(created_at) - MIN(created_at)) as session_duration,
    CASE 
      WHEN EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) > 0 
      THEN COUNT(*)::numeric / (EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600)
      ELSE 0
    END as messages_per_hour
  FROM chat_messages
  WHERE session_id = p_session_id;
END;
$ LANGUAGE plpgsql;

-- Function to get user's chat activity summary
CREATE OR REPLACE FUNCTION get_user_chat_activity_summary(
  p_user_id uuid,
  p_days_back integer DEFAULT 30
)
RETURNS TABLE(
  total_sessions integer,
  active_sessions integer,
  total_messages integer,
  voice_messages integer,
  recipes_generated integer,
  avg_session_length interval,
  most_used_ai_model text,
  favorite_cuisine text
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT cs.id)::integer as total_sessions,
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.is_active = true)::integer as active_sessions,
    COUNT(cm.id)::integer as total_messages,
    COUNT(cm.id) FILTER (WHERE cm.voice_input = true)::integer as voice_messages,
    COUNT(DISTINCT dr.id)::integer as recipes_generated,
    AVG(cs.last_activity - cs.started_at) as avg_session_length,
    (SELECT ai_model_used 
     FROM daily_recipes 
     WHERE user_id = p_user_id AND ai_model_used IS NOT NULL 
       AND created_at > (now() - interval '1 day' * p_days_back)
     GROUP BY ai_model_used 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as most_used_ai_model,
    (SELECT cuisine_type 
     FROM daily_recipes 
     WHERE user_id = p_user_id AND cuisine_type IS NOT NULL 
       AND created_at > (now() - interval '1 day' * p_days_back)
     GROUP BY cuisine_type 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as favorite_cuisine
  FROM chat_sessions cs
  LEFT JOIN chat_messages cm ON cs.id = cm.session_id
  LEFT JOIN daily_recipes dr ON cs.id = dr.chat_session_id
  WHERE cs.user_id = p_user_id 
    AND cs.started_at > (now() - interval '1 day' * p_days_back);
END;
$ LANGUAGE plpgsql;

-- Function to optimize chat message search
CREATE OR REPLACE FUNCTION search_chat_messages(
  p_user_id uuid,
  p_search_query text,
  p_session_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  message_id uuid,
  session_id uuid,
  session_title text,
  role text,
  content text,
  created_at timestamptz,
  recipe_id uuid,
  recipe_name text,
  rank real
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.session_id,
    cs.title,
    cm.role,
    cm.content,
    cm.created_at,
    cm.recipe_id,
    dr.recipe_name,
    ts_rank(to_tsvector('english', cm.content), plainto_tsquery('english', p_search_query)) as rank
  FROM chat_messages cm
  JOIN chat_sessions cs ON cm.session_id = cs.id
  LEFT JOIN daily_recipes dr ON cm.recipe_id = dr.id
  WHERE cs.user_id = p_user_id
    AND (p_session_id IS NULL OR cm.session_id = p_session_id)
    AND to_tsvector('english', cm.content) @@ plainto_tsquery('english', p_search_query)
  ORDER BY rank DESC, cm.created_at DESC
  LIMIT p_limit;
END;
$ LANGUAGE plpgsql;

-- Function to clean up inactive chat sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_chat_sessions(p_days_inactive integer DEFAULT 90)
RETURNS integer AS $
DECLARE
  deleted_count integer;
BEGIN
  -- Mark sessions as inactive if no activity for specified days
  UPDATE chat_sessions 
  SET is_active = false 
  WHERE is_active = true 
    AND last_activity < (now() - interval '1 day' * p_days_inactive);
  
  -- Optionally delete very old inactive sessions (uncomment if needed)
  -- DELETE FROM chat_sessions 
  -- WHERE is_active = false 
  --   AND last_activity < (now() - interval '1 day' * (p_days_inactive * 2));
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Create a view for efficient chat session listing
CREATE OR REPLACE VIEW chat_sessions_with_stats AS
SELECT 
  cs.id,
  cs.user_id,
  cs.title,
  cs.started_at,
  cs.last_activity,
  cs.message_count,
  cs.is_active,
  COUNT(DISTINCT dr.id) as recipe_count,
  COUNT(cm.id) FILTER (WHERE cm.voice_input = true) as voice_message_count,
  MAX(dr.created_at) as latest_recipe_created,
  AVG(cm.processing_time) FILTER (WHERE cm.processing_time IS NOT NULL) as avg_processing_time
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
LEFT JOIN daily_recipes dr ON cs.id = dr.chat_session_id
GROUP BY cs.id, cs.user_id, cs.title, cs.started_at, cs.last_activity, cs.message_count, cs.is_active;

-- Create a view for recipe performance analytics
CREATE OR REPLACE VIEW recipe_performance_analytics AS
SELECT 
  dr.id,
  dr.user_id,
  dr.recipe_name,
  dr.created_via,
  dr.ai_model_used,
  dr.cuisine_type,
  dr.difficulty,
  dr.created_at,
  COALESCE(rcs.access_count, 0) as access_count,
  COALESCE(rcs.cache_priority, 5) as cache_priority,
  rcs.is_favorite,
  rcs.last_accessed,
  CASE 
    WHEN dr.image_url IS NOT NULL THEN true 
    ELSE false 
  END as has_image,
  CASE 
    WHEN dr.chat_session_id IS NOT NULL THEN true 
    ELSE false 
  END as from_chat,
  jsonb_array_length(COALESCE(dr.tags, '[]'::jsonb)) as tag_count,
  jsonb_array_length(COALESCE(dr.variations, '[]'::jsonb)) as variation_count
FROM daily_recipes dr
LEFT JOIN recipe_cache_stats rcs ON dr.id = rcs.recipe_id;

-- Add a trigger to automatically update session activity on message insert
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $
BEGIN
  UPDATE chat_sessions 
  SET last_activity = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger for automatic session activity updates
DROP TRIGGER IF EXISTS update_session_activity_on_message ON chat_messages;
CREATE TRIGGER update_session_activity_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_activity();

-- Add helpful comments for documentation
COMMENT ON FUNCTION get_chat_session_summary(uuid) IS 'Returns comprehensive summary of a chat session including message count, latest recipe, and performance metrics';
COMMENT ON FUNCTION get_chat_messages_paginated(uuid, integer, integer, boolean) IS 'Efficiently retrieves paginated chat messages with optional recipe information';
COMMENT ON FUNCTION get_chat_recipe_recommendations(uuid, uuid, integer) IS 'Provides personalized recipe recommendations based on chat history and user preferences';
COMMENT ON FUNCTION analyze_chat_session_performance(uuid) IS 'Analyzes performance metrics for a specific chat session';
COMMENT ON FUNCTION get_user_chat_activity_summary(uuid, integer) IS 'Provides comprehensive user activity summary across all chat sessions';
COMMENT ON FUNCTION search_chat_messages(uuid, text, uuid, integer) IS 'Full-text search across user chat messages with ranking';
COMMENT ON FUNCTION cleanup_inactive_chat_sessions(integer) IS 'Maintenance function to clean up inactive chat sessions';

COMMENT ON VIEW chat_sessions_with_stats IS 'Efficient view combining chat sessions with aggregated statistics';
COMMENT ON VIEW recipe_performance_analytics IS 'Analytics view for recipe performance and usage patterns';