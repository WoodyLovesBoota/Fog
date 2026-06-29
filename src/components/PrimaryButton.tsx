import { memo } from 'react';
import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radii, shadows, type } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** Slightly larger type for the splash hero button. */
  large?: boolean;
  style?: ViewStyle;
};

/** The blue gradient pill CTA used on every screen. */
function PrimaryButtonBase({ label, onPress, large, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.shadow, style, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={colors.primaryButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}
      >
        <Text style={[large ? type.buttonLg : type.button]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radii.pill, ...shadows.button },
  fill: {
    borderRadius: radii.pill,
    paddingVertical: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
});

/** A bare text link styled like the prototype's secondary actions. */
export function TextLink({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={style}>
      <View>
        <Text style={[type.link, { textAlign: 'center' }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

export const PrimaryButton = memo(PrimaryButtonBase);
