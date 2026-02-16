import React from 'react';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../../theme';
import { Divider } from './Divider';
import { BottomSheet } from './BottomSheet';

type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  navigation: {
    navigate: (...args: unknown[]) => void;
    getParent?: () => {
      navigate: (...args: unknown[]) => void;
      getState?: () => { routeNames?: string[] };
    } | null;
    getState?: () => { routeNames?: string[] };
  };
};

type ActionItem = {
  key: string;
  label: string;
  subtitle: string;
  iconName: ComponentProps<typeof Icon>['name'];
  iconColor: string;
  onPress: () => void;
};

const routeExists = (routeNames: string[] | undefined, routeName: string) =>
  Array.isArray(routeNames) && routeNames.includes(routeName);

export function ActionSheet({ visible, onClose, navigation }: ActionSheetProps) {
  const navigateToClientsTab = () => {
    const parent = navigation.getParent?.();
    const parentRouteNames = parent?.getState?.()?.routeNames;
    const ownRouteNames = navigation.getState?.()?.routeNames;

    if (parent && routeExists(parentRouteNames, 'MainTabs')) {
      parent.navigate('MainTabs', { screen: 'ClientesTab' });
      return;
    }

    if (routeExists(ownRouteNames, 'MainTabs')) {
      navigation.navigate('MainTabs', { screen: 'ClientesTab' });
      return;
    }

    navigation.navigate('ClientesTab');
  };

  const handleActionPress = (handler: () => void) => {
    onClose();
    requestAnimationFrame(handler);
  };

  const actions: ActionItem[] = [
    {
      key: 'add-expense',
      label: 'Registrar gasto',
      subtitle: 'Lançar nova despesa',
      iconName: 'minus-circle',
      iconColor: colors.danger,
      onPress: () => navigation.navigate('AddExpense'),
    },
    {
      key: 'add-client',
      label: 'Criar cobrança (novo cliente)',
      subtitle: 'Cadastrar cliente e definir valor',
      iconName: 'user-plus',
      iconColor: colors.info,
      onPress: () => navigation.navigate('AddClient'),
    },
    {
      key: 'charge-existing',
      label: 'Cobrar cliente existente',
      subtitle: 'Escolher cliente na lista',
      iconName: 'users',
      iconColor: colors.warning,
      onPress: navigateToClientsTab,
    },
    {
      key: 'register-payment',
      label: 'Registrar recebimento',
      subtitle: 'Marcar cobrança como paga',
      iconName: 'check-circle',
      iconColor: colors.success,
      onPress: () =>
        navigation.navigate('Cobrancas', { mode: 'receive', initialFilter: 'DUE_TODAY' }),
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ações rápidas" testID="home-action-sheet">
      <View>
        {actions.map((action, index) => (
          <View key={action.key}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => handleActionPress(action.onPress)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.bg : colors.surface,
                },
              ]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.sm,
                }}
              >
                <Icon name={action.iconName} size={18} color={action.iconColor} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                  {action.label}
                </Text>
                <Text style={[typography.caption, { color: colors.muted, marginTop: 2 }]}>
                  {action.subtitle}
                </Text>
              </View>
            </Pressable>

            {index < actions.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
