# AI Recipe Generation Schema Extensions Summary

## Overview
This document summarizes all the schema extensions that have been implemented to support the AI recipe generation feature with chat functionality, image caching, and performance optimizations.

## Completed Schema Extensions

### 1. Chat-Related Tables (Migration: 20251110000001)

#### `chat_sessions`
- Tracks conversation sessions for recipe generation
- Fields: id, user_id, title, started_at, last_activity, message_count, is_active
- Indexes: user activity, active sessions
- RLS policies: users can only access their own sessions

#### `chat_messages`
- Stores individual messages within chat sessions
- Fields: id, session_id, role, content, voice_input, recipe_id, processing_time
- Indexes: session-based retrieval, voice message filtering
- RLS policies: users can only access messages from their own sessions

### 2. Extended `daily_recipes` Table (Migration: 20251110000001)

#### New AI-Related Fields
- `image_url` - URL to recipe image
- `image_source` - Source of image ('unsplash', 'pexels', 'placeholder', 'ai_generated')
- `image_attribution` - Image attribution text
- `created_via` - How recipe was created ('chat', 'daily', 'manual')
- `chat_session_id` - Reference to originating chat session
- `ai_model_used` - Which AI model generated the recipe
- `difficulty` - Recipe difficulty level ('Easy', 'Medium', 'Hard')
- `cuisine_type` - Type of cuisine
- `tags` - Recipe tags array (JSONB)
- `variations` - Recipe variation suggestions (JSONB)
- `cooking_tips` - Additional cooking tips (JSONB)

#### Dietary Compliance Fields (Migration: 20251110000002)
- `dietary_compliance` - Which dietary restrictions this recipe meets
- `allergen_warnings` - Detected allergens in the recipe
- `nutritional_analysis` - Detailed nutritional breakdown
- `substitution_suggestions` - Suggested ingredient substitutions

### 3. Extended `user_preferences` Table (Migration: 20251110000001)

#### AI Feature Fields
- `subscription_tier` - 'free' or 'premium'
- `preferred_ai_model` - User's preferred AI model
- `voice_enabled` - Whether voice input is enabled
- `image_preferences` - Image source preferences (JSONB)
- `dietary_restrictions` - Detailed dietary restrictions (JSONB)
- `cooking_skill_level` - User's cooking skill level
- `preferred_cuisines` - Preferred cuisine types (JSONB)

#### Enhanced Dietary Fields (Migration: 20251110000002)
- `detailed_dietary_restrictions` - Structured dietary restrictions with reasons
- `allergen_profile` - Detailed allergen sensitivities and severity
- `nutritional_goals` - Specific nutritional targets
- `ingredient_blacklist` - User-specific ingredients to avoid
- `ingredient_preferences` - Preferred ingredients and substitutions
- `dietary_restriction_presets` - Applied preset IDs

#### Extended Dietary Fields (Migration: 20251110000003)
- `dietary_goals` - Specific dietary goals (weight loss, muscle gain, etc.)
- `meal_timing_preferences` - Preferred meal timing and frequency
- `cooking_restrictions` - Equipment, time, or skill limitations
- `cultural_dietary_preferences` - Cultural or religious dietary requirements
- `seasonal_preferences` - Seasonal ingredient preferences
- `budget_constraints` - Budget-related dietary constraints

### 4. Image Caching System (Migration: 20251110000004)

#### `image_cache_metadata`
- Tracks cached images and their metadata for efficient cache management
- Fields: id, user_id, image_url, local_path, source, attribution, file_size, mime_type, width, height, cache_key, access_count, last_accessed, expires_at
- Indexes: cache key lookups, expiration cleanup, source and size optimization
- RLS policies: users can only access their own cached images

#### `recipe_cache_stats`
- Tracks recipe access patterns for intelligent cache warming
- Fields: id, user_id, recipe_id, access_count, last_accessed, is_favorite, cache_priority
- Indexes: priority-based retrieval, favorites filtering
- RLS policies: users can only access their own recipe stats

### 5. Dietary Restriction System (Migration: 20251110000002)

#### `dietary_restriction_presets`
- Predefined dietary restriction templates for common diets
- Pre-populated with: Vegan, Vegetarian, Gluten-Free, Dairy-Free, Keto, Paleo, Low-Sodium, Nut-Free
- Fields: id, name, description, restricted_ingredients, allowed_substitutions, nutritional_focus

