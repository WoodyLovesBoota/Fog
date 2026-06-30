import '@/polyfills/textEncoding'; // must precede anything that imports h3-js
import '@/background/locationTask'; // registers the bg location task at app start
import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { SplashOverlay } from '@/components/SplashOverlay';
import {
  useFonts,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';

import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  // Branded launch splash — shown only on a COLD start. `showSplash` is seeded
  // true on first JS render and never set back to true, so returning from the
  // background (which keeps this component mounted) never re-triggers it.
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.phoneBg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="permission" />
          <Stack.Screen name="denied" />
          <Stack.Screen name="map" />
          <Stack.Screen name="stats" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="collection" options={{ animation: 'slide_from_right' }} />
        </Stack>
        {showSplash ? <SplashOverlay onDone={() => setShowSplash(false)} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
