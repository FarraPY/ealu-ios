import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import Login from '@/components/login';
import { SesionProvider, useSesion } from '@/lib/sesion';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const esquema = useColorScheme();
  return (
    <ThemeProvider value={esquema === 'dark' ? DarkTheme : DefaultTheme}>
      <SesionProvider>
        <Raiz />
      </SesionProvider>
    </ThemeProvider>
  );
}

function Raiz() {
  const { estado } = useSesion();

  useEffect(() => {
    if (estado !== 'cargando') SplashScreen.hideAsync();
  }, [estado]);

  if (estado === 'cargando') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return estado === 'fuera' ? <Login /> : <AppTabs />;
}
