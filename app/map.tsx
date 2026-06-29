import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Map as MapView, UserLocation } from '@maplibre/maplibre-react-native';

import { colors, type } from '@/theme/tokens';
import { MAP_STYLE_URL, SINGAPORE_CENTER } from '@/config/mapConfig';
import { ensureSingaporePack, type DownloadState } from '@/map/downloadSingaporePack';
import { requestPermission } from '@/services/location';

/**
 * Real geographic map screen (Step 1): MapLibre + Stadia tiles, gated behind a
 * one-time Singapore offline download. Once the pack is cached the map renders
 * fully offline. The fog-of-war (H3) layer attaches here in a later step.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [dl, setDl] = useState<DownloadState>({ status: 'idle' });

  const startDownload = useCallback(() => {
    void ensureSingaporePack(setDl);
  }, []);

  useEffect(() => {
    // Ask for location up front so the user puck can show once the map is ready.
    void requestPermission();
    startDownload();
  }, [startDownload]);

  if (dl.status !== 'done') {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {dl.status === 'error' ? (
          <>
            <Text style={styles.title}>지도를 불러오지 못했어요</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {dl.message}
            </Text>
            <Pressable
              onPress={startDownload}
              accessibilityRole="button"
              accessibilityLabel="지도 다시 다운로드"
              style={styles.retry}
            >
              <Text style={styles.retryLabel}>다시 시도</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.blueDeep} />
            <Text style={styles.subtitle}>
              싱가포르 지도 준비 중…
              {dl.status === 'downloading' ? ` ${Math.round(dl.progress)}%` : ''}
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {/* After download this renders from the offline cache. */}
      <MapView style={styles.map} mapStyle={MAP_STYLE_URL} attribution>
        <Camera initialViewState={{ center: SINGAPORE_CENTER, zoom: 11 }} />
        <UserLocation />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  map: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
    backgroundColor: colors.phoneBg,
  },
  title: { ...type.statsTitle, textAlign: 'center' },
  subtitle: { ...type.subtitle, textAlign: 'center' },
  retry: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  retryLabel: { ...type.badge, color: colors.blueDeep },
});
