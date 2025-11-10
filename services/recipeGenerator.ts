import { MealType, Recipe, Season, ApiProvider } from '@/types/recipe';

const DIETARY_RESTRICTIONS = [
  'No rice',
  'No chicken',
  'No red meat (beef, lamb, pork)',
  'No lentils',
  'No chickpeas',
];

const ALLOWED_FOODS = [
  'fish',
  'eggs',
  'vegetables',
  'fruits',
  'dairy',
  'alternative grains (quinoa, bulgur, couscous, barley, oats)',
];

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

export function buildRecipePrompt(
  mealType: MealType,
  season: Season,
  location: string
): string {
  return `Generate a ${mealType} recipe that meets these criteria:

STRICT DIETARY RESTRICTIONS (MUST FOLLOW):
${DIETARY_RESTRICTIONS.map((r) => `- ${r}`).join('\n')}

ALLOWED INGREDIENTS:
${ALLOWED_FOODS.map((f) => `- ${f}`).join('\n')}

REQUIREMENTS:
- Uses seasonal ingredients for ${season} in ${location}
- Easy to prepare (under 30 minutes total time)
- Budget-friendly (estimated cost under $15)
- Nutritionally balanced
- Simple ingredients commonly found in grocery stores

RESPONSE FORMAT (must be valid JSON):
{
  "recipe_name": "Name of the recipe",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount with unit"}
  ],
  "instructions": "Step-by-step instructions as a single string with numbered steps",
  "prep_time": number (in minutes),
  "cook_time": number (in minutes),
  "servings": number,
  "estimated_cost": number (in dollars),
  "nutritional_info": {
    "calories": number (per serving),
    "protein": "amount in grams",
    "carbs": "amount in grams",
    "fats": "amount in grams",
    "highlights": "brief nutritional highlights"
  }
}

Return ONLY the JSON object, no additional text.`;
}

export function buildPremiumRecipePrompt(
  mealType: MealType,
  season: Season,
  location: string
): string {
  return `Generate a premium ${mealType} recipe with enhanced features that meets these criteria:

STRICT DIETARY RESTRICTIONS (MUST FOLLOW):
${DIETARY_RESTRICTIONS.map((r) => `- ${r}`).join('\n')}

ALLOWED INGREDIENTS:
${ALLOWED_FOODS.map((f) => `- ${f}`).join('\n')}

REQUIREMENTS:
- Uses seasonal ingredients for ${season} in ${location}
- Can be any complexity level (beginner to advanced)
- Budget flexible (can include premium ingredients)
- Nutritionally optimized with detailed analysis
- Include cooking techniques and professional tips
- Provide recipe variations and substitutions
- Add cultural context and pairing suggestions

RESPONSE FORMAT (must be valid JSON):
{
  "recipe_name": "Creative and appealing recipe name",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount with unit", "notes": "optional preparation notes"}
  ],
  "instructions": "Detailed step-by-step instructions with techniques explained",
  "prep_time": number (in minutes),
  "cook_time": number (in minutes),
  "servings": number,
  "estimated_cost": number (in dollars),
  "difficulty": "Easy|Medium|Hard",
  "cuisine_type": "Type of cuisine (e.g., Italian, Asian, Mediterranean)",
  "nutritional_info": {
    "calories": number (per serving),
    "protein": "amount in grams",
    "carbs": "amount in grams",
    "fats": "amount in grams",
    "fiber": "amount in grams",
    "sodium": "amount in mg",
    "highlights": "detailed nutritional benefits and highlights"
  },
  "tags": ["tag1", "tag2", "tag3"] (e.g., "quick", "healthy", "comfort-food"),
  "variations": ["variation 1", "variation 2"] (alternative preparations or ingredients),
  "cooking_tips": ["tip 1", "tip 2", "tip 3"] (professional cooking techniques and advice)
}

Return ONLY the JSON object, no additional text.`;
}

export async function generateRecipeWithOpenAI(
  apiKey: string,
  mealType: MealType,
  season: Season,
  location: string
): Promise<Partial<Recipe>> {
  const prompt = buildRecipePrompt(mealType, season, location);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a culinary expert that creates simple, delicious recipes. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate recipe');
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from OpenAI');
  }

  const recipeData = JSON.parse(jsonMatch[0]);

  return {
    recipe_name: recipeData.recipe_name,
    ingredients: recipeData.ingredients,
    instructions: recipeData.instructions,
    prep_time: recipeData.prep_time,
    cook_time: recipeData.cook_time,
    servings: recipeData.servings,
    estimated_cost: recipeData.estimated_cost,
    nutritional_info: recipeData.nutritional_info,
    season,
    meal_type: mealType,
  };
}

