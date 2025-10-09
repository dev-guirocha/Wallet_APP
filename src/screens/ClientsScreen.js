// /src/screens/ClientsScreen.js

import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
  Alert,
  Linking,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { formatCurrency } from '../utils/dateUtils';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
  cardBackground: '#DAD8D3',
  status: {
    paid: '#5CB85C',
    pending: '#F0AD4E',
  },
  actions: {
    edit: '#2E86C1',
    delete: '#C70039',
  }
};

// O array de dados de exemplo 'allClients' foi REMOVIDO daqui.

const ClientsScreen = ({ clientTerm, navigation, clients, onTogglePayment, onDeleteClient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const swipeListViewRef = useRef(null);

  // =======================================================
  // CHECKPOINT 8: STATUS DO CLIENTE ATUALIZADO
  // =======================================================
  const clientsWithStatus = useMemo(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    return clients.map(client => {
      const isPaid = client.payments && client.payments[currentMonthKey] === 'pago';
      return {
        ...client,
        status: isPaid ? 'Pago este mês' : `Vence dia ${client.dueDay}`,
        statusColor: isPaid ? COLORS.status.paid : COLORS.status.pending,
      };
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clientsWithStatus
      .filter((client) => client.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        // pendente primeiro
        const aPaid = a.status === 'Pago este mês';
        const bPaid = b.status === 'Pago este mês';
        if (aPaid !== bPaid) return aPaid ? 1 : -1;
        // depois por nome
        return a.name.localeCompare(b.name);
      });
  }, [searchQuery, clientsWithStatus]);

  const closeAllOpenRows = () => {
    swipeListViewRef.current?.closeAllOpenRows?.();
  };


  // Helper to resolve items by key (id)
  const getItemById = (id) => filteredClients.find(c => c.id === id) || clients.find(c => c.id === id);

  const handleTogglePayment = (client) => {
    onTogglePayment?.(client.id);
    closeAllOpenRows();
  };

  const openWhatsApp = async (digits) => {
    const d = String(digits || '').replace(/\D+/g, '');
    if (d.length < 10) {
      Alert.alert('WhatsApp', 'Telefone inválido para WhatsApp.');
      return;
    }
    // Sempre prefixa com código do país BR (55)
    const url = `https://wa.me/55${d}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp não disponível', 'Não foi possível abrir o WhatsApp neste dispositivo.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Ocorreu um erro ao tentar abrir o WhatsApp.');
    }
  };

  const renderClientCard = ({ item }) => {
    const formattedValue = formatCurrency(item.value || 0);
    const paymentStatusLabel = item.status === 'Pago este mês' ? 'Pago' : 'Pendente';
    const locationLabel = item.location ? item.location : 'Local não informado';
    const phoneDigits = String(item.phone || '').replace(/\D+/g, '');
    const phoneLabel = item.phone || 'Telefone não informado';
    const canCall = phoneDigits.length >= 10;

    return (
      <TouchableHighlight
        style={styles.cardWrapper}
        underlayColor={'rgba(30,30,30,0.08)'}
        onPress={() => navigation.navigate('ClientDetail', { client: item, clientTerm })}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.clientName}>{item.name}</Text>
              <View
                style={[styles.statusBadge, { backgroundColor: item.statusColor }]}
              >
                <Text style={styles.statusBadgeText}>{paymentStatusLabel}</Text>
              </View>
            </View>
            <View style={styles.valuePill}>
              <Icon name="dollar-sign" size={16} color="#1E1E1E" />
              <Text style={styles.valuePillText}>R$ {formattedValue}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Icon name="map-pin" size={16} color="rgba(30,30,30,0.6)" />
              <Text style={styles.infoText}>{locationLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.infoRow}
              activeOpacity={canCall ? 0.7 : 1}
              onPress={() => {
                if (canCall) Linking.openURL(`tel:${phoneDigits}`);
              }}
              onLongPress={() => {
                if (canCall) openWhatsApp(phoneDigits);
              }}
            >
              <Icon name="phone" size={16} color="rgba(30,30,30,0.6)" />
              <Text style={[styles.infoText, !canCall && { opacity: 0.6 }]}>{phoneLabel}</Text>
            </TouchableOpacity>
            <View style={styles.infoRow}>
              <Icon name="calendar" size={16} color="rgba(30,30,30,0.6)" />
              <Text style={styles.infoText}>{item.status}</Text>
            </View>
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  const renderHiddenActions = ({ item }) => (
    <View style={styles.rowBack}>
      {/* ESQUERDA → Editar */}
      <TouchableOpacity
        style={[styles.backBtn, styles.backBtnLeft]}
        onPress={() => {
          swipeListViewRef.current?.closeAllOpenRows?.();
          navigation.navigate('AddClient', { clientToEdit: item, clientTerm });
        }}
      >
        <Icon name="edit-2" size={24} color="#FFF" />
        <Text style={styles.backBtnText}>Editar</Text>
      </TouchableOpacity>
  
      {/* DIREITA → Pagou */}
      <TouchableOpacity
        style={[styles.backBtn, styles.backBtnRight]}
        onPress={() => {
          onTogglePayment?.(item.id);
          swipeListViewRef.current?.closeAllOpenRows?.();
        }}
      >
        <Icon name="check" size={24} color="#FFF" />
        <Text style={styles.backBtnText}>Pagou</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{clientTerm}s</Text>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={COLORS.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Buscar por nome...`}
            placeholderTextColor={COLORS.placeholder}
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

        // --- SWIPE CONFIG (Android-like “arrastar até apertar”) ---
        leftOpenValue={90}
        rightOpenValue={-90}
        stopLeftSwipe={100}
        stopRightSwipe={-100}

        // Ao ativar, dispara ação + fecha a linha com rowMap (mais confiável)
        onLeftAction={(rowKey, rowMap) => {
          const item = getItemById(rowKey);
          if (item) {
            navigation.navigate('AddClient', { clientToEdit: item, clientTerm });
          }
          if (rowMap?.[rowKey]?.closeRow) {
            rowMap[rowKey].closeRow();
          } else {
            closeAllOpenRows();
          }
        }}
        onRightAction={(rowKey, rowMap) => {
          const item = getItemById(rowKey);
          if (item) {
            handleTogglePayment(item);
          }
          if (rowMap?.[rowKey]?.closeRow) {
            rowMap[rowKey].closeRow();
          } else {
            closeAllOpenRows();
          }
        }}

        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddClient')}>
        <Icon name="user-plus" size={24} color={COLORS.background} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 30, paddingBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.05)', borderRadius: 10, paddingHorizontal: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 50, fontSize: 16, color: COLORS.text },
  listContainer: { paddingHorizontal: 30, paddingTop: 20, paddingBottom: 120 },
  cardWrapper: { borderRadius: 22 },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    minHeight: 120,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  statusBadge: { marginLeft: 12, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgePaid: { backgroundColor: COLORS.status.paid },
  statusBadgePending: { backgroundColor: COLORS.status.pending },
  statusBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  valuePillText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardBody: {},
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 8, fontSize: 14, color: COLORS.accent, flexShrink: 1 },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.placeholder },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } },
  rowBack: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderRadius: 26,
    overflow: 'hidden',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90, // Largura dos botões
  },
  backBtnLeft: {
    backgroundColor: COLORS.actions.edit,
    left: 0,
  },
  backBtnRight: {
    backgroundColor: COLORS.status.paid,
    right: 0,
  },
  backBtnText: {
    color: '#FFF',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ClientsScreen;
