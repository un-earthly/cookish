import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { BackHandler, Alert, View, Text } from 'react-native';
import { Home, History, Settings, MessageCircle } from 'lucide-react-native';
import { WidgetModeModal } from '@/components/WidgetModeModal';
import { ServiceStatusIndicator } from '@/components/ServiceStatusIndicator';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAI } from '@/contexts/AIContext';
import { useAppIntegration } from '@/hooks/useAppIntegration';
import { colors } from '@/styles/theme';

export default function TabLayout() {
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  const {
    chatBadgeCount,
    historyBadgeCount,
    navigationReady
  } = useNavigation();

  const {
    isAIReady,
    canGenerateRecipes,
    canUseVoice
  } = useAI();

  const {
    serviceHealth,
    isInitialized
  } = useAppIntegration();

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

  // Custom badge component
  const TabBadge = ({ count }: { count: number }) => {
    if (count === 0) return null;

    return (
      <View style={{
        position: 'absolute',
        top: -2,
        right: -6,
        backgroundColor: colors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.gradientStart,
      }}>
        <Text style={{
          color: '#fff',
          fontSize: 10,
          fontWeight: '600',
        }}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    );
  };

  // Custom tab icon with badge support
  const TabIcon = ({
    IconComponent,
    size,
    color,
    badgeCount = 0
  }: {
    IconComponent: any;
    size: number;
    color: string;
    badgeCount?: number;
  }) => (
    <View style={{ position: 'relative' }}>
      <IconComponent size={size} color={color} />
      <TabBadge count={badgeCount} />
    </View>
  );

  // Don't render tabs until navigation is ready
  if (!navigationReady) {
    return null;
  }

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
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <ServiceStatusIndicator compact />
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ size, color }) => (
              <TabIcon IconComponent={Home} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: isAIReady ? 'AI Chat' : 'Chat (Offline)',
            tabBarIcon: ({ size, color }) => (
              <TabIcon
                IconComponent={MessageCircle}
                size={size}
                color={isAIReady ? color : 'rgba(255, 255, 255, 0.3)'}
                badgeCount={chatBadgeCount}
              />
            ),
            tabBarBadge: chatBadgeCount > 0 ? chatBadgeCount : undefined,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ size, color }) => (
              <TabIcon
                IconComponent={History}
                size={size}
                color={color}
                badgeCount={historyBadgeCount}
              />
            ),
            tabBarBadge: historyBadgeCount > 0 ? historyBadgeCount : undefined,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ size, color }) => (
              <View style={{ position: 'relative' }}>
                <Settings size={size} color={color} />
                {!isInitialized && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.warning,
                  }} />
                )}
              </View>
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
