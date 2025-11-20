import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { translateText } from './apiservice';

const Students = ({ selectedLanguage }) => {
  const navigation = useNavigation();
  const [translatedContent, setTranslatedContent] = useState('');

  const originalContent = `
    Legal Guidance for Students:
    - **Education Laws**: You have the right to a safe learning environment under laws like the Right to Education Act.
    - **Student Rights**: Protection against discrimination and unfair treatment in schools or colleges.
    - **Scholarships**: Understand eligibility and legal processes for scholarships like the National Scholarship Scheme.
  `;

  useEffect(() => {
    const translateContent = async () => {
      try {
        const translated = await translateText(originalContent, 'en', selectedLanguage);
        setTranslatedContent(translated);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(originalContent); // Fallback to original if translation fails
      }
    };
    translateContent();
  }, [selectedLanguage]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Legal Guidance for Students</Text>
      <Text style={styles.content}>{translatedContent || originalContent}</Text>

      {/* Hovering AI Assistant Button */}
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

export default Students;