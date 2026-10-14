/** Manager → basket → Liquidity: coming soon (no design or API yet). */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { Empty } from '../../../components/ui';
import { useManagedBasket } from '../../../hooks/useManagedBasket';
import { space } from '../../../theme/tokens';

export default function ManagerLiquidityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: dtf, loading, error, reload } = useManagedBasket(id);
  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Liquidity"
    >
      <View style={styles.pad}>
        <Empty
          title="Coming soon"
          body="Creating a liquidity pool for this basket will be available here."
        />
      </View>
    </ManagerBasketScreen>
  );
}

const styles = StyleSheet.create({ pad: { paddingHorizontal: space.md } });
