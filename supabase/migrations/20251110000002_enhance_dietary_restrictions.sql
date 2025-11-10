/*
  # Enhanced Dietary Restrictions Migration

  ## Overview
  This migration enhances the dietary restrictions system to support detailed dietary preferences,
  allergen tracking, and nutritional requirements for the AI recipe generation system.

  ## New Tables

  ### 1. `dietary_restriction_presets`
  Predefined dietary restriction templates for common diets
  - `id` (uuid, primary key) - Unique preset identifier
  - `name` (text) - Preset name (e.g., 'Vegan', 'Gluten-Free')
  - `description` (text) - Description of the dietary restriction
  - `restricted_ingredients` (jsonb) - Array of restricted ingredient patterns
  - `allowed_substitutions` (jsonb) - Common substitution suggestions
  - `nutritional_focus` (jsonb) - Key nutritional considerations
  - `is_active` (boolean) - Whether preset is available for selection

  ### 2. `allergen_database`
  Comprehensive allergen information for ingredients
  - `id` (uuid, primary key) - Unique allergen record identifier
  - `ingredient_name` (text) - Ingredient name (normalized)
  - `common_allergens` (jsonb) - Array of allergens present
  - `cross_contamination_risk` (jsonb) - Potential cross-contamination allergens
  - `alternative_names` (jsonb) - Alternative names for the ingredient
  - `severity_level` (text) - Risk level ('low', 'medium', 'high', 'severe')

  ## Table Extensions

  ### Enhanced `user_preferences` table
  Adds detailed dietary restriction fields:
  - `detailed_dietary_restrictions` (jsonb) - Structured dietary restrictions with reasons
  - `allergen_profile` (jsonb) - Detailed allergen sensitivities and severity
  - `nutritional_goals` (jsonb) - Specific nutritional targets
  - `ingredient_blacklist` (jsonb) - User-specific ingredients to avoid
  - `ingredient_preferences` (jsonb) - Preferred ingredients and substitutions
  - `dietary_restriction_presets` (jsonb) - Applied preset IDs

  ### Enhanced `daily_recipes` table
  Adds dietary compliance tracking:
  - `dietary_compliance` (jsonb) - Which dietary restrictions this recipe meets
  - `allergen_warnings` (jsonb) - Detected allergens in the recipe
  - `nutritional_analysis` (jsonb) - Detailed nutritional breakdown
  - `substitution_suggestions` (jsonb) - Suggested ingredient substitutions
*/

-- Create dietary_restriction_presets table
CREATE TABLE IF NOT EXISTS dietary_restriction_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  restricted_ingredients jsonb DEFAULT '[]'::jsonb,
  allowed_substitutions jsonb DEFAULT '{}'::jsonb,
  nutritional_focus jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create allergen_database table
