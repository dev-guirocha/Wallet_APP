// /src/screens/ClientsScreen.js

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import * as Haptics from 'expo-haptics';

import { formatCurrency, getMonthKey } from '../utils/dateUtils';
import { useClientStore } from '../store/useClientStore';
import { buildPhoneE164FromRaw, openWhatsAppWithMessage } from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

const ClientsScreen = ({ navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const clientTerm = useClientStore((state) => state.clientTerm);
  const togglePayment = useClientStore((state) => state.togglePayment);

  const [searchQuery, setSearchQuery] = useState('');
  const swipeListViewRef = useRef(null);
  const currentMonthKey = getMonthKey();

  const clientsWithStatus = useMemo(() => {
    return clients.map((client) => {
      const status = normalizePaymentStatus(client.payments?.[currentMonthKey]);
      const isPaid = status === 'paid';
      return {
        ...client,
        statusLabel: isPaid ? 'Pago' : `Vence dia ${client.dueDay}`,
        isPaid,
      };
    });
  }, [clients, currentMonthKey]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return clientsWithStatus
      .filter((client) => client.name.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [searchQuery, clientsWithStatus]);

  const closeAllOpenRows = () => swipeListViewRef.current?.closeAllOpenRows?.();

  const handleTogglePayment = (client) => {
    togglePayment(client.id, currentMonthKey);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeAllOpenRows();
  };

  const openWhatsApp = async (client) => {
    const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
    await openWhatsAppWithMessage({ phoneE164, message: '' });
  };

  const renderClientCard = ({ item }) => {
    const formattedValue = formatCurrency(item.value || 0);
    const phoneE164 = item.phoneE164 || buildPhoneE164FromRaw(item.phoneRaw || item.phone || '');
    const canCall = Boolean(phoneE164);
    const avatarBg = item.isPaid ? 'rgba(56,161,105,0.16)' : 'rgba(113,128,150,0.16)';
    const avatarTextColor = item.isPaid ? COLORS.success : COLORS.textSecondary;

    return (
      <TouchableHighlight
        style={styles.cardWrapper}
        underlayColor={COLORS.background}
        onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
      >
        <View style={styles.card}
        >
          <View style={styles.cardHeader}
          >
            <View style={styles.headerLeft}
            >
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}
              >
                <Text style={[styles.avatarText, { color: avatarTextColor }]}
                >
                  {item.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.nameBlock}
              >
                <Text style={styles.clientName} numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.statusText, item.isPaid ? styles.textSuccess : styles.textWarning]}
                >
                  {item.statusLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.valueText}
            >
              {formattedValue}
            </Text>
          </View>

          <View style={styles.divider}
          />

          <View style={styles.cardFooter}
          >
            <View style={styles.footerInfo}
            >
              <Icon name="map-pin" size={14} color={COLORS.textSecondary} />
              <Text style={styles.footerText} numberOfLines={1}
              >
                {item.location || 'Sem local'}
              </Text>
            </View>
            {canCall ? (
              <TouchableOpacity onPress={() => openWhatsApp(item)}
              >
                <Icon name="message-circle" size={20} color={COLORS.success} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  const renderHiddenActions = ({ item }) => (
    <View style={styles.rowBack}
    >
      <TouchableOpacity
        style={[styles.backBtn, styles.btnEdit]}
        onPress={() => {
          closeAllOpenRows();
          navigation.navigate('AddClient', { clientId: item.id });
        }}
      >
        <Icon name="edit-2" size={24} color={COLORS.textOnPrimary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.backBtn, item.isPaid ? styles.btnUndo : styles.btnPay]}
        onPress={() => handleTogglePayment(item)}
      >
        <Icon name={item.isPaid ? 'rotate-ccw' : 'check'} size={24} color={COLORS.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}
    >
      <View style={styles.header}
      >
        <Text style={styles.title}
        >
          {clientTerm}s
        </Text>
        <View style={styles.searchBar}
        >
          <Icon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <SwipeListView
        ref={swipeListViewRef}
        data={filteredClients}
        keyExtractor={(item) => item.id}
        renderItem={renderClientCard}
        renderHiddenItem={renderHiddenActions}
        leftOpenValue={75}
        rightOpenValue={-75}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddClient')}
      >
        <Icon name="plus" size={28} color={COLORS.textOnPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 24, backgroundColor: COLORS.background },
  title: { ...TYPOGRAPHY.display, color: COLORS.textPrimary, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { ...TYPOGRAPHY.body, flex: 1, marginLeft: 12, color: COLORS.textPrimary },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  cardWrapper: { borderRadius: 16, ...SHADOWS.small },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  nameBlock: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { ...TYPOGRAPHY.subtitle },
  clientName: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  statusText: { ...TYPOGRAPHY.caption, marginTop: 2 },
  textSuccess: { color: COLORS.success },
  textWarning: { color: COLORS.warning },
  valueText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  footerText: { ...TYPOGRAPHY.caption, marginLeft: 6, color: COLORS.textSecondary },
  rowBack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  backBtn: { width: 75, alignItems: 'center', justifyContent: 'center' },
  btnEdit: { backgroundColor: COLORS.primary },
  btnPay: { backgroundColor: COLORS.success },
  btnUndo: { backgroundColor: COLORS.warning },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
});

export default ClientsScreen;
