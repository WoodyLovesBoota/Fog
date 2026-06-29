import { useEffect } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { CloudFace } from '@/components/CloudFace';
import { PrimaryButton, TextLink } from '@/components/PrimaryButton';
import { colors, spacing, type } from '@/theme/tokens';
import { getPermission } from '@/services/location';

export default function DeniedScreen() {
  const router = useRouter();

  // The only way off this screen is to grant permission. When the user comes
  // back from the OS Settings (app returns to "active"), re-check — if they
  // enabled location, advance to the map. Otherwise they stay blocked.
  useEffect(() => {
    const recheck = async () => {
      if ((await getPermission()) === 'granted') router.replace('/map');
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recheck();
    });
    return () => sub.remove();
  }, [router]);

  const onOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Some platforms (web) can't open settings; fall back to the prompt.
      router.replace('/permission');
    }
  };

  return (
    <Screen colors={colors.panelGradient}>
      <View style={styles.root}>
        <View style={styles.art}>
          <View style={styles.cloud}>
            <CloudFace mood="sad" hat scale={1.5} />
          </View>
          {/* falling teardrops */}
          <View style={[styles.drop, { left: '46%', top: 196, transform: [{ rotate: '8deg' }], opacity: 0.8 }]} />
          <View style={[styles.dropSmall, { left: '58%', top: 208, transform: [{ rotate: '-8deg' }], opacity: 0.7 }]} />
        </View>

        <Text style={[type.deniedTitle, styles.center]}>Location is off</Text>
        <Text style={[type.subtitle, styles.center, { marginTop: spacing.md }]}>
          Without location access we can&apos;t color{'\n'}your map. Turn it on in Settings to{'\n'}start exploring again.
        </Text>

        <View style={styles.cta}>
          <PrimaryButton label="Open Settings" onPress={onOpenSettings} />
          <TextLink onPress={() => router.replace('/permission')} style={{ marginTop: spacing.lg }}>
            Try again
          </TextLink>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
  art: { height: 320, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  cloud: { marginTop: 30 },
  drop: { position: 'absolute', width: 9, height: 13, backgroundColor: '#9FB8EC', borderRadius: 5 },
  dropSmall: { position: 'absolute', width: 7, height: 11, backgroundColor: '#9FB8EC', borderRadius: 4 },
  center: { textAlign: 'center' },
  cta: { marginTop: 'auto', marginBottom: 36, alignSelf: 'stretch' },
});