CREATE TABLE IF NOT EXISTS allergen_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name text NOT NULL,
  common_allergens jsonb DEFAULT '[]'::jsonb,
  cross_contamination_risk jsonb DEFAULT '[]'::jsonb,
  alternative_names jsonb DEFAULT '[]'::jsonb,
  severity_level text DEFAULT 'medium' CHECK (severity_level IN ('low', 'medium', 'high', 'severe')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extend user_preferences table with enhanced dietary features
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS detailed_dietary_restrictions jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS allergen_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS nutritional_goals jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ingredient_blacklist jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ingredient_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS dietary_restriction_presets jsonb DEFAULT '[]'::jsonb;

-- Extend daily_recipes table with dietary compliance tracking
ALTER TABLE daily_recipes
ADD COLUMN IF NOT EXISTS dietary_compliance jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS allergen_warnings jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS nutritional_analysis jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS substitution_suggestions jsonb DEFAULT '[]'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dietary_presets_name ON dietary_restriction_presets(name);
CREATE INDEX IF NOT EXISTS idx_allergen_database_ingredient ON allergen_database(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_allergen_database_allergens ON allergen_database USING GIN(common_allergens);
CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary ON user_preferences USING GIN(detailed_dietary_restrictions);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_compliance ON daily_recipes USING GIN(dietary_compliance);
CREATE INDEX IF NOT EXISTS idx_daily_recipes_allergens ON daily_recipes USING GIN(allergen_warnings);

-- Insert common dietary restriction presets
INSERT INTO dietary_restriction_presets (name, description, restricted_ingredients, allowed_substitutions, nutritional_focus) VALUES
('Vegan', 'Plant-based diet excluding all animal products', 
 '["meat", "chicken", "beef", "pork", "fish", "seafood", "dairy", "milk", "cheese", "butter", "eggs", "honey", "gelatin", "lard"]'::jsonb,
 '{"meat": ["tofu", "tempeh", "seitan", "mushrooms"], "dairy": ["plant milk", "nutritional yeast", "cashew cream"], "eggs": ["flax eggs", "chia eggs", "applesauce"]}'::jsonb,
 '{"protein": "ensure adequate plant protein", "b12": "consider B12 supplementation", "iron": "pair with vitamin C"}'::jsonb),

('Vegetarian', 'Diet excluding meat but allowing dairy and eggs',
 '["meat", "chicken", "beef", "pork", "fish", "seafood", "gelatin", "lard", "chicken stock", "beef stock"]'::jsonb,
 '{"meat": ["eggs", "dairy", "legumes", "nuts"], "stock": ["vegetable stock", "mushroom broth"]}'::jsonb,
 '{"protein": "combine complementary proteins", "iron": "include iron-rich plants"}'::jsonb),

('Gluten-Free', 'Diet excluding gluten-containing grains',
 '["wheat", "barley", "rye", "spelt", "kamut", "triticale", "flour", "bread", "pasta", "soy sauce", "beer"]'::jsonb,
 '{"flour": ["rice flour", "almond flour", "coconut flour"], "pasta": ["rice pasta", "quinoa pasta"], "soy sauce": ["tamari", "coconut aminos"]}'::jsonb,
 '{"fiber": "ensure adequate fiber from gluten-free sources", "b_vitamins": "choose fortified alternatives"}'::jsonb),

('Dairy-Free', 'Diet excluding all dairy products',
 '["milk", "cheese", "butter", "cream", "yogurt", "ice cream", "whey", "casein", "lactose"]'::jsonb,
 '{"milk": ["almond milk", "oat milk", "coconut milk"], "cheese": ["nutritional yeast", "cashew cheese"], "butter": ["olive oil", "coconut oil", "vegan butter"]}'::jsonb,
 '{"calcium": "include calcium-rich alternatives", "vitamin_d": "consider fortified products"}'::jsonb),

('Keto', 'Very low-carb, high-fat diet',
 '["sugar", "bread", "pasta", "rice", "potatoes", "beans", "fruit", "grains", "starchy vegetables"]'::jsonb,
 '{"sugar": ["stevia", "erythritol", "monk fruit"], "pasta": ["zucchini noodles", "shirataki noodles"], "rice": ["cauliflower rice"]}'::jsonb,
 '{"carbs": "limit to 20-50g daily", "fat": "70-80% of calories", "protein": "moderate amounts"}'::jsonb),

('Paleo', 'Diet based on presumed ancient human diet',
 '["grains", "legumes", "dairy", "processed foods", "sugar", "vegetable oils"]'::jsonb,
 '{"grains": ["sweet potatoes", "squash"], "legumes": ["nuts", "seeds"], "dairy": ["coconut milk", "nut milk"]}'::jsonb,
 '{"whole_foods": "focus on unprocessed foods", "omega3": "include fatty fish and nuts"}'::jsonb),

('Low-Sodium', 'Diet restricting sodium intake',
 '["salt", "soy sauce", "processed meats", "canned soups", "pickles", "olives", "cheese"]'::jsonb,
 '{"salt": ["herbs", "spices", "lemon juice"], "soy sauce": ["low-sodium tamari"], "processed meats": ["fresh meats", "poultry"]}'::jsonb,
 '{"potassium": "include potassium-rich foods", "flavor": "use herbs and spices for taste"}'::jsonb),

('Nut-Free', 'Diet excluding tree nuts and peanuts',
 '["almonds", "walnuts", "cashews", "pecans", "pistachios", "hazelnuts", "peanuts", "nut oils", "nut butters"]'::jsonb,
 '{"nuts": ["seeds", "soy butter", "coconut"], "nut milk": ["oat milk", "rice milk", "soy milk"]}'::jsonb,
 '{"protein": "ensure adequate protein from other sources", "healthy_fats": "include seeds and avocado"}'::jsonb);

-- Insert common allergen data
INSERT INTO allergen_database (ingredient_name, common_allergens, cross_contamination_risk, alternative_names, severity_level) VALUES
('wheat', '["gluten", "wheat"]'::jsonb, '["barley", "rye", "oats"]'::jsonb, '["flour", "wheat flour", "whole wheat"]'::jsonb, 'high'),
('milk', '["dairy", "lactose", "casein"]'::jsonb, '["butter", "cheese", "cream"]'::jsonb, '["dairy", "cow milk", "whole milk"]'::jsonb, 'medium'),
('eggs', '["eggs", "albumin"]'::jsonb, '["mayonnaise", "baked goods"]'::jsonb, '["egg whites", "egg yolks", "whole eggs"]'::jsonb, 'medium'),
('peanuts', '["peanuts", "groundnuts"]'::jsonb, '["tree nuts", "seeds"]'::jsonb, '["groundnuts", "monkey nuts"]'::jsonb, 'severe'),
('tree nuts', '["tree nuts", "nuts"]'::jsonb, '["peanuts", "seeds"]'::jsonb, '["almonds", "walnuts", "cashews", "pecans"]'::jsonb, 'severe'),
('fish', '["fish", "seafood"]'::jsonb, '["shellfish", "iodine"]'::jsonb, '["salmon", "tuna", "cod", "halibut"]'::jsonb, 'high'),
('shellfish', '["shellfish", "crustaceans", "mollusks"]'::jsonb, '["fish", "iodine"]'::jsonb, '["shrimp", "crab", "lobster", "oysters"]'::jsonb, 'severe'),
('soy', '["soy", "soybean"]'::jsonb, '["legumes"]'::jsonb, '["tofu", "tempeh", "soy sauce", "edamame"]'::jsonb, 'medium'),
('sesame', '["sesame", "sesame seeds"]'::jsonb, '["tahini", "seeds"]'::jsonb, '["sesame oil", "tahini", "sesame seeds"]'::jsonb, 'high');

-- Function to validate dietary compliance
CREATE OR REPLACE FUNCTION check_dietary_compliance(
  recipe_ingredients jsonb,
  user_restrictions jsonb
) RETURNS jsonb AS $
DECLARE
  compliance_result jsonb := '{"compliant": true, "violations": [], "warnings": []}'::jsonb;
  ingredient jsonb;
  restriction jsonb;
  ingredient_name text;
  restricted_items jsonb;
BEGIN
  -- Check each ingredient against dietary restrictions
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
  LOOP
    ingredient_name := lower(ingredient->>'name');
    
    -- Check against user's detailed dietary restrictions
    FOR restriction IN SELECT * FROM jsonb_array_elements(user_restrictions)
    LOOP
      restricted_items := restriction->'restricted_ingredients';
      
      -- Check if ingredient matches any restricted items
      IF restricted_items ? ingredient_name OR 
         EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(restricted_items) AS restricted_item
           WHERE ingredient_name LIKE '%' || restricted_item || '%'
         ) THEN
        
        compliance_result := jsonb_set(
          compliance_result,
          '{compliant}',
          'false'::jsonb
        );
        
        compliance_result := jsonb_set(
          compliance_result,
          '{violations}',
          (compliance_result->'violations') || jsonb_build_array(
            jsonb_build_object(
              'ingredient', ingredient_name,
              'restriction', restriction->>'name',
              'reason', restriction->>'description'
            )
          )
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN compliance_result;
END;
$ LANGUAGE plpgsql;

-- Function to detect allergens in recipe
CREATE OR REPLACE FUNCTION detect_allergens(recipe_ingredients jsonb) RETURNS jsonb AS $
DECLARE
  allergen_result jsonb := '[]'::jsonb;
  ingredient jsonb;
  ingredient_name text;
  allergen_record RECORD;
BEGIN
  -- Check each ingredient against allergen database
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
  LOOP
    ingredient_name := lower(ingredient->>'name');
    
    -- Find matching allergen records
    FOR allergen_record IN 
      SELECT * FROM allergen_database 
      WHERE ingredient_name = allergen_database.ingredient_name
         OR allergen_database.alternative_names ? ingredient_name
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(alternative_names) AS alt_name
           WHERE ingredient_name LIKE '%' || alt_name || '%'
         )
    LOOP
      -- Add allergen information to result
      allergen_result := allergen_result || jsonb_build_array(
        jsonb_build_object(
          'ingredient', ingredient_name,
          'allergens', allergen_record.common_allergens,
          'severity', allergen_record.severity_level,
          'cross_contamination_risk', allergen_record.cross_contamination_risk
        )
      );
    END LOOP;
  END LOOP;
  
  RETURN allergen_result;
END;
$ LANGUAGE plpgsql;

-- Function to suggest ingredient substitutions
CREATE OR REPLACE FUNCTION suggest_substitutions(
  recipe_ingredients jsonb,
  user_restrictions jsonb
) RETURNS jsonb AS $
DECLARE
  substitution_result jsonb := '[]'::jsonb;
  ingredient jsonb;
  restriction jsonb;
  ingredient_name text;
  preset_record RECORD;
BEGIN
  -- Check each ingredient for possible substitutions
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
  LOOP
    ingredient_name := lower(ingredient->>'name');
    
    -- Check against dietary restriction presets for substitutions
    FOR preset_record IN 
      SELECT * FROM dietary_restriction_presets 
      WHERE is_active = true
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(restricted_ingredients) AS restricted_item
          WHERE ingredient_name LIKE '%' || restricted_item || '%'
        )
    LOOP
      -- Find substitution suggestions
      IF preset_record.allowed_substitutions ? ingredient_name THEN
        substitution_result := substitution_result || jsonb_build_array(
          jsonb_build_object(
            'original_ingredient', ingredient_name,
            'dietary_restriction', preset_record.name,
            'substitutions', preset_record.allowed_substitutions->ingredient_name,
            'reason', preset_record.description
          )
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN substitution_result;
END;
$ LANGUAGE plpgsql;

-- Trigger function to automatically analyze recipes for dietary compliance
CREATE OR REPLACE FUNCTION analyze_recipe_dietary_compliance()
RETURNS TRIGGER AS $
BEGIN
  -- Only analyze if ingredients are present
  IF NEW.ingredients IS NOT NULL AND jsonb_array_length(NEW.ingredients) > 0 THEN
    -- Get user's dietary restrictions
    DECLARE
      user_restrictions jsonb;
    BEGIN
      SELECT COALESCE(detailed_dietary_restrictions, '{}'::jsonb)
      INTO user_restrictions
      FROM user_preferences
      WHERE user_id = NEW.user_id;
      
      -- Analyze dietary compliance
      IF user_restrictions != '{}'::jsonb THEN
        NEW.dietary_compliance := check_dietary_compliance(NEW.ingredients, user_restrictions);
      END IF;
      
      -- Detect allergens
      NEW.allergen_warnings := detect_allergens(NEW.ingredients);
      
      -- Suggest substitutions
      IF user_restrictions != '{}'::jsonb THEN
        NEW.substitution_suggestions := suggest_substitutions(NEW.ingredients, user_restrictions);
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically analyze recipes
CREATE TRIGGER analyze_dietary_compliance_trigger
  BEFORE INSERT OR UPDATE ON daily_recipes
  FOR EACH ROW
  EXECUTE FUNCTION analyze_recipe_dietary_compliance();