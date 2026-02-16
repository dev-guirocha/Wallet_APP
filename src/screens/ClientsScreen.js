import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AppScreen,
  Button,
  Card,
  ListContainer,
  MoneyText,
  ScreenHeader,
  StatusPill,
} from '../components';
import { useClientStore } from '../store/useClientStore';
import { getMonthKey } from '../utils/dateUtils';
import { buildPhoneE164FromRaw, openWhatsAppWithMessage } from '../utils/whatsapp';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

const getClientName = (client) => {
  const normalized = String(client?.name || '').trim();
  return normalized || 'Sem nome';
};

const resolveStatusLabel = (isPaid, dueDay) => {
  if (isPaid) return 'Pago';
  const day = Number(dueDay);
  if (Number.isFinite(day) && day > 0) return `Vence dia ${day}`;
  return 'Pendente';
};

const ClientRow = memo(function ClientRow({
  item,
  onPress,
  onTogglePayment,
  onOpenWhatsApp,
}) {
  const phoneE164 =
    item?.phoneE164 || buildPhoneE164FromRaw(item?.phoneRaw || item?.phone || '');
  const canMessage = Boolean(phoneE164);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes de ${item.clientName}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.itemPressed]}
    >
      <Card style={styles.clientCard}>
        <View style={styles.clientTopRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={styles.clientSubtitle} numberOfLines={1}>
              {item.location || 'Sem local definido'}
            </Text>
          </View>

          <View style={styles.amountBlock}>
            <MoneyText
              value={Number(item?.value || 0)}
              variant="sm"
              tone={item.isPaid ? 'success' : 'neutral'}
            />
            <StatusPill status={item.pillStatus} label={item.statusLabel} style={styles.statusPill} />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            label={item.isPaid ? 'Desfazer recebimento' : 'Registrar recebimento'}
            variant={item.isPaid ? 'secondary' : 'primary'}
            onPress={onTogglePayment}
            accessibilityLabel={`${item.isPaid ? 'Desfazer recebimento de' : 'Registrar recebimento de'} ${item.clientName}`}
            style={styles.primaryAction}
            textStyle={styles.actionText}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Enviar mensagem para ${item.clientName}`}
            onPress={onOpenWhatsApp}
            disabled={!canMessage}
            style={({ pressed }) => [
              styles.messageButton,
              !canMessage && styles.messageButtonDisabled,
              pressed && canMessage ? styles.messageButtonPressed : null,
            ]}
          >
            <Icon name="message-circle" size={18} color={canMessage ? COLORS.success : COLORS.textSecondary} />
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
});

const ClientsScreen = ({ navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const isLoading = useClientStore((state) => Boolean(state.isLoading));
  const clientTerm = useClientStore((state) => state.clientTerm);
  const togglePayment = useClientStore((state) => state.togglePayment);

  const [searchQuery, setSearchQuery] = useState('');
  const currentMonthKey = getMonthKey();

  const hasDataError = !Array.isArray(clients);

  const clientsWithStatus = useMemo(() => {
    const source = Array.isArray(clients) ? clients : [];
    return source
      .map((client) => {
        const status = normalizePaymentStatus(client?.payments?.[currentMonthKey]);
        const isPaid = status === 'paid';
        return {
          ...client,
          clientName: getClientName(client),
          isPaid,
          statusLabel: resolveStatusLabel(isPaid, client?.dueDay),
          pillStatus: isPaid ? 'PAID' : 'PENDING',
        };
      })
      .sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return String(a.clientName || '').localeCompare(String(b.clientName || ''));
      });
  }, [clients, currentMonthKey]);

  const filteredClients = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) return clientsWithStatus;
    return clientsWithStatus.filter((client) =>
      String(client?.clientName || '').toLowerCase().includes(query)
    );
  }, [clientsWithStatus, searchQuery]);

  const handleTogglePayment = useCallback(
    async (client) => {
      if (!client?.id) return;
      try {
        await togglePayment(client.id, currentMonthKey);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_error) {
        // store handles optimistic update/sync; keep silent failure here.
      }
    },
    [currentMonthKey, togglePayment]
  );

  const handleOpenWhatsApp = useCallback(async (client) => {
    const phoneE164 =
      client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
    if (!phoneE164) return;
    await openWhatsAppWithMessage({ phoneE164, message: '' });
  }, []);

  const handlePressClient = useCallback(
    (client) => navigation.navigate('ClientDetail', { clientId: client.id }),
    [navigation]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <ClientRow
        item={item}
        onPress={() => handlePressClient(item)}
        onTogglePayment={() => handleTogglePayment(item)}
        onOpenWhatsApp={() => handleOpenWhatsApp(item)}
      />
    ),
    [handleOpenWhatsApp, handlePressClient, handleTogglePayment]
  );

  return (
    <AppScreen style={styles.safeArea} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Clientes"
        actionLabel="Novo"
        onActionPress={() => navigation.navigate('AddClient')}
      />

      <Card style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Buscar ${String(clientTerm || 'cliente').toLowerCase()}...`}
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            accessibilityLabel="Buscar clientes"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </Card>

      <ListContainer
        loading={!hasDataError && isLoading}
        error={hasDataError ? 'Não foi possível montar a lista agora.' : ''}
        onRetry={hasDataError ? () => setSearchQuery('') : undefined}
        isEmpty={!hasDataError && !isLoading && filteredClients.length === 0}
        emptyTitle="Nenhum cliente encontrado"
        emptyMessage={searchQuery ? 'Ajuste sua busca para encontrar um cliente.' : 'Cadastre seu primeiro cliente para começar.'}
        emptyActionLabel="Cadastrar cliente"
        onEmptyAction={() => navigation.navigate('AddClient')}
        skeletonCount={5}
        style={styles.stateBlock}
      >
        {!hasDataError && !isLoading && filteredClients.length > 0 ? (
          <FlatList
            data={filteredClients}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
            initialNumToRender={8}
            windowSize={8}
            removeClippedSubviews
          />
        ) : null}
      </ListContainer>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 12,
  },
  searchCard: {
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  stateBlock: {
    marginTop: 6,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  itemPressed: {
    opacity: 0.92,
  },
  clientCard: {
    marginBottom: 2,
  },
  clientTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nameBlock: {
    flex: 1,
  },
  clientName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.textPrimary,
  },
  clientSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  statusPill: {
    marginTop: 6,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryAction: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
  },
  actionText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonDisabled: {
    opacity: 0.45,
  },
  messageButtonPressed: {
    opacity: 0.8,
  },
});

export default ClientsScreen;
