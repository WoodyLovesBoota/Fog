import { StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type Props = {
  colors: readonly [string, string, ...string[]];
  children: React.ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
};

/** Full-bleed vertical gradient background with a safe-area content area. */
export function Screen({ colors, children, edges = ['top', 'bottom'], style }: Props) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.fill}>
      <SafeAreaView edges={edges} style={[styles.fill, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
