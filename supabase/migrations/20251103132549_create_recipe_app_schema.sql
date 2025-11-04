/*
  # Recipe App Database Schema

  ## Overview
  This migration creates the database structure for a daily recipe generator app.
  Users get 3 recipes per day (breakfast, lunch, dinner) with dietary restrictions.

  ## New Tables

  ### 1. `user_preferences`
  Stores user settings and API configuration
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Reference to auth.users
  - `api_provider` (text) - 'openai' or 'gemini'
  - `api_key` (text) - Encrypted API key
  - `location` (text) - User's location for seasonal ingredients
  - `timezone` (text) - User's timezone for midnight refresh
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `daily_recipes`
  Stores generated recipes for each day
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Reference to auth.users
  - `recipe_date` (date) - The date these recipes are for
  - `meal_type` (text) - 'breakfast', 'lunch', or 'dinner'
  - `recipe_name` (text) - Name of the recipe
  - `ingredients` (jsonb) - Array of ingredient objects with quantities
  - `instructions` (text) - Step-by-step cooking instructions
  - `prep_time` (integer) - Preparation time in minutes
  - `cook_time` (integer) - Cooking time in minutes
  - `servings` (integer) - Number of servings
  - `estimated_cost` (numeric) - Estimated cost in dollars
  - `nutritional_info` (jsonb) - Nutritional highlights
  - `season` (text) - Season for which recipe was generated
  - `is_favorite` (boolean) - Whether user marked as favorite
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `shopping_list`
  Stores user's shopping list items
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Reference to auth.users
  - `ingredient` (text) - Ingredient name
  - `quantity` (text) - Required quantity
  - `is_checked` (boolean) - Whether item is checked off
  - `recipe_id` (uuid) - Reference to daily_recipes
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Authenticated users only
*/

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_provider text DEFAULT 'openai',
  api_key text,
  location text,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create daily_recipes table
CREATE TABLE IF NOT EXISTS daily_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  recipe_name text NOT NULL,
  ingredients jsonb NOT NULL,
  instructions text NOT NULL,
  prep_time integer NOT NULL,
  cook_time integer NOT NULL,
  servings integer NOT NULL,
  estimated_cost numeric(10, 2),
  nutritional_info jsonb,
  season text,
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_date, meal_type)
);

-- Create shopping_list table
CREATE TABLE IF NOT EXISTS shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient text NOT NULL,
  quantity text NOT NULL,
  is_checked boolean DEFAULT false,
  recipe_id uuid REFERENCES daily_recipes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_recipes_user_date ON daily_recipes(user_id, recipe_date DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user ON shopping_list(user_id, is_checked);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for daily_recipes
CREATE POLICY "Users can view own recipes"
  ON daily_recipes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipes"
  ON daily_recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes"
  ON daily_recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes"
  ON daily_recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for shopping_list
CREATE POLICY "Users can view own shopping list"
  ON shopping_list FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping list items"
  ON shopping_list FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping list items"
  ON shopping_list FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping list items"
  ON shopping_list FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);