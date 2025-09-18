import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  labelActive: {
    color: '#ffffff',
  },
});
