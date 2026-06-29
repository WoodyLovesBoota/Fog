import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { CloudFace } from '@/components/CloudFace';
import { FloatingCloud } from '@/components/FloatingCloud';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing, type } from '@/theme/tokens';
import { getPermission } from '@/services/location';

const RAINBOW = [
  { size: 160, color: '#F08A5D' },
  { size: 144, color: '#F4A95C' },
  { size: 128, color: '#F6CE5C' },
  { size: 112, color: '#79C6A2' },
  { size: 96, color: '#6FB8E6' },
  { size: 80, color: '#9E91E0' },
];

function Rainbow() {
  return (
    <View style={styles.rainbow}>
      {RAINBOW.map((arc) => (
        <View
          key={arc.size}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 80 - arc.size / 2,
            width: arc.size,
            height: arc.size,
            borderWidth: 8,
            borderColor: arc.color,
            borderRadius: arc.size / 2,
          }}
        />
      ))}
    </View>
  );
}

export default function SplashScreen() {
  const router = useRouter();

  // Returning-user gate (flow 6.3): if location permission was already granted
  // on a previous run, the intro / permission / download steps are all behind
  // us — skip straight to the map (the offline pack is cached, so map.tsx's
  // download check resolves instantly). We render nothing while deciding so the
  // intro never flashes for returning users.
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getPermission();
      if (cancelled) return;
      if (status === 'granted') {
        router.replace('/map'); // returning user → straight to the map
      } else if (status === 'denied') {
        router.replace('/denied'); // asked before & refused → blocked screen
      } else {
        setShowIntro(true); // first run (undetermined) → onboarding intro
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!showIntro) return null;

  return (
    <Screen colors={colors.splashGradient}>
      <View style={styles.root}>
        <View style={styles.art}>
          {/* sun */}
          <View style={styles.sun} />
          {/* rainbow */}
          <View style={styles.rainbowWrap}>
            <Rainbow />
          </View>
          {/* floating clouds — each bobs on its own amplitude/duration/delay
              so the group drifts out of phase (handoff: float / floatB). */}
          <FloatingCloud style={[styles.cloud, { left: 6, top: 26 }]} amplitude={7} duration={7000} delay={0}>
            <CloudFace mood="smile" scale={1} />
          </FloatingCloud>
          <FloatingCloud style={[styles.cloud, { right: 0, top: 0 }]} amplitude={10} duration={6500} delay={400}>
            <CloudFace mood="smile" scale={1.02} />
          </FloatingCloud>
          <FloatingCloud style={[styles.cloud, { left: 44, top: 112, zIndex: 4 }]} amplitude={10} duration={6000} delay={200}>
            <CloudFace mood="happy" hat scale={1.55} />
          </FloatingCloud>
          <FloatingCloud style={[styles.cloud, { left: 2, top: 250 }]} amplitude={7} duration={7500} delay={600}>
            <CloudFace mood="sleepy" scale={0.96} />
          </FloatingCloud>
          <FloatingCloud style={[styles.cloud, { right: 4, top: 250 }]} amplitude={10} duration={6800} delay={300}>
            <CloudFace mood="happy" scale={1.02} />
          </FloatingCloud>
        </View>

        <View style={styles.copy}>
          <Text style={[type.splashTitle, styles.center]}>Color the map{'\n'}as you explore</Text>
          <Text style={[type.subtitle, styles.center, { marginTop: spacing.md }]}>
            Walk around the city and watch{'\n'}your world fill with color.
          </Text>
        </View>

        <View style={styles.cta}>
          <PrimaryButton large label="Get Started" onPress={() => router.push('/permission')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  art: { height: 380, marginTop: 24, alignSelf: 'stretch' },
  sun: {
    position: 'absolute',
    left: 12,
    top: 116,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#F6C04D',
    shadowColor: '#F6C44D',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  rainbowWrap: { position: 'absolute', left: 90, top: 38, width: 160, height: 82, overflow: 'hidden' },
  rainbow: { width: 160, height: 82 },
  cloud: { position: 'absolute', zIndex: 3 },
  copy: { marginTop: 8 },
  center: { textAlign: 'center' },
  cta: { marginTop: 'auto', marginBottom: 28 },
});
