import { memo } from 'react';
import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, press, radii, shadows, type } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** Slightly larger type for the splash hero button. */
  large?: boolean;
  /** Blocks presses and dims the pill — for busy/in-flight states, so a
      double-tap can't race the async action behind the button. */
  disabled?: boolean;
  style?: ViewStyle;
};

/** The blue gradient pill CTA used on every screen. */
function PrimaryButtonBase({ label, onPress, large, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.shadow,
        style,
        pressed && press.button,
        disabled && styles.disabled,
      ]}
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
  disabled: { opacity: 0.6 },
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => [style, pressed && press.row]}
    >
      <View>
        <Text style={[type.link, { textAlign: 'center' }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

export const PrimaryButton = memo(PrimaryButtonBase);
