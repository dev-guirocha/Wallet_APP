import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { getRegisteredBanner, subscribeToBannerProvider } from '../utils/ads';

const TEST_AD_UNIT = 'ca-app-pub-3940256099942544/6300978111';

const resolveAdUnitId = (placement) => {
  const envKey = `EXPO_PUBLIC_ADMOB_BANNER_${String(placement || 'default').toUpperCase()}`;
  const fromEnv = typeof process !== 'undefined' ? process.env?.[envKey] : undefined;
  return fromEnv || TEST_AD_UNIT;
};

const AdBanner = ({ placement = 'default', style }) => {
  const [BannerComponent, setBannerComponent] = useState(() => getRegisteredBanner());
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToBannerProvider((nextBanner) => {
      setBannerComponent(() => nextBanner || null);
      setLoadError(null);
    });

    return unsubscribe;
  }, []);

  const adUnitId = useMemo(() => resolveAdUnitId(placement), [placement]);

  if (!BannerComponent || loadError) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderTitle}>Publicidade</Text>
        <Text style={styles.placeholderCaption}>
          {loadError ? 'Falha ao carregar anúncio' : 'Banner será exibido aqui'}
        </Text>
      </View>
    );
  }

  return (
    <View style={style}>
      <BannerComponent
        bannerSize="FULL_BANNER"
        adUnitID={adUnitId}
        servePersonalizedAds
        onDidFailToReceiveAdWithError={(error) => setLoadError(error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.12)',
    backgroundColor: 'rgba(30,30,30,0.04)',
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  placeholderCaption: {
    fontSize: 12,
    color: 'rgba(30,30,30,0.6)',
    marginTop: 4,
  },
});

export default AdBanner;
