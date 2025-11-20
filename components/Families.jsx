import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { translateText } from './apiservice';

const Families = ({ selectedLanguage }) => {
  const navigation = useNavigation();
  const [translatedContent, setTranslatedContent] = useState('');

  const originalContent = `
    Family and Personal Legal Matters:
    - **Marriage Laws**: Legal requirements for marriage registration and rights of spouses.
    - **Divorce**: Understand the grounds for divorce and alimony laws.
    - **Child Custody**: Rights and responsibilities in custody arrangements.
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
      <Text style={styles.title}>Family and Personal Legal Matters</Text>
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

export default Families;