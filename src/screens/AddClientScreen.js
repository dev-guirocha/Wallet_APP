// /src/screens/AddClientScreen.js

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const AddClientScreen = ({ navigation, route, onAddClient }) => {
  const { clientTerm } = route.params;
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [classTime, setClassTime] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [phone, setPhone] = useState('');

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = () => {
    const newClientData = {
      name, location, days: selectedDays, time: classTime,
      value: monthlyValue, dueDay: dueDate, phone,
    };
    onAddClient(newClientData);
    console.log('Salvando novo cliente:', newClientData);
    // Aqui virá a lógica para salvar no Firebase.
    navigation.goBack(); // Volta para a tela anterior após salvar
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="x" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Novo {clientTerm}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Salvar</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome do {clientTerm}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Local de Atendimento</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dias da Semana</Text>
          <View style={styles.weekdaysContainer}>
            {WEEKDAYS.map(day => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonSelected]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayText, selectedDays.includes(day) && styles.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Horário</Text>
            <TextInput style={styles.input} value={classTime} onChangeText={setClassTime} placeholder="Ex: 14:00" />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.label}>Valor Mensal</Text>
            <TextInput style={styles.input} value={monthlyValue} onChangeText={setMonthlyValue} keyboardType="numeric" placeholder="R$"/>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Data de Pagamento</Text>
            <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} keyboardType="numeric" placeholder="Dia"/>
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(30,30,30,0.1)' },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  saveButton: { backgroundColor: COLORS.text, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  saveButtonText: { color: COLORS.background, fontWeight: 'bold' },
  container: { padding: 20 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 16, color: COLORS.accent, marginBottom: 8 },
  input: { backgroundColor: 'rgba(30,30,30,0.05)', height: 50, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, color: COLORS.text },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekdaysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.05)' },
  dayButtonSelected: { backgroundColor: COLORS.text },
  dayText: { color: COLORS.text, fontWeight: 'bold' },
  dayTextSelected: { color: COLORS.background },
});

export default AddClientScreen;