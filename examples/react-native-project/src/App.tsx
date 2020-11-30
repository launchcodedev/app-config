import config from '@lcdev/app-config';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  // notice that TypeScript knows the type of externalApiUrl
  console.log('externalApiUrl:', config.externalApiUrl);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App Config</Text>
      <Text>{JSON.stringify(config)}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 40,
    marginBottom: 20,
    fontWeight: '700',
  }
});
