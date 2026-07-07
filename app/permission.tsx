import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { CloudFace } from '@/components/CloudFace';
import { FloatingCloud } from '@/components/FloatingCloud';
import { PrimaryButton, TextLink } from '@/components/PrimaryButton';
import { colors, fonts, spacing, type } from '@/theme/tokens';
import { requestPermission } from '@/services/location';

/** Map pin / location glyph used in the privacy chip. */
function PinGlyph() {
  return (
    <View style={styles.pin}>
      <View style={styles.pinTop} />
    </View>
  );
}

export default function PermissionScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const status = await requestPermission();
      router.replace(status === 'granted' ? '/map' : '/denied');
    } catch {
      router.replace('/denied');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen colors={colors.panelGradient}>
      <View style={styles.root}>
        <View style={styles.art}>
          <View style={styles.marker}>
            <View style={styles.markerDot} />
          </View>
          <FloatingCloud style={styles.cloud} amplitude={8} duration={6500}>
            <CloudFace mood="smile" hat scale={1.5} />
          </FloatingCloud>
        </View>

        <Text style={[type.panelTitle, styles.center]}>Allow location{'\n'}to start coloring</Text>

        <View style={styles.chip}>
          <PinGlyph />
          <Text style={styles.chipText}>Your map stays on your device</Text>
        </View>

        <View style={styles.cta}>
          {/* Disabled while the OS dialog is up: the busy guard already blocks
              re-entry, but the dimmed pill makes the wait visible. */}
          <PrimaryButton label={busy ? 'Requesting…' : 'Allow Location'} onPress={onAllow} disabled={busy} />
          <TextLink onPress={() => router.replace('/denied')} style={{ marginTop: spacing.lg }}>
            Maybe later
          </TextLink>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
  art: { height: 320, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  marker: {
    position: 'absolute',
    top: 30,
    width: 46,
    height: 46,
    backgroundColor: colors.blue,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    borderBottomRightRadius: 23,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    ...{
      shadowColor: '#5A6EDC',
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
  markerDot: { width: 18, height: 18, borderRadius: 999, backgroundColor: colors.white, transform: [{ rotate: '45deg' }] },
  cloud: { marginTop: 70 },
  center: { textAlign: 'center', marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chipBg,
    borderWidth: 1.5,
    borderColor: colors.chipBorder,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: spacing.xl,
  },
  chipText: { fontFamily: fonts.bodyBold, color: colors.chipText, fontSize: 13 },
  pin: {
    width: 16,
    height: 13,
    borderWidth: 2,
    borderColor: colors.blue,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginTop: 5,
    alignItems: 'center',
  },
  pinTop: {
    position: 'absolute',
    top: -7,
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: colors.blue,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  cta: { marginTop: 'auto', marginBottom: 36, alignSelf: 'stretch' },
});
