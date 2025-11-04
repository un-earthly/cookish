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

export async function generateRecipe(
  apiProvider: ApiProvider,
  apiKey: string,
  mealType: MealType,
  season: Season,
  location: string
): Promise<Partial<Recipe>> {
  if (apiProvider === 'openai') {
    return generateRecipeWithOpenAI(apiKey, mealType, season, location);
  } else {
    return generateRecipeWithGemini(apiKey, mealType, season, location);
  }
}
