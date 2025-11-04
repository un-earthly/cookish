import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { BackHandler, Alert } from 'react-native';
import { Home, History, Settings } from 'lucide-react-native';
import { WidgetModeModal } from '@/components/WidgetModeModal';
import { colors } from '@/styles/theme';

export default function TabLayout() {
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  useEffect(() => {
    const backAction = () => {
      setShowWidgetModal(true);
      return true; // Prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleWidgetModeSelect = (mode: 'small' | 'large' | 'horizontal' | 'close') => {
    setShowWidgetModal(false);
    
    if (mode === 'close') {
      // Close the app completely
      BackHandler.exitApp();
    } else {
      // TODO: Implement widget mode activation
      Alert.alert(
        'Widget Mode',
        `${mode === 'small' ? '2×2' : mode === 'large' ? '4×4' : 'Horizontal'} widget mode will be activated. This feature requires widget implementation.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarStyle: {
          backgroundColor: colors.gradientStart,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ size, color }) => (
            <History size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipe-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
    <WidgetModeModal
      visible={showWidgetModal}
      onClose={() => setShowWidgetModal(false)}
      onSelectMode={handleWidgetModeSelect}
    />
    </>
  );
}
