import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { translateText } from './apiservice';

const Professionals = ({ selectedLanguage }) => {
  const navigation = useNavigation();
  const [translatedContent, setTranslatedContent] = useState('');

  const originalContent = `
    Workplace and Business Law:
    - **Employee Rights**: Know your rights to fair wages, safe working conditions, and non-discrimination.
    - **Contracts**: Understand employment contracts, NDAs, and non-compete clauses.
    - **Dispute Resolution**: Legal steps for addressing workplace disputes or harassment.
  `;

  useEffect(() => {
    const translateContent = async () => {
      try {
        const translated = await translateText(originalContent, 'en', selectedLanguage);
        setTranslatedContent(translated);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(originalContent);
      }
    };
    translateContent();
  }, [selectedLanguage]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workplace and Business Law</Text>
      <Text style={styles.content}>{translatedContent || originalContent}</Text>

      <TouchableOpacity
        style={styles.assistantButton}
        onPress={() => navigation.navigate('ChatScreen')}
      >
        <Ionicons name="chatbubbles-outline" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  content: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  assistantButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007bff',
    borderRadius: 30,
    padding: 15,
    elevation: 5,
  },
});

export default Professionals;