import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import Swiper from 'react-native-swiper';
import { Feather as Icon } from '@expo/vector-icons';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
};

const onboardingData = [
  {
    iconName: 'pie-chart',
    title: 'Clareza e Controle',
    description: 'Gerencie seus recebimentos, despesas e clientes em um único lugar.',
  },
  {
    iconName: 'calendar',
    title: 'Agenda Inteligente',
    description: 'Organize seus compromissos e visualize sua rotina diária.',
  },
  {
    iconName: 'award',
    title: 'Foco no Essencial',
    description: 'Menos burocracia, mais tempo para o que realmente importa.',
  },
];

const OnboardingScreen = ({ onComplete }) => {
  // ETAPA 1: Criar uma "referência" para controlar o Swiper de fora
  const swiperRef = useRef(null);

  // ETAPA 2: Criar um "estado" para saber em qual slide estamos
  const [currentIndex, setCurrentIndex] = useState(0);

  // ETAPA 3: Criar a função que o botão vai chamar
  const handlePress = () => {
    // Verifica se não estamos no último slide
    if (currentIndex < onboardingData.length - 1) {
      // Manda o swiper avançar 1 slide
      swiperRef.current.scrollBy(1);
    } else {
      // Se já estivermos no último, chama a função para completar
      onComplete();
    }
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <Swiper
        // Conecta nossa referência ao componente Swiper
        ref={swiperRef}
        style={styles.wrapper}
        showsButtons={false}
        loop={false}
        activeDotColor={COLORS.text}
        dotColor={'rgba(30, 30, 30, 0.2)'}
        // Atualiza nosso "estado" toda vez que o slide muda
        onIndexChanged={(index) => setCurrentIndex(index)}
      >
        {onboardingData.map((item, index) => (
          <View key={index} style={styles.slide}>
            <Icon name={item.iconName} size={100} color={COLORS.text} style={styles.icon} />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ))}
      </Swiper>

      <View style={styles.footer}>
        {/* ETAPA 4: O botão agora chama nossa nova função */}
        <TouchableOpacity style={styles.doneButton} onPress={handlePress}>
          {/* O texto do botão agora muda dinamicamente */}
          <Text style={styles.doneButtonText}>
            {currentIndex < onboardingData.length - 1 ? 'Continuar' : 'Começar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wrapper: {},
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: {
    marginBottom: 50,
  },
  title: {
    fontSize: 24,
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
    lineHeight: 25,
    fontFamily: 'System',
  },
  footer: {
    padding: 30,
    paddingTop: 0,
  },
  doneButton: {
    backgroundColor: COLORS.text,
    paddingVertical: 16,
    borderRadius: 30,
  },
  doneButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'System',
  },
});

export default OnboardingScreen;
