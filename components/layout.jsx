import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal,
  SafeAreaView 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Language configuration - moved to main component for consistency
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', bhashiniCode: 'en' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', bhashiniCode: 'hi' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', bhashiniCode: 'bn' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳', bhashiniCode: 'gu' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳', bhashiniCode: 'kn' },
  { code: 'ml', name: 'മലയാളം', flag: '🇮🇳', bhashiniCode: 'ml' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳', bhashiniCode: 'mr' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳', bhashiniCode: 'ta' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳', bhashiniCode: 'te' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', bhashiniCode: 'ur' }
];

const Layout = ({ 
  children, 
  navigation, 
  selectedLanguage, 
  onLanguageChange,
  activeTab = 'Home',
  onTabChange 
}) => {
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const handleLanguageChange = (language) => {
    onLanguageChange(language);
    setLanguageModalVisible(false);
  };

  const handleTabPress = (tabName, route) => {
    if (onTabChange) {
      onTabChange(tabName);
    }
    if (navigation && route) {
      navigation.navigate(route);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>LegalEase</Text>
          <Text style={styles.headerSubtitle}>Know Your Rights</Text>
        </View>
        <TouchableOpacity
          style={styles.languageSelector}
          onPress={() => setLanguageModalVisible(true)}
        >
          <Text style={styles.languageFlag}>{selectedLanguage.flag}</Text>
          <Text style={styles.languageText}>{selectedLanguage.name}</Text>
          <Text style={styles.languageIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Language Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={languageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.languageModal}>
            <Text style={styles.modalTitle}>Select Language</Text>
            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageOption,
                  selectedLanguage.code === language.code && styles.selectedLanguage,
                ]}
                onPress={() => handleLanguageChange(language)}
              >
                <Text style={styles.optionFlag}>{language.flag}</Text>
                <Text style={styles.optionText}>{language.name}</Text>
                {selectedLanguage.code === language.code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {children}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'Home' && styles.activeNavItem]}
          onPress={() => handleTabPress('Home', 'Home')}
        >
          <Text style={[styles.navIcon, activeTab === 'Home' && styles.activeNavIcon]}>🏠</Text>
          <Text style={[styles.navText, activeTab === 'Home' && styles.activeNavText]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'Learn' && styles.activeNavItem]}
          onPress={() => handleTabPress('Learn', 'Learn')}
        >
          <Text style={[styles.navIcon, activeTab === 'Learn' && styles.activeNavIcon]}>📚</Text>
          <Text style={[styles.navText, activeTab === 'Learn' && styles.activeNavText]}>Learn</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'Quiz' && styles.activeNavItem]}
          onPress={() => handleTabPress('Quiz', 'Quiz')}
        >
          <Text style={[styles.navIcon, activeTab === 'Quiz' && styles.activeNavIcon]}>🧪</Text>
          <Text style={[styles.navText, activeTab === 'Quiz' && styles.activeNavText]}>Quiz</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'Profile' && styles.activeNavItem]}
          onPress={() => handleTabPress('Profile', 'Profile')}
        >
          <Text style={[styles.navIcon, activeTab === 'Profile' && styles.activeNavIcon]}>👤</Text>
          <Text style={[styles.navText, activeTab === 'Profile' && styles.activeNavText]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  languageFlag: {
    fontSize: 16,
    marginRight: 6,
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  languageIcon: {
    color: '#94A3B8',
    fontSize: 12,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageModal: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedLanguage: {
    backgroundColor: '#E2E8F0',
  },
  optionFlag: {
    fontSize: 18,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  checkmark: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Main Content
  mainContent: {
    flex: 1,
  },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavItem: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
    color: '#64748B',
  },
  activeNavIcon: {
    color: '#1E293B',
  },
  navText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  activeNavText: {
    color: '#1E293B',
    fontWeight: '600',
  },
});

// Export languages for use in other components
export { LANGUAGES };
export default Layout;