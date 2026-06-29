import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '@/theme/tokens';

export type CloudMood = 'happy' | 'smile' | 'sad' | 'sleepy';

type Props = {
  mood?: CloudMood;
  hat?: boolean;
  /** Multiplier over the 170x112 base box. */
  scale?: number;
};

const BASE_W = 170;
const BASE_H = 112;
const INK = colors.ink;

/**
 * The app mascot — a puffy cloud face. Ported from CloudFace.dc.html:
 * five overlapping white circles + a rounded base, with mood-driven eyes and
 * mouth and an optional explorer hat.
 */
function CloudFaceBase({ mood = 'happy', hat = false, scale = 1 }: Props) {
  const openEyes = mood !== 'sleepy';
  return (
    <View style={{ width: BASE_W * scale, height: BASE_H * scale }}>
      <View style={[styles.box, { transform: [{ scale }] }]}>
        {/* puffs */}
        <View style={[styles.puff, { width: 66, height: 66, left: 8, top: 34 }]} />
        <View style={[styles.puff, { width: 80, height: 80, left: 34, top: 9 }]} />
        <View style={[styles.puff, { width: 60, height: 60, left: 84, top: 15 }]} />
        <View style={[styles.puff, { width: 54, height: 54, left: 112, top: 36 }]} />
        <View style={[styles.base]} />

        {hat ? (
          <View style={styles.hat}>
            <View style={styles.hatBrim} />
            <View style={styles.hatCrown} />
            <View style={styles.hatBand} />
            <View style={styles.hatBuckle} />
          </View>
        ) : null}

        {openEyes ? (
          <>
            <View style={[styles.eye, { left: 64 }]}>
              <View style={styles.eyeShine} />
            </View>
            <View style={[styles.eye, { left: 95 }]}>
              <View style={styles.eyeShine} />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.sleepyEye, { left: 61 }]} />
            <View style={[styles.sleepyEye, { left: 92 }]} />
          </>
        )}

        {/* cheeks */}
        <View style={[styles.cheek, { left: 47 }]} />
        <View style={[styles.cheek, { left: 108 }]} />

        {mood === 'happy' ? (
          <View style={styles.happyMouth}>
            <View style={styles.tongue} />
          </View>
        ) : null}
        {mood === 'smile' ? <View style={styles.smile} /> : null}
        {mood === 'sad' ? <View style={styles.frown} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: BASE_W,
    height: BASE_H,
    transformOrigin: 'top left',
  },
  puff: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 999,
  },
  base: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 36,
    width: 170,
    height: 50,
    left: 0,
    bottom: 8,
  },
  // hat
  hat: { position: 'absolute', left: 38, top: -15, width: 94, height: 42, zIndex: 6, transform: [{ rotate: '-4deg' }] },
  hatBrim: { position: 'absolute', left: 0, bottom: 0, width: 94, height: 17, backgroundColor: '#C79A57', borderRadius: 999 },
  hatCrown: { position: 'absolute', left: 25, bottom: 7, width: 46, height: 30, backgroundColor: '#D8B36A', borderTopLeftRadius: 23, borderTopRightRadius: 23, borderBottomLeftRadius: 11, borderBottomRightRadius: 11 },
  hatBand: { position: 'absolute', left: 25, bottom: 13, width: 46, height: 8, backgroundColor: '#A87C3D' },
  hatBuckle: { position: 'absolute', left: 44, bottom: 13, width: 8, height: 8, backgroundColor: '#E9D4A1', borderRadius: 2 },
  // eyes
  eye: { position: 'absolute', top: 53, width: 11, height: 13, backgroundColor: INK, borderRadius: 999 },
  eyeShine: { position: 'absolute', right: 1, top: 1, width: 3.5, height: 3.5, backgroundColor: colors.white, borderRadius: 999 },
  sleepyEye: {
    position: 'absolute',
    top: 55,
    width: 15,
    height: 8,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: INK,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  cheek: { position: 'absolute', top: 64, width: 15, height: 9, backgroundColor: '#F4C2C9', borderRadius: 999, opacity: 0.92 },
  happyMouth: {
    position: 'absolute',
    left: 75,
    top: 63,
    width: 22,
    height: 14,
    backgroundColor: '#A85A52',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  tongue: { position: 'absolute', bottom: -3, left: 4, width: 14, height: 8, backgroundColor: '#E58B86', borderRadius: 999 },
  smile: {
    position: 'absolute',
    left: 75,
    top: 62,
    width: 22,
    height: 11,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: INK,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  frown: {
    position: 'absolute',
    left: 76,
    top: 71,
    width: 20,
    height: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: INK,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
});

export const CloudFace = memo(CloudFaceBase);