#### `allergen_database`
- Comprehensive allergen information for ingredients
- Pre-populated with common allergens: wheat, milk, eggs, peanuts, tree nuts, fish, shellfish, soy, sesame
- Fields: id, ingredient_name, common_allergens, cross_contamination_risk, alternative_names, severity_level

### 6. Performance Optimizations (Migration: 20251110000005)

#### Chat-Specific Indexes
- `idx_chat_messages_session_pagination` - Optimized pagination
- `idx_chat_messages_voice_filter` - Voice message filtering
- `idx_chat_messages_with_recipes` - Recipe-linked messages
- `idx_chat_messages_content_search` - Full-text search on content
- `idx_chat_sessions_user_recent_active` - Active session management
- `idx_daily_recipes_chat_session_recent` - Chat session recipe retrieval
- `idx_daily_recipes_ai_model_performance` - AI model performance tracking

#### Cache Optimization Indexes
- `idx_image_cache_chat_recipes` - Chat-generated recipe images
- `idx_recipe_cache_chat_recommendations` - Chat-based recommendations

## Database Functions

### Chat Management Functions
- `get_chat_session_summary()` - Comprehensive session summary
- `get_chat_messages_paginated()` - Efficient message pagination
- `get_chat_recipe_recommendations()` - Personalized recommendations
- `analyze_chat_session_performance()` - Performance analytics
- `get_user_chat_activity_summary()` - User activity overview
- `search_chat_messages()` - Full-text message search
- `cleanup_inactive_chat_sessions()` - Maintenance function

### Cache Management Functions
- `update_recipe_access_stats()` - Track recipe usage
- `update_image_cache_access()` - Track image cache usage
- `cleanup_expired_cache()` - Remove expired cache entries
- `get_user_cache_size()` - Cache size analytics
- `get_cache_warming_recipes()` - High-priority recipes for caching

### Dietary Analysis Functions
- `check_dietary_compliance()` - Basic compliance checking
- `enhanced_check_dietary_compliance()` - Advanced compliance validation
- `detect_allergens()` - Allergen detection in recipes
- `suggest_substitutions()` - Ingredient substitution suggestions
- `get_comprehensive_dietary_profile()` - Complete user dietary profile
- `validate_recipe_comprehensive()` - Full recipe validation
- `generate_enhanced_dietary_prompt()` - AI prompt generation
- `get_dietary_presets_with_status()` - Preset management

## Database Views

### `chat_sessions_with_stats`
- Efficient view combining chat sessions with aggregated statistics
- Includes recipe count, voice message count, processing times

### `recipe_performance_analytics`
- Analytics view for recipe performance and usage patterns
- Includes access counts, cache priority, image status, chat origin

## Triggers and Automation

### Automatic Updates
- `update_chat_session_activity()` - Updates session activity on new messages
- `generate_session_title()` - Auto-generates session titles from first message
- `update_session_activity_trigger` - Maintains session last activity
- `enhanced_analyze_recipe_dietary_compliance()` - Automatic dietary analysis
- `update_session_last_activity()` - Session activity maintenance

## Row Level Security (RLS)

All new tables have comprehensive RLS policies ensuring:
- Users can only access their own data
- Proper authentication requirements
- Secure cross-table relationships
- Privacy protection for chat history and preferences

## Performance Considerations

### Indexing Strategy
- Composite indexes for common query patterns
- Partial indexes for active sessions and cached content
- GIN indexes for JSONB fields (tags, dietary restrictions, etc.)
- Full-text search indexes for chat content

### Query Optimization
- Efficient pagination for chat messages
- Optimized recipe recommendations
- Fast dietary compliance checking
- Intelligent cache warming

### Maintenance
- Automatic cleanup of expired cache entries
- Session activity tracking
- Performance analytics collection
- Cache size management

## Migration Timeline

1. **20251103132549** - Initial recipe app schema
2. **20251110000001** - AI chat features and extended tables
3. **20251110000002** - Enhanced dietary restrictions system
4. **20251110000003** - Extended dietary restrictions with goals and preferences
5. **20251110000004** - Caching and performance enhancements
6. **20251110000005** - Chat performance optimizations

## Summary

The schema has been comprehensively extended to support:
- ✅ Chat-related tables with full conversation tracking
- ✅ Image caching metadata for efficient local storage
- ✅ Enhanced dietary restrictions and allergen management
- ✅ Performance indexes for chat and recipe operations
- ✅ Comprehensive RLS policies for data security
- ✅ Automated functions for maintenance and analytics
- ✅ Views for efficient data retrieval
- ✅ Triggers for automatic data updates

All requirements for task 9.1 have been fulfilled with additional optimizations for production use.