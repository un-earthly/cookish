# Daily Recipe Generator

A React Native mobile app that generates 3 personalized recipes daily (breakfast, lunch, dinner) using AI, with strict dietary restrictions and seasonal ingredient focus.

## Features

- **Daily Recipe Generation**: Get 3 unique recipes every day at midnight
- **Dietary Restrictions**: No rice, chicken, red meat, lentils, or chickpeas
- **AI-Powered**: Uses OpenAI GPT or Google Gemini for recipe generation
- **Seasonal Ingredients**: Recipes adapt to your location and current season
- **Recipe History**: View past 7 days of recipes
- **Favorites**: Mark recipes you love
- **Interactive Ingredients**: Check off ingredients as you shop or cook
- **Automatic Refresh**: New recipes generated daily when app opens

## Dietary Specifications

The app generates recipes that exclude:
- Rice
- Chicken
- Red meat (beef, lamb, pork)
- Lentils
- Chickpeas

Focus ingredients include:
- Fish and seafood
- Eggs
- Vegetables
- Fruits
- Dairy products
- Alternative grains (quinoa, bulgur, couscous, barley, oats)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- An OpenAI API key OR Google Gemini API key
- Supabase account (database already configured)

### 2. Get API Keys

#### Option A: OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

#### Option B: Google Gemini
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy the key (starts with `AIza`)

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the App

```bash
npm run dev
```

### 5. First Time Setup

1. Create an account (email + password)
2. Go to Settings tab
3. Select your AI provider (OpenAI or Gemini)
4. Paste your API key
5. Enter your location (e.g., "California, USA")
6. Tap "Save Settings"
7. Return to Home tab to generate your first recipes

## App Structure

### Screens

- **Home**: Today's 3 recipes with regenerate option
- **Recipe Detail**: Full recipe with interactive ingredient checklist
- **History**: View past 7 days of recipes
- **Settings**: Configure API key, provider, and location

### Key Features

**Recipe Cards**
- Meal type badge (breakfast/lunch/dinner)
- Cooking time, servings, and estimated cost
- Seasonal badge
- Favorite toggle

**Recipe Details**
- Complete ingredient list with checkboxes
- Step-by-step instructions
- Nutritional information
- Prep and cook times

**Automatic Refresh**
- Checks for new day when app opens
- Generates fresh recipes at midnight
- Runs background checks every minute

## Database Schema

The app uses Supabase with three main tables:

1. **user_preferences**: Stores API keys and user settings
2. **daily_recipes**: Stores generated recipes
3. **shopping_list**: For future shopping list feature

All tables have Row Level Security (RLS) enabled.

## Recipe Criteria

All generated recipes meet these requirements:
- Under 30 minutes total cooking time
- Budget-friendly (under $15 estimated cost)
- Nutritionally balanced
- Uses common grocery store ingredients
- Seasonal and location-appropriate

## Technology Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI GPT-3.5-turbo or Google Gemini Pro
- **Icons**: Lucide React Native
- **Language**: TypeScript

## Project Structure

```
app/
├── (auth)/           # Authentication screens
│   ├── login.tsx
│   └── _layout.tsx
├── (tabs)/          # Main app tabs
│   ├── index.tsx    # Home screen
│   ├── history.tsx  # Recipe history
│   ├── settings.tsx # Settings
│   ├── recipe-detail.tsx
│   └── _layout.tsx
└── _layout.tsx      # Root layout

components/
└── RecipeCard.tsx   # Reusable recipe card

contexts/
└── AuthContext.tsx  # Authentication context

hooks/
├── useFrameworkReady.ts
└── useRecipeRefresh.ts  # Auto-refresh logic

lib/
└── supabase.ts      # Supabase client

services/
├── recipeGenerator.ts  # AI recipe generation
└── recipeService.ts    # Recipe database operations

types/
├── env.d.ts
└── recipe.ts        # TypeScript types
```

## Troubleshooting

**"Please configure your API key in Settings"**
- Go to Settings and enter your OpenAI or Gemini API key

**Recipes not generating**
- Check your internet connection
- Verify API key is correct
- Ensure you have API credits remaining

**App not refreshing at midnight**
- Open the app to trigger the check
- Pull down to refresh manually

## Future Enhancements

- Home screen widget showing today's menu
- Shopping list generation from recipes
- Share recipes with friends
- More dietary restriction options
- Meal planning calendar
- Recipe ratings and reviews

## License

MIT License
