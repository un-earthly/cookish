/*
  # Extended Dietary Restrictions System Migration

  ## Overview
  This migration extends the existing dietary restrictions system to support more detailed
  dietary preferences, enhanced validation, and better integration with chat-generated recipes.

  ## Enhancements

  ### 1. Enhanced `user_preferences` table
  Adds more detailed dietary restriction fields:
  - `dietary_goals` (jsonb) - Specific dietary goals (weight loss, muscle gain, etc.)
  - `meal_timing_preferences` (jsonb) - Preferred meal timing and frequency
  - `cooking_restrictions` (jsonb) - Equipment, time, or skill limitations
  - `cultural_dietary_preferences` (jsonb) - Cultural or religious dietary requirements
  - `seasonal_preferences` (jsonb) - Seasonal ingredient preferences
  - `budget_constraints` (jsonb) - Budget-related dietary constraints

  ### 2. Enhanced dietary validation functions
  Improves existing validation functions with better accuracy and performance

  ### 3. Recipe generation integration
  Better integration with chat-based recipe generation
*/

-- Extend user_preferences table with additional dietary fields
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS dietary_goals jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS meal_timing_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cooking_restrictions jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cultural_dietary_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seasonal_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS budget_constraints jsonb DEFAULT '{}'::jsonb;

-- Create indexes for better query performance on new fields
CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary_goals ON user_preferences USING GIN(dietary_goals);
CREATE INDEX IF NOT EXISTS idx_user_preferences_cultural_dietary ON user_preferences USING GIN(cultural_dietary_preferences);
CREATE INDEX IF NOT EXISTS idx_user_preferences_cooking_restrictions ON user_preferences USING GIN(cooking_restrictions);

