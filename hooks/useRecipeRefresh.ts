import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { generateDailyRecipes } from '@/services/recipeService';

export function useRecipeRefresh(onRefresh?: () => void) {
  const appState = useRef(AppState.currentState);
  const lastCheckDate = useRef<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const checkAndRefreshRecipes = async () => {
      const today = new Date().toISOString().split('T')[0];

      if (lastCheckDate.current !== today) {
        lastCheckDate.current = today;
        try {
          await generateDailyRecipes(false);
          onRefresh?.();
        } catch (error) {
          console.error('Failed to refresh recipes:', error);
        }
      }
    };

    checkAndRefreshRecipes();

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          checkAndRefreshRecipes();
        }
        appState.current = nextAppState;
      }
    );

    const interval = setInterval(() => {
      checkAndRefreshRecipes();
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [onRefresh]);
}
