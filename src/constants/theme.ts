/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, StatusBar } from 'react-native';

/** Granate institucional de EALU, tomado de la web (rgb(153, 3, 1)). */
export const Marca = '#990301';
export const MarcaClara = '#C74A48';
export const Peligro = '#e5484d';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    marca: Marca,
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // En modo oscuro el granate puro queda ilegible sobre negro.
    marca: MarcaClara,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Relleno extra arriba de la cabecera de un modal.
 *
 * En iOS los modales usan `presentationStyle="pageSheet"`, que ya arranca por
 * debajo de la barra de estado. En Android el `Modal` ocupa la pantalla entera
 * desde y=0, así que sin esto el botón "Cerrar" queda tapado por la hora y la
 * batería. `useSafeAreaInsets` no sirve acá: el `Modal` se monta fuera del
 * SafeAreaProvider y devuelve cero.
 */
export const CabeceraModalInset =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