-- Enhanced dietary compliance validation function
CREATE OR REPLACE FUNCTION enhanced_check_dietary_compliance(
  recipe_ingredients jsonb,
  user_restrictions jsonb,
  user_allergen_profile jsonb DEFAULT '{}'::jsonb,
  user_blacklist jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb AS $
DECLARE
  compliance_result jsonb := '{"compliant": true, "violations": [], "warnings": [], "suggestions": []}'::jsonb;
  ingredient jsonb;
  restriction jsonb;
  ingredient_name text;
  restricted_items jsonb;
  allergen_record RECORD;
  preset_record RECORD;
BEGIN
  -- Check each ingredient against dietary restrictions
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
  LOOP
    ingredient_name := lower(ingredient->>'name');
    
    -- Check against ingredient blacklist
    IF user_blacklist ? ingredient_name OR 
       EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(user_blacklist) AS blacklisted_item
         WHERE ingredient_name LIKE '%' || blacklisted_item || '%'
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
            'restriction', 'Blacklisted ingredient',
            'reason', 'This ingredient is in your personal blacklist',
            'severity', 'strict'
          )
        )
      );
    END IF;

    -- Check against detailed dietary restrictions
    FOR restriction IN SELECT * FROM jsonb_each(user_restrictions)
    LOOP
      -- Find matching dietary restriction preset
      SELECT * INTO preset_record
      FROM dietary_restriction_presets 
      WHERE name = restriction.key AND is_active = true;
      
      IF FOUND THEN
        restricted_items := preset_record.restricted_ingredients;
        
        -- Check if ingredient matches any restricted items
        IF restricted_items ? ingredient_name OR 
           EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(restricted_items) AS restricted_item
             WHERE ingredient_name LIKE '%' || restricted_item || '%'
           ) THEN
          
          -- Check severity level
          IF (restriction.value->>'severity') = 'strict' THEN
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
                  'restriction', restriction.key,
                  'reason', restriction.value->>'reason',
                  'severity', 'strict'
                )
              )
            );
          ELSE
            compliance_result := jsonb_set(
              compliance_result,
              '{warnings}',
              (compliance_result->'warnings') || jsonb_build_array(
                jsonb_build_object(
                  'ingredient', ingredient_name,
                  'concern', 'May not align with ' || restriction.key || ' diet',
                  'suggestion', 'Consider substituting with alternatives',
                  'severity', COALESCE(restriction.value->>'severity', 'moderate')
                )
              )
            );
          END IF;
          
          -- Add substitution suggestions
          IF preset_record.allowed_substitutions ? ingredient_name THEN
            compliance_result := jsonb_set(
              compliance_result,
              '{suggestions}',
              (compliance_result->'suggestions') || jsonb_build_array(
                jsonb_build_object(
                  'original_ingredient', ingredient_name,
                  'alternatives', preset_record.allowed_substitutions->ingredient_name,
                  'reason', 'Compliant with ' || restriction.key || ' diet'
                )
              )
            );
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Check against allergen profile
    FOR allergen_record IN 
      SELECT * FROM allergen_database 
      WHERE ingredient_name = allergen_database.ingredient_name
         OR allergen_database.alternative_names ? ingredient_name
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(alternative_names) AS alt_name
           WHERE ingredient_name LIKE '%' || alt_name || '%'
         )
    LOOP
      -- Check each allergen against user profile
      FOR restriction IN SELECT * FROM jsonb_array_elements(allergen_record.common_allergens)
      LOOP
        IF user_allergen_profile ? (restriction #>> '{}') THEN
          DECLARE
            user_allergen_severity text := user_allergen_profile->(restriction #>> '{}')->>'severity';
          BEGIN
            IF user_allergen_severity IN ('severe', 'life_threatening') THEN
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
                    'restriction', 'Allergen: ' || (restriction #>> '{}'),
                    'reason', 'Severe allergen detected',
                    'severity', 'critical'
                  )
                )
              );
            ELSE
              compliance_result := jsonb_set(
                compliance_result,
                '{warnings}',
                (compliance_result->'warnings') || jsonb_build_array(
                  jsonb_build_object(
                    'ingredient', ingredient_name,
                    'concern', 'Contains allergen: ' || (restriction #>> '{}'),
                    'suggestion', 'Use with caution or substitute',
                    'severity', user_allergen_severity
                  )
                )
              );
            END IF;
          END;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RETURN compliance_result;
END;
$ LANGUAGE plpgsql;

-- Function to get comprehensive dietary profile for recipe generation
CREATE OR REPLACE FUNCTION get_comprehensive_dietary_profile(user_id_param uuid)
RETURNS jsonb AS $
DECLARE
  profile jsonb := '{}'::jsonb;
  user_prefs RECORD;
  applied_presets jsonb := '[]'::jsonb;
  preset_record RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO user_prefs
  FROM user_preferences
  WHERE user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN profile;
  END IF;
  
  -- Build comprehensive profile
  profile := jsonb_build_object(
    'detailed_dietary_restrictions', COALESCE(user_prefs.detailed_dietary_restrictions, '{}'::jsonb),
    'allergen_profile', COALESCE(user_prefs.allergen_profile, '{}'::jsonb),
    'nutritional_goals', COALESCE(user_prefs.nutritional_goals, '{}'::jsonb),
    'ingredient_blacklist', COALESCE(user_prefs.ingredient_blacklist, '[]'::jsonb),
    'ingredient_preferences', COALESCE(user_prefs.ingredient_preferences, '{}'::jsonb),
    'dietary_goals', COALESCE(user_prefs.dietary_goals, '{}'::jsonb),
    'cultural_dietary_preferences', COALESCE(user_prefs.cultural_dietary_preferences, '{}'::jsonb),
    'cooking_restrictions', COALESCE(user_prefs.cooking_restrictions, '{}'::jsonb),
    'budget_constraints', COALESCE(user_prefs.budget_constraints, '{}'::jsonb)
  );
  
  -- Get applied preset details
  IF user_prefs.dietary_restriction_presets IS NOT NULL THEN
    FOR preset_record IN 
      SELECT * FROM dietary_restriction_presets 
      WHERE id = ANY(SELECT jsonb_array_elements_text(user_prefs.dietary_restriction_presets)::uuid)
        AND is_active = true
    LOOP
      applied_presets := applied_presets || jsonb_build_array(
        jsonb_build_object(
          'id', preset_record.id,
          'name', preset_record.name,
          'description', preset_record.description,
          'restricted_ingredients', preset_record.restricted_ingredients,
          'allowed_substitutions', preset_record.allowed_substitutions,
          'nutritional_focus', preset_record.nutritional_focus
        )
      );
    END LOOP;
  END IF;
  
  profile := jsonb_set(profile, '{applied_presets}', applied_presets);
  
  RETURN profile;
END;
$ LANGUAGE plpgsql;

-- Function to validate recipe against comprehensive dietary profile
CREATE OR REPLACE FUNCTION validate_recipe_comprehensive(
  recipe_ingredients jsonb,
  user_id_param uuid
) RETURNS jsonb AS $
DECLARE
  dietary_profile jsonb;
  validation_result jsonb;
BEGIN
  -- Get comprehensive dietary profile
  dietary_profile := get_comprehensive_dietary_profile(user_id_param);
  
  -- Perform enhanced validation
  validation_result := enhanced_check_dietary_compliance(
    recipe_ingredients,
    dietary_profile->'detailed_dietary_restrictions',
    dietary_profile->'allergen_profile',
    dietary_profile->'ingredient_blacklist'
  );
  
  -- Add additional context from profile
  validation_result := jsonb_set(
    validation_result,
    '{dietary_profile_applied}',
    'true'::jsonb
  );
  
  validation_result := jsonb_set(
    validation_result,
    '{applied_restrictions}',
    jsonb_object_keys(dietary_profile->'detailed_dietary_restrictions')
  );
  
  RETURN validation_result;
END;
$ LANGUAGE plpgsql;

-- Enhanced trigger function for automatic recipe analysis
CREATE OR REPLACE FUNCTION enhanced_analyze_recipe_dietary_compliance()
RETURNS TRIGGER AS $
BEGIN
  -- Only analyze if ingredients are present
  IF NEW.ingredients IS NOT NULL AND jsonb_array_length(NEW.ingredients) > 0 THEN
    DECLARE
      validation_result jsonb;
    BEGIN
      -- Use comprehensive validation
      validation_result := validate_recipe_comprehensive(NEW.ingredients, NEW.user_id);
      
      -- Update recipe with validation results
      NEW.dietary_compliance := validation_result;
      
      -- Extract specific fields for easier querying
      NEW.allergen_warnings := COALESCE(validation_result->'warnings', '[]'::jsonb);
      NEW.substitution_suggestions := COALESCE(validation_result->'suggestions', '[]'::jsonb);
      
      -- Add compliance score for sorting/filtering
      DECLARE
        compliance_score numeric := 1.0;
        violation_count integer := jsonb_array_length(COALESCE(validation_result->'violations', '[]'::jsonb));
        warning_count integer := jsonb_array_length(COALESCE(validation_result->'warnings', '[]'::jsonb));
      BEGIN
        -- Calculate compliance score (1.0 = fully compliant, 0.0 = major violations)
        IF violation_count > 0 THEN
          compliance_score := compliance_score - (violation_count * 0.3);
        END IF;
        
        IF warning_count > 0 THEN
          compliance_score := compliance_score - (warning_count * 0.1);
        END IF;
        
        compliance_score := GREATEST(compliance_score, 0.0);
        
        -- Store compliance score in tags for easy filtering
        NEW.tags := COALESCE(NEW.tags, '[]'::jsonb) || 
                   jsonb_build_array('compliance_score:' || compliance_score::text);
      END;
    END;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Replace the existing trigger with enhanced version
DROP TRIGGER IF EXISTS analyze_dietary_compliance_trigger ON daily_recipes;
CREATE TRIGGER enhanced_analyze_dietary_compliance_trigger
  BEFORE INSERT OR UPDATE ON daily_recipes
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_analyze_recipe_dietary_compliance();

-- Function to get dietary restriction presets with user application status
CREATE OR REPLACE FUNCTION get_dietary_presets_with_status(user_id_param uuid)
RETURNS jsonb AS $
DECLARE
  result jsonb := '[]'::jsonb;
  preset_record RECORD;
  user_applied_presets jsonb;
BEGIN
  -- Get user's applied presets
  SELECT COALESCE(dietary_restriction_presets, '[]'::jsonb) 
  INTO user_applied_presets
  FROM user_preferences 
  WHERE user_id = user_id_param;
  
  -- Get all active presets with application status
  FOR preset_record IN 
    SELECT * FROM dietary_restriction_presets 
    WHERE is_active = true 
    ORDER BY name
  LOOP
    result := result || jsonb_build_array(
      jsonb_build_object(
        'id', preset_record.id,
        'name', preset_record.name,
        'description', preset_record.description,
        'restricted_ingredients', preset_record.restricted_ingredients,
        'allowed_substitutions', preset_record.allowed_substitutions,
        'nutritional_focus', preset_record.nutritional_focus,
        'is_applied', user_applied_presets ? preset_record.id::text,
        'created_at', preset_record.created_at,
        'updated_at', preset_record.updated_at
      )
    );
  END LOOP;
  
  RETURN result;
END;
$ LANGUAGE plpgsql;

-- Insert additional dietary restriction presets for better coverage
INSERT INTO dietary_restriction_presets (name, description, restricted_ingredients, allowed_substitutions, nutritional_focus) VALUES
('Mediterranean', 'Mediterranean diet emphasizing whole foods, healthy fats, and moderate wine consumption',
 '["processed foods", "refined sugar", "red meat", "butter", "processed grains"]'::jsonb,
 '{"red meat": ["fish", "poultry", "legumes"], "butter": ["olive oil", "avocado oil"], "refined sugar": ["honey", "dates", "fresh fruit"]}'::jsonb,
 '{"healthy_fats": "emphasize olive oil and nuts", "omega3": "include fatty fish", "antioxidants": "focus on colorful vegetables"}'::jsonb),

('DASH', 'Dietary Approaches to Stop Hypertension - low sodium, high potassium diet',
 '["high sodium foods", "processed meats", "canned soups", "pickled foods", "fast food"]'::jsonb,
 '{"salt": ["herbs", "spices", "lemon juice", "garlic"], "processed meats": ["fresh lean meats", "poultry", "fish"]}'::jsonb,
 '{"sodium": "limit to 2300mg daily", "potassium": "include potassium-rich foods", "fiber": "emphasize whole grains"}'::jsonb),

('Low-FODMAP', 'Diet for managing IBS and digestive issues by limiting fermentable carbohydrates',
 '["garlic", "onions", "wheat", "beans", "apples", "milk", "honey", "high fructose corn syrup"]'::jsonb,
 '{"garlic": ["garlic oil", "asafoetida"], "onions": ["green onion tops", "chives"], "wheat": ["rice", "quinoa", "oats"]}'::jsonb,
 '{"digestive_health": "reduce fermentable carbs", "fiber": "choose low-FODMAP fiber sources"}'::jsonb),

('Anti-Inflammatory', 'Diet focused on reducing inflammation through food choices',
 '["processed foods", "refined sugar", "trans fats", "excessive omega-6 oils", "red meat", "alcohol"]'::jsonb,
 '{"refined sugar": ["berries", "cherries"], "red meat": ["fatty fish", "plant proteins"], "processed foods": ["whole foods", "fresh ingredients"]}'::jsonb,
 '{"omega3": "emphasize anti-inflammatory fats", "antioxidants": "include colorful fruits and vegetables", "polyphenols": "add herbs and spices"}'::jsonb),

('Diabetic-Friendly', 'Diet for managing blood sugar levels and diabetes',
 '["refined sugar", "white bread", "white rice", "sugary drinks", "processed snacks", "high glycemic foods"]'::jsonb,
 '{"white rice": ["brown rice", "quinoa", "cauliflower rice"], "sugar": ["stevia", "monk fruit"], "white bread": ["whole grain bread", "almond flour bread"]}'::jsonb,
 '{"blood_sugar": "focus on low glycemic index foods", "fiber": "include high fiber foods", "protein": "balance with lean proteins"}'::jsonb),

('Heart-Healthy', 'Diet for cardiovascular health and cholesterol management',
 '["trans fats", "saturated fats", "high sodium foods", "processed meats", "refined carbs"]'::jsonb,
 '{"saturated fats": ["olive oil", "avocado", "nuts"], "processed meats": ["lean fish", "poultry", "plant proteins"]}'::jsonb,
 '{"healthy_fats": "emphasize monounsaturated fats", "fiber": "include soluble fiber", "omega3": "regular fatty fish consumption"}'::jsonb);

-- Create function to generate enhanced dietary prompt for AI
CREATE OR REPLACE FUNCTION generate_enhanced_dietary_prompt(user_id_param uuid)
RETURNS text AS $
DECLARE
  dietary_profile jsonb;
  prompt_parts text[] := ARRAY[]::text[];
  restriction_record RECORD;
  preset_record RECORD;
  final_prompt text := '';
BEGIN
  -- Get comprehensive dietary profile
  dietary_profile := get_comprehensive_dietary_profile(user_id_param);
  
  -- Add strict dietary restrictions
  FOR restriction_record IN 
    SELECT key, value FROM jsonb_each(dietary_profile->'detailed_dietary_restrictions')
    WHERE (value->>'severity') = 'strict'
  LOOP
    prompt_parts := array_append(prompt_parts, 
      'MUST be ' || restriction_record.key || '-compliant (' || (restriction_record.value->>'reason') || ')');
  END LOOP;
  
  -- Add allergen warnings
  FOR restriction_record IN 
    SELECT key, value FROM jsonb_each(dietary_profile->'allergen_profile')
    WHERE (value->>'severity') IN ('severe', 'life_threatening')
  LOOP
    prompt_parts := array_append(prompt_parts, 
      'CRITICAL: Must be completely free of ' || restriction_record.key || ' - severe allergy risk');
  END LOOP;
  
  -- Add ingredient blacklist
  IF jsonb_array_length(dietary_profile->'ingredient_blacklist') > 0 THEN
    prompt_parts := array_append(prompt_parts, 
      'Avoid these ingredients: ' || 
      (SELECT string_agg(value #>> '{}', ', ') 
       FROM jsonb_array_elements(dietary_profile->'ingredient_blacklist')));
  END IF;
  
  -- Add nutritional goals
  IF (dietary_profile->'nutritional_goals'->>'daily_calories') IS NOT NULL THEN
    prompt_parts := array_append(prompt_parts, 
      'Target approximately ' || 
      (COALESCE((dietary_profile->'nutritional_goals'->>'daily_calories')::integer / 3, 600))::text || 
      ' calories per serving');
  END IF;
  
  -- Add cultural preferences
  FOR restriction_record IN 
    SELECT key, value FROM jsonb_each(dietary_profile->'cultural_dietary_preferences')
  LOOP
    prompt_parts := array_append(prompt_parts, 
      'Cultural requirement: ' || restriction_record.key || ' (' || (restriction_record.value->>'description') || ')');
  END LOOP;
  
  -- Add cooking restrictions
  IF (dietary_profile->'cooking_restrictions'->>'max_cook_time') IS NOT NULL THEN
    prompt_parts := array_append(prompt_parts, 
      'Maximum cooking time: ' || (dietary_profile->'cooking_restrictions'->>'max_cook_time') || ' minutes');
  END IF;
  
  -- Add budget constraints
  IF (dietary_profile->'budget_constraints'->>'max_cost_per_serving') IS NOT NULL THEN
    prompt_parts := array_append(prompt_parts, 
      'Budget limit: $' || (dietary_profile->'budget_constraints'->>'max_cost_per_serving') || ' per serving');
  END IF;
  
  -- Construct final prompt
  IF array_length(prompt_parts, 1) > 0 THEN
    final_prompt := E'\n\nDIETARY REQUIREMENTS: ' || array_to_string(prompt_parts, '. ') || '.';
  END IF;
  
  RETURN final_prompt;
END;
$ LANGUAGE plpgsql;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_recipes_compliance_score ON daily_recipes USING GIN(tags) WHERE tags ? 'compliance_score';
CREATE INDEX IF NOT EXISTS idx_daily_recipes_dietary_violations ON daily_recipes USING GIN(dietary_compliance) WHERE (dietary_compliance->>'compliant')::boolean = false;

-- Update existing recipes to use enhanced analysis (optional - can be run separately)
-- UPDATE daily_recipes SET updated_at = now() WHERE created_at > now() - interval '30 days';