export async function generateRecipeWithGemini(
  apiKey: string,
  mealType: MealType,
  season: Season,
  location: string
): Promise<Partial<Recipe>> {
  const prompt = buildRecipePrompt(mealType, season, location);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || 'Failed to generate recipe with Gemini'
    );
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text.trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini');
  }

  const recipeData = JSON.parse(jsonMatch[0]);

  return {
    recipe_name: recipeData.recipe_name,
    ingredients: recipeData.ingredients,
    instructions: recipeData.instructions,
    prep_time: recipeData.prep_time,
    cook_time: recipeData.cook_time,
    servings: recipeData.servings,
    estimated_cost: recipeData.estimated_cost,
    nutritional_info: recipeData.nutritional_info,
    season,
    meal_type: mealType,
  };
}

export async function generateRecipeWithClaude(
  apiKey: string,
  mealType: MealType,
  season: Season,
  location: string,
  isPremium: boolean = false
): Promise<Partial<Recipe>> {
  const prompt = isPremium
    ? buildPremiumRecipePrompt(mealType, season, location)
    : buildRecipePrompt(mealType, season, location);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate recipe with Claude');
  }

  const data = await response.json();
  const content = data.content[0].text.trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from Claude');
  }

  const recipeData = JSON.parse(jsonMatch[0]);

  return {
    recipe_name: recipeData.recipe_name,
    ingredients: recipeData.ingredients,
    instructions: recipeData.instructions,
    prep_time: recipeData.prep_time,
    cook_time: recipeData.cook_time,
    servings: recipeData.servings,
    estimated_cost: recipeData.estimated_cost,
    nutritional_info: recipeData.nutritional_info,
    season,
    meal_type: mealType,
    // Premium features
    difficulty: recipeData.difficulty,
    cuisine_type: recipeData.cuisine_type,
    tags: recipeData.tags || [],
    variations: recipeData.variations || [],
    cooking_tips: recipeData.cooking_tips || []
  };
}

export async function generateRecipe(
  apiProvider: ApiProvider,
  apiKey: string,
  mealType: MealType,
  season: Season,
  location: string,
  isPremium: boolean = false
): Promise<Partial<Recipe>> {
  if (apiProvider === 'openai') {
    return generateRecipeWithOpenAI(apiKey, mealType, season, location);
  } else if (apiProvider === 'gemini') {
    return generateRecipeWithGemini(apiKey, mealType, season, location);
  } else if (apiProvider === 'claude') {
    return generateRecipeWithClaude(apiKey, mealType, season, location, isPremium);
  } else {
    throw new Error(`Unsupported API provider: ${apiProvider}`);
  }
}
/**
 * Generate recipe from natural language prompt (for chat interface)
 */
export async function generateRecipeFromPrompt(
  apiProvider: ApiProvider,
  apiKey: string,
  prompt: string,
  userPreferences?: {
    dietaryRestrictions?: string[];
    cookingSkillLevel?: string;
    preferredCuisines?: string[];
    location?: string;
    user_id?: string;
  },
  isPremium: boolean = false
): Promise<Partial<Recipe>> {
  const season = getCurrentSeason();
  const location = userPreferences?.location || 'United States';

  // Get enhanced dietary prompt if user ID is available
  let enhancedDietaryPrompt = '';
  if (userPreferences?.user_id) {
    try {
      const { dietaryService } = await import('@/services/dietaryService');
      enhancedDietaryPrompt = await dietaryService.generateEnhancedDietaryPrompt(userPreferences.user_id);
    } catch (error) {
      console.error('Error getting enhanced dietary prompt:', error);
    }
  }

  const conversationalPrompt = buildConversationalPrompt(
    prompt,
    season,
    location,
    userPreferences,
    isPremium,
    enhancedDietaryPrompt
  );

  if (apiProvider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: conversationalPrompt
          }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate recipe with Claude');
    }

    const data = await response.json();
    const content = data.content[0].text.trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Claude');
    }

    const recipeData = JSON.parse(jsonMatch[0]);

    return {
      recipe_name: recipeData.recipe_name,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      prep_time: recipeData.prep_time,
      cook_time: recipeData.cook_time,
      servings: recipeData.servings,
      estimated_cost: recipeData.estimated_cost,
      nutritional_info: recipeData.nutritional_info,
      season,
      meal_type: 'dinner', // Default for chat recipes
      difficulty: recipeData.difficulty,
      cuisine_type: recipeData.cuisine_type,
      tags: recipeData.tags || [],
      variations: recipeData.variations || [],
      cooking_tips: recipeData.cooking_tips || []
    };
  } else {
    // Fallback to existing generators for OpenAI/Gemini
    return generateRecipe(apiProvider, apiKey, 'dinner', season, location, isPremium);
  }
}

/**
 * Build conversational prompt for natural language recipe requests
 */
