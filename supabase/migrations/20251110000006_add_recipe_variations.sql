-- Add recipe variations table for tracking recipe modifications and alternatives
CREATE TABLE IF NOT EXISTS recipe_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_recipe_id UUID NOT NULL REFERENCES daily_recipes(id) ON DELETE CASCADE,
    variation_name TEXT NOT NULL,
    variation_description TEXT,
    recipe_data JSONB NOT NULL,
    created_via TEXT CHECK (created_via IN ('chat', 'manual')) DEFAULT 'manual',
    chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipe_variations_user_id ON recipe_variations(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_variations_original_recipe_id ON recipe_variations(original_recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_variations_chat_session_id ON recipe_variations(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_recipe_variations_created_at ON recipe_variations(created_at);

-- Add RLS policies
ALTER TABLE recipe_variations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own recipe variations
CREATE POLICY "Users can view their own recipe variations" ON recipe_variations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipe variations" ON recipe_variations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipe variations" ON recipe_variations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipe variations" ON recipe_variations
    FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_recipe_variations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_variations_updated_at
    BEFORE UPDATE ON recipe_variations
    FOR EACH ROW
    EXECUTE FUNCTION update_recipe_variations_updated_at();

-- Add some helpful views
CREATE OR REPLACE VIEW recipe_variations_with_original AS
SELECT 
    rv.*,
    dr.recipe_name as original_recipe_name,
    dr.cuisine_type as original_cuisine_type,
    dr.difficulty as original_difficulty
FROM recipe_variations rv
JOIN daily_recipes dr ON rv.original_recipe_id = dr.id;

-- Add function to get recipe modification history
CREATE OR REPLACE FUNCTION get_recipe_modification_history(recipe_id UUID)
RETURNS TABLE (
    variation_id UUID,
    variation_name TEXT,
    variation_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    created_via TEXT,
    chat_session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rv.id,
        rv.variation_name,
        rv.variation_description,
        rv.created_at,
        rv.created_via,
        rv.chat_session_id
    FROM recipe_variations rv
    WHERE rv.original_recipe_id = recipe_id
    ORDER BY rv.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to count variations per recipe
CREATE OR REPLACE FUNCTION count_recipe_variations(recipe_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM recipe_variations
        WHERE original_recipe_id = recipe_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;