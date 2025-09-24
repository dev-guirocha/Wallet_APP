import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
};

// Lista de profissões da área da saúde (em minúsculas e sem acentos para facilitar a comparação)
const healthProfessions = [
  'fisioterapeuta',
  'fonoaudiologo',
  'medico',
  'medica',
  'profissional de educacao fisica',
  'personal trainer',
  'dentista',
  'odontologo',
  'odontologa',
  'terapeuta',
  'medico veterinario',
  'veterinario',
  'veterinaria',
  'farmaceutico',
  'farmaceutica',
  'biomedico',
  'biomedica',
  'enfermeiro',
  'enfermeira',
  'psicologo',
  'psicologa',
  'nutricionista',
  'terapeuta ocupacional',
];

// O onComplete agora receberá o termo a ser usado no app ('Paciente' ou 'Cliente')
const ProfessionScreen = ({ onComplete }) => {
  const [profession, setProfession] = useState('');

  const handleContinue = () => {
    // Normaliza o texto digitado para uma comparação mais segura
    const normalizedProfession = profession.trim().toLowerCase();

    // Verifica se a profissão está na lista da área da saúde
    if (healthProfessions.includes(normalizedProfession)) {
      onComplete('Paciente'); // Se for da saúde, o termo é "Paciente"
    } else {
      onComplete('Cliente'); // Caso contrário, o termo é "Cliente"
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          <Icon name="briefcase" size={60} color={COLORS.text} style={styles.mainIcon} />
          
          <Text style={styles.title}>Qual é a sua profissão?</Text>
          <Text style={styles.description}>
            Isso nos ajuda a personalizar sua experiência no aplicativo.
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Ex: Fisioterapeuta"
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="words"
            value={profession}
            onChangeText={setProfession} // Atualiza o estado a cada letra digitada
          />
        </View>
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 30,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainIcon: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'System',
  },
  description: {
    fontSize: 17,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'System',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(30, 30, 30, 0.05)',
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 15,
    fontFamily: 'System',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.text,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 20,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'System',
  },
});

export default ProfessionScreen;