function buildConversationalPrompt(
  userPrompt: string,
  season: Season,
  location: string,
  userPreferences?: {
    dietaryRestrictions?: string[];
    cookingSkillLevel?: string;
    preferredCuisines?: string[];
  },
  isPremium: boolean = false,
  enhancedDietaryPrompt?: string
): string {
  let prompt = `Based on this request: "${userPrompt}"

Create a recipe that meets these requirements:

STRICT DIETARY RESTRICTIONS (MUST FOLLOW):
${DIETARY_RESTRICTIONS.map((r) => `- ${r}`).join('\n')}

ALLOWED INGREDIENTS:
${ALLOWED_FOODS.map((f) => `- ${f}`).join('\n')}`;

  // Add user-specific dietary restrictions
  if (userPreferences?.dietaryRestrictions?.length) {
    prompt += `\n\nADDITIONAL USER DIETARY RESTRICTIONS:
${userPreferences.dietaryRestrictions.map((r) => `- ${r}`).join('\n')}`;
  }

  // Add enhanced dietary prompt if available
  if (enhancedDietaryPrompt) {
    prompt += enhancedDietaryPrompt;
  }

  prompt += `\n\nCONTEXT:
- Current season: ${season}
- Location: ${location}`;

  if (userPreferences?.cookingSkillLevel) {
    prompt += `\n- User cooking skill: ${userPreferences.cookingSkillLevel}`;
  }

  if (userPreferences?.preferredCuisines?.length) {
    prompt += `\n- Preferred cuisines: ${userPreferences.preferredCuisines.join(', ')}`;
  }

  if (isPremium) {
    prompt += `\n\nPREMIUM FEATURES:
- Include detailed cooking techniques and professional tips
- Provide recipe variations and substitutions
- Add detailed nutritional analysis
- Include cultural context and pairing suggestions

RESPONSE FORMAT (must be valid JSON):
{
  "recipe_name": "Creative and appealing recipe name",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount with unit", "notes": "optional preparation notes"}
  ],
  "instructions": "Detailed step-by-step instructions with techniques explained",
  "prep_time": number (in minutes),
  "cook_time": number (in minutes),
  "servings": number,
  "estimated_cost": number (in dollars),
  "difficulty": "Easy|Medium|Hard",
  "cuisine_type": "Type of cuisine",
  "nutritional_info": {
    "calories": number (per serving),
    "protein": "amount in grams",
    "carbs": "amount in grams",
    "fats": "amount in grams",
    "fiber": "amount in grams",
    "sodium": "amount in mg",
    "highlights": "detailed nutritional benefits"
  },
  "tags": ["tag1", "tag2", "tag3"],
  "variations": ["variation 1", "variation 2"],
  "cooking_tips": ["tip 1", "tip 2", "tip 3"]
}`;
  } else {
    prompt += `\n\nBASIC REQUIREMENTS:
- Easy to prepare (under 45 minutes total time)
- Budget-friendly
- Simple ingredients commonly found in grocery stores

RESPONSE FORMAT (must be valid JSON):
{
  "recipe_name": "Name of the recipe",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount with unit"}
  ],
  "instructions": "Step-by-step instructions as a single string with numbered steps",
  "prep_time": number (in minutes),
  "cook_time": number (in minutes),
  "servings": number,
  "estimated_cost": number (in dollars),
  "difficulty": "Easy|Medium|Hard",
  "cuisine_type": "Type of cuisine",
  "nutritional_info": {
    "calories": number (per serving),
    "protein": "amount in grams",
    "carbs": "amount in grams",
    "fats": "amount in grams",
    "highlights": "brief nutritional highlights"
  }
}`;
  }

  prompt += `\n\nReturn ONLY the JSON object, no additional text.`;

  return prompt;
}

/**
 * Modify existing recipe based on user feedback (for chat modifications)
 */
export async function modifyRecipe(
  apiProvider: ApiProvider,
  apiKey: string,
  originalRecipe: Partial<Recipe>,
  modificationRequest: string,
  isPremium: boolean = false
): Promise<Partial<Recipe>> {
  const modificationPrompt = `Modify this existing recipe based on the user's request.

ORIGINAL RECIPE:
${JSON.stringify(originalRecipe, null, 2)}

USER MODIFICATION REQUEST: "${modificationRequest}"

REQUIREMENTS:
- Keep the same basic structure but apply the requested changes
- Maintain dietary restrictions compliance
- Adjust cooking times and instructions as needed
- Update nutritional information if ingredients change

RESPONSE FORMAT (must be valid JSON):
Return the complete modified recipe in the same format as the original, with all requested changes applied.

Return ONLY the JSON object, no additional text.`;

  if (apiProvider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: modificationPrompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to modify recipe with Claude');
    }

    const data = await response.json();
    const content = data.content[0].text.trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Claude');
    }

    const modifiedRecipe = JSON.parse(jsonMatch[0]);
    return modifiedRecipe;
  } else {
    throw new Error('Recipe modification currently only supported with Claude API');
  }
}