import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Import our custom components and services
import Layout from './layout';


import AIService, { SUPPORTED_LANGUAGES, isApiConfigured, BHASHINI_LANGUAGE_CODES } from './apiservice';

// --- Static Data (now updated to support translation keys) ---
// These arrays will use translation keys instead of direct text.
const USER_PROFILES_KEYS = [
  { id: 1, nameKey: 'profile_students_name', icon: '🎓', color: '#3B82F6', descriptionKey: 'profile_students_desc' },
  { id: 2, nameKey: 'profile_professionals_name', icon: '💼', color: '#10B981', descriptionKey: 'profile_professionals_desc' },
  { id: 3, nameKey: 'profile_families_name', icon: '👨‍👩‍👧‍👦', color: '#F59E0B', descriptionKey: 'profile_families_desc' },
  { id: 4, nameKey: 'profile_seniors_name', icon: '👴', color: '#8B5CF6', descriptionKey: 'profile_seniors_desc' },
  { id: 5, nameKey: 'profile_entrepreneurs_name', icon: '🚀', color: '#EF4444', descriptionKey: 'profile_entrepreneurs_desc' },
  { id: 6, nameKey: 'profile_tenants_name', icon: '🏠', color: '#06B6D4', descriptionKey: 'profile_tenants_desc' }
];

const LEGAL_CATEGORIES_KEYS = [
  { id: 1, titleKey: 'category_consumer_rights', icon: '🛒', color: '#3B82F6', queries: 12 },
  { id: 2, titleKey: 'category_employment_law', icon: '💼', color: '#10B981', queries: 8 },
  { id: 3, titleKey: 'category_property_rights', icon: '🏘️', color: '#F59E0B', queries: 15 },
  { id: 4, titleKey: 'category_family_law', icon: '👨‍👩‍👧‍👦', color: '#8B5CF6', queries: 6 },
  { id: 5, titleKey: 'category_criminal_law', icon: '⚖️', color: '#EF4444', queries: 4 },
  { id: 6, titleKey: 'category_civil_rights', icon: '✊', color: '#06B6D4', queries: 9 }
];

const QUICK_ACTIONS_KEYS = [
  { id: 1, titleKey: 'action_ask_ai', icon: '🤖', action: 'askAI' },
  { id: 2, titleKey: 'action_find_legal_aid', icon: '🆘', action: 'findAid' },
  { id: 3, titleKey: 'action_download_forms', icon: '📄', action: 'downloadForms' },
  { id: 4, titleKey: 'action_book_consultation', icon: '📅', action: 'bookConsult' }
];

const HomeScreen = ({ navigation }) => {
  const [selectedLanguage, setSelectedLanguage] = useState(SUPPORTED_LANGUAGES[0]);
  const [askAIModalVisible, setAskAIModalVisible] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [soundObject, setSoundObject] = useState(null); // To manage playback of AI response audio
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // To track audio playback state

  useEffect(() => {
    checkAPIConfiguration();
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access microphone is required for audio input.');
      }
    })();

    // Cleanup audio playback object on unmount
    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
    };
  }, [soundObject]); // Re-run effect if soundObject changes to ensure cleanup

  const checkAPIConfiguration = async () => {
    try {
      const configStatus = isApiConfigured();
      setApiConfigured(configStatus.hasAnyConfig); 
    } catch (error) {
      console.error('Error checking API configuration:', error);
    }
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);
  };

  const handleProfileSelect = (profile) => {
    setSelectedProfile(profile);
    // Use translated name for alert
    Alert.alert(getTranslatedText('profile_selected_title'), `${getTranslatedText(profile.nameKey)}.`);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'askAI':
        setAskAIModalVisible(true);
        break;
      case 'findAid':
        Alert.alert(getTranslatedText('action_find_legal_aid'), getTranslatedText('redirecting_legal_aid'));
        break;
      case 'downloadForms':
        Alert.alert(getTranslatedText('action_download_forms'), getTranslatedText('opening_forms_library'));
        break;
      case 'bookConsult':
        Alert.alert(getTranslatedText('action_book_consultation'), getTranslatedText('opening_consultation_booking'));
        break;
      default:
        break;
    }
  };

  // --- Audio Recording Functions ---
  const startRecording = async () => {
    try {
      // Stop any ongoing recording or playback first
      if (recording) {
        await stopRecording();
      }
      if (soundObject) {
        await soundObject.unloadAsync();
        setSoundObject(null);
        setIsPlayingAudio(false);
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setRecordedUri(null); // Clear previous recording URI
      setUserQuery(''); // Clear text input when starting audio recording
      setAiResponse(''); // Clear previous AI response
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null); // Clear the recording object
      console.log('Recording stopped at', uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Recording Error', 'Could not stop recording.');
    }
  };

  const handleRecordButtonPress = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // --- Audio Playback Function for AI Response ---
  const playAIResponseAudio = async () => {
    if (!aiResponse) {
      Alert.alert('No text', 'No AI response to play.');
      return;
    }

    setIsPlayingAudio(true);
    // Unload existing sound object if any
    if (soundObject) {
      await soundObject.unloadAsync();
      setSoundObject(null);
    }

    try {
      const ttsResult = await AIService.textToSpeech(aiResponse, selectedLanguage.bhashiniCode);
      if (ttsResult.success && ttsResult.data) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: ttsResult.data }, // The data is already a data URI
          { shouldPlay: true }
        );
        setSoundObject(sound);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlayingAudio(false);
            sound.unloadAsync(); // Unload sound after playing
            setSoundObject(null);
          }
        });
      } else {
        Alert.alert('Audio Error', ttsResult.error || 'Failed to generate audio for response.');
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error('Error playing AI response audio:', error);
      Alert.alert('Playback Error', 'Could not play audio. Please try again.');
      setIsPlayingAudio(false);
    }
  };

  // --- AI Query Handling (updated to use audio input and multilingual support) ---
  const handleAskAI = async () => {
    let finalAudioBase64 = null;

    // Determine if we have audio input
    if (recordedUri) {
      console.log("Recorded URI detected:", recordedUri);
      try {
        // Read the recorded audio file as Base64
        finalAudioBase64 = await FileSystem.readAsStringAsync(recordedUri, { encoding: FileSystem.EncodingType.Base64 });
        console.log("Audio prepared for ASR, length:", finalAudioBase64.length, "bytes.");
        if (finalAudioBase64.length === 0) {
            Alert.alert("No Audio Detected", "The recording did not capture any audio. Please ensure your microphone is working and speak clearly.");
            setIsLoading(false);
            return;
        }
      } catch (error) {
        console.error("Error reading audio file:", error);
        Alert.alert("Audio Error", "Could not process recorded audio. Details: " + error.message);
        setIsLoading(false);
        return;
      }
    } else if (!userQuery.trim()) {
      // If no audio and no text, alert the user
      Alert.alert(getTranslatedText('input_required_title'), getTranslatedText('input_required_message'));
      return;
    }
    
    setIsLoading(true);
    setAiResponse(''); // Clear previous response
    if (soundObject) { // Stop any playing audio
      await soundObject.unloadAsync();
      setSoundObject(null);
      setIsPlayingAudio(false);
    }


    try {
      // Call the main AI query function from AIService, passing all relevant data
      const response = await AIService.queryAIWithAudioAndTranslation({
        textQuery: userQuery,
        audioQueryBase64: finalAudioBase64, // Pass Base64 audio if available
        sourceLangCode: selectedLanguage.bhashiniCode, // Use Bhashini code for source language
        targetLangCode: selectedLanguage.bhashiniCode // Use Bhashini code for target language of AI response
      });

      if (response.success) {
        setAiResponse(response.data);
        if (response.warning) {
          Alert.alert(getTranslatedText('note_title'), response.warning);
        }
      } else {
        Alert.alert(getTranslatedText('error_title'), response.error || getTranslatedText('failed_ai_response'));
        setAiResponse(getTranslatedText('ai_processing_error'));
      }
    } catch (error) {
      console.error('AI Query Error:', error);
      Alert.alert(getTranslatedText('error_title'), getTranslatedText('unexpected_error'));
      setAiResponse(getTranslatedText('ai_processing_error'));
    } finally {
      setIsLoading(false);
      setRecordedUri(null); // Clear recorded URI after processing
      setUserQuery(''); // Clear text query after processing
    }
  };

  const clearAIModal = () => {
    setUserQuery('');
    setAiResponse('');
    setRecordedUri(null); // Clear any recorded audio URI
    if (recording) {
      recording.stopAndUnloadAsync(); // Stop and unload if still recording
      setRecording(null);
    }
    if (soundObject) { // Stop any playing audio
      soundObject.unloadAsync();
      setSoundObject(null);
      setIsPlayingAudio(false);
    }
    setAskAIModalVisible(false);
  };

  // --- Translation Helper ---
  const getGreeting = () => {
    const greetings = {
      'en': 'Welcome to Legal Literacy',
      'hi': 'कानूनी साक्षरता में आपका स्वागत है',
      'bn': 'আইনি সাক্ষরতায় স্বাগতম',
      'gu': 'કાનૂની સાક્ષરતામાં આપનું સ્વાગત છે',
      'kn': 'ಕಾನೂನು ಸಾಕ್ಷರತೆಗೆ ಸ್ವಾಗತ',
      'ml': 'നിയമ സാക്ഷരതയിലേക്ക് സ്വാഗതം',
      'mr': 'कायदेशीर साक्षरतेमध्ये आपले स्वागत आहे',
      'ta': 'சட்ட கல்வியறிவுக்கு வரவேற்கிறோம்',
      'te': 'న్యಾಯ ಅಕ್ಷരാಸ್ಯತకు ಸ್ವಾಗತ',
      'ur': 'قانونی خواندگی میں خوش آمدید'
    };
    return greetings[selectedLanguage.code] || greetings['en'];
  };

  const getTranslatedText = (key) => {
    const translations = {
      'en': {
        'welcome_subtitle': 'Know your rights, understand the law',
        'config_warning': '⚠️ AI services not configured. Some features may be limited.',
        'i_am_a': 'I am a...',
        'quick_actions': 'Quick Actions',
        'popular_categories': 'Popular Categories',
        'ask_question_placeholder': 'Ask your legal question here...',
        'ask_ai': 'Ask AI',
        'ai_response_title': 'AI Response:',
        'tap_to_speak': 'Tap to speak',
        'recording': 'Recording...',
        'play_audio': 'Play Audio',
        'stop_audio': 'Stop Audio',
        'ai_legal_assistant': 'AI Legal Assistant',
        'profile_selected_title': 'Profile Selected',
        'action_find_legal_aid': 'Find Legal Aid',
        'action_download_forms': 'Download Forms',
        'action_book_consultation': 'Book Consultation',
        'redirecting_legal_aid': 'Redirecting to legal aid resources...',
        'opening_forms_library': 'Opening legal forms library...',
        'opening_consultation_booking': 'Opening consultation booking...',
        'input_required_title': 'Input Required',
        'input_required_message': 'Please enter your question or record audio.',
        'note_title': 'Note',
        'error_title': 'Error',
        'failed_ai_response': 'Failed to get response from AI.',
        'ai_processing_error': 'Sorry, I could not process your request at the moment. Please try again later.',
        'unexpected_error': 'An unexpected error occurred. Please try again.',
        
        // Profile translations
        'profile_students_name': 'Students',
        'profile_students_desc': 'Legal guidance for students',
        'profile_professionals_name': 'Professionals',
        'profile_professionals_desc': 'Workplace and business law',
        'profile_families_name': 'Families',
        'profile_families_desc': 'Family and personal legal matters',
        'profile_seniors_name': 'Seniors',
        'profile_seniors_desc': 'Rights and benefits for elderly',
        'profile_entrepreneurs_name': 'Entrepreneurs',
        'profile_entrepreneurs_desc': 'Business startup legal guidance',
        'profile_tenants_name': 'Tenants',
        'profile_tenants_desc': 'Rental and housing rights',

        // Category translations
        'category_consumer_rights': 'Consumer Rights',
        'category_employment_law': 'Employment Law',
        'category_property_rights': 'Property Rights',
        'category_family_law': 'Family Law',
        'category_criminal_law': 'Criminal Law',
        'category_civil_rights': 'Civil Rights',
      },
      'hi': {
        'welcome_subtitle': 'अपने अधिकारों को जानें, कानून को समझें',
        'config_warning': '⚠️ AI सेवाएं कॉन्फ़िगर नहीं की गई हैं। कुछ सुविधाएँ सीमित हो सकती हैं।',
        'i_am_a': 'मैं हूँ...',
        'quick_actions': 'त्वरित कार्य',
        'popular_categories': 'लोकप्रिय श्रेणियां',
        'ask_question_placeholder': 'यहाँ अपना कानूनी प्रश्न पूछें...',
        'ask_ai': 'AI से पूछें',
        'ai_response_title': 'AI का उत्तर:',
        'tap_to_speak': 'बोलने के लिए टैप करें',
        'recording': 'रिकॉर्डिंग जारी है...',
        'play_audio': 'ऑडियो चलाएं',
        'stop_audio': 'ऑडियो रोकें',
        'ai_legal_assistant': 'AI कानूनी सहायक',
        'profile_selected_title': 'प्रोफ़ाइल चयनित',
        'action_find_legal_aid': 'कानूनी सहायता ढूँढें',
        'action_download_forms': 'फॉर्म डाउनलोड करें',
        'action_book_consultation': 'परामर्श बुक करें',
        'redirecting_legal_aid': 'कानूनी सहायता संसाधनों पर रीडायरेक्ट कर रहा है...',
        'opening_forms_library': 'कानूनी फॉर्म लाइब्रेरी खोल रहा है...',
        'opening_consultation_booking': 'परामर्श बुकिंग खोल रहा है...',
        'input_required_title': 'इनपुट आवश्यक है',
        'input_required_message': 'कृपया अपना प्रश्न दर्ज करें या ऑडियो रिकॉर्ड करें।',
        'note_title': 'ध्यान दें',
        'error_title': 'त्रुटि',
        'failed_ai_response': 'AI से प्रतिक्रिया प्राप्त करने में विफल रहा।',
        'ai_processing_error': 'क्षमा करें, मैं इस समय आपके अनुरोध को संसाधित नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।',
        'unexpected_error': 'एक अनपेक्षित त्रुटि हुई। कृपया पुन: प्रयास करें।',

        // Profile translations (Hindi)
        'profile_students_name': 'छात्र',
        'profile_students_desc': 'छात्रों के लिए कानूनी मार्गदर्शन',
        'profile_professionals_name': 'पेशेवर',
        'profile_professionals_desc': 'कार्यस्थल और व्यावसायिक कानून',
        'profile_families_name': 'परिवार',
        'profile_families_desc': 'पारिवारिक और व्यक्तिगत कानूनी मामले',
        'profile_seniors_name': 'वरिष्ठ नागरिक',
        'profile_seniors_desc': 'बुजुर्गों के लिए अधिकार और लाभ',
        'profile_entrepreneurs_name': 'उद्यमी',
        'profile_entrepreneurs_desc': 'व्यवसाय शुरू करने के लिए कानूनी मार्गदर्शन',
        'profile_tenants_name': 'किरायेदार',
        'profile_tenants_desc': 'किराया और आवास अधिकार',

        // Category translations (Hindi)
        'category_consumer_rights': 'उपभोक्ता अधिकार',
        'category_employment_law': 'रोजगार कानून',
        'category_property_rights': 'संपत्ति अधिकार',
        'category_family_law': 'पारिवारिक कानून',
        'category_criminal_law': 'आपराधिक कानून',
        'category_civil_rights': 'नागरिक अधिकार',
      },
      // Add more language translations as needed.
      // For simplicity, falling back to English for un-translated keys.
      'bn': {
        'welcome_subtitle': 'আপনার অধিকার জানুন, আইন বুঝুন',
        'config_warning': '⚠️ এআই পরিষেবা কনফিগার করা হয়নি। কিছু বৈশিষ্ট্য সীমিত হতে পারে।',
        'i_am_a': 'আমি একজন...',
        'quick_actions': 'দ্রুত কর্ম',
        'popular_categories': 'জনপ্রিয় বিভাগ',
        'ask_question_placeholder': 'এখানে আপনার আইনি প্রশ্ন জিজ্ঞাসা করুন...',
        'ask_ai': 'এআইকে জিজ্ঞাসা করুন',
        'ai_response_title': 'এআই প্রতিক্রিয়া:',
        'tap_to_speak': 'কথা বলতে আলতো চাপুন',
        'recording': 'রেকর্ডিং হচ্ছে...',
        'play_audio': 'অডিও চালান',
        'stop_audio': 'অডিও বন্ধ করুন',
        'ai_legal_assistant': 'এআই আইনি সহকারী',
        'profile_selected_title': 'প্রোফাইল নির্বাচিত',
        'action_find_legal_aid': 'আইনি সহায়তা খুঁজুন',
        'action_download_forms': 'ফর্ম ডাউনলোড করুন',
        'action_book_consultation': 'পরামর্শ বুক করুন',
        'redirecting_legal_aid': 'আইনি সহায়তা সংস্থানে পুনর্নির্দেশ করা হচ্ছে...',
        'opening_forms_library': 'আইনি ফর্ম লাইব্রেরি খুলছে...',
        'opening_consultation_booking': 'পরামর্শ বুকিং খুলছে...',
        'input_required_title': 'ইনপুট প্রয়োজন',
        'input_required_message': 'অনুগ্রহ করে আপনার প্রশ্ন লিখুন বা অডিও রেকর্ড করুন।',
        'note_title': 'নোট',
        'error_title': 'ত্রুটি',
        'failed_ai_response': 'এআই থেকে প্রতিক্রিয়া পেতে ব্যর্থ হয়েছে।',
        'ai_processing_error': 'দুঃখিত, এই মুহূর্তে আপনার অনুরোধ প্রক্রিয়া করতে পারছি না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
        'unexpected_error': 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।',

        // Profile translations (Bengali)
        'profile_students_name': 'শিক্ষার্থীরা',
        'profile_students_desc': 'শিক্ষার্থীদের জন্য আইনি নির্দেশিকা',
        'profile_professionals_name': 'পেশাদাররা',
        'profile_professionals_desc': 'কর্মক্ষেত্র এবং ব্যবসায়িক আইন',
        'profile_families_name': 'পরিবার',
        'profile_families_desc': 'পারিবারিক এবং ব্যক্তিগত আইনি বিষয়',
        'profile_seniors_name': 'বয়স্করা',
        'profile_seniors_desc': 'বয়স্কদের জন্য অধিকার এবং সুবিধা',
        'profile_entrepreneurs_name': 'উদ্যোক্তারা',
        'profile_entrepreneurs_desc': 'ব্যবসা শুরু করার আইনি নির্দেশিকা',
        'profile_tenants_name': 'ভাড়াটেরা',
        'profile_tenants_desc': 'ভাড়া এবং আবাসন অধিকার',

        // Category translations (Bengali)
        'category_consumer_rights': 'ভোক্তা অধিকার',
        'category_employment_law': 'কর্মসংস্থান আইন',
        'category_property_rights': 'সম্পত্তির অধিকার',
        'category_family_law': 'পারিবারিক আইন',
        'category_criminal_law': 'ফৌজদারি আইন',
        'category_civil_rights': 'নাগরিক অধিকার',
      },
      'gu': { 
        'welcome_subtitle': 'તમારા અધિકારો જાણો, કાયદાને સમજો',
        'config_warning': '⚠️ AI સેવાઓ ગોઠવેલ નથી. કેટલીક સુવિધાઓ મર્યાદિત હોઈ શકે છે.',
        'i_am_a': 'હું છું...',
        'quick_actions': 'ઝડપી કાર્યો',
        'popular_categories': 'લોકપ્રિય શ્રેણીઓ',
        'ask_question_placeholder': 'અહીં તમારો કાનૂની પ્રશ્ન પૂછો...',
        'ask_ai': 'AI ને પૂછો',
        'ai_response_title': 'AI નો પ્રતિભાવ:',
        'tap_to_speak': 'બોલવા માટે ટેપ કરો',
        'recording': 'રેકોર્ડિંગ ચાલુ છે...',
        'play_audio': 'ઑડિઓ ચલાવો',
        'stop_audio': 'ઑડિઓ બંધ કરો',
        'ai_legal_assistant': 'AI કાનૂની સહાયક',
        'profile_selected_title': 'પ્રોફાઇલ પસંદ કરેલ',
        'action_find_legal_aid': 'કાનૂની સહાય શોધો',
        'action_download_forms': 'ફોર્મ ડાઉનલોડ કરો',
        'action_book_consultation': 'સલાહ બુક કરો',
        'redirecting_legal_aid': 'કાનૂની સહાય સંસાધનો પર રીડાયરેક્ટ કરી રહ્યું છે...',
        'opening_forms_library': 'કાનૂની ફોર્મ્સ લાઇબ્રેરી ખોલી રહ્યું છે...',
        'opening_consultation_booking': 'સલાહ બુકિંગ ખોલી રહ્યું છે...',
        'input_required_title': 'ઇનપુટ જરૂરી છે',
        'input_required_message': 'કૃપા કરીને તમારો પ્રશ્ન દાખલ કરો અથવા ઑડિઓ રેકોર્ડ કરો.',
        'note_title': 'નોંધ',
        'error_title': 'ભૂલ',
        'failed_ai_response': 'AI થી પ્રતિભાવ મેળવવામાં નિષ્ફળ.',
        'ai_processing_error': 'માફ કરશો, હું આ સમયે તમારી વિનંતી પર પ્રક્રિયા કરી શકતો નથી. કૃપા કરીને પછીથી ફરી પ્રયાસ કરો.',
        'unexpected_error': 'એક અનપેક્ષિત ભૂલ આવી. કૃપા કરીને ફરી પ્રયાસ કરો।',

        // Profile translations (Gujarati)
        'profile_students_name': 'વિદ્યાર્થીઓ',
        'profile_students_desc': 'વિદ્યાર્થીઓ માટે કાનૂની માર્ગદર્શન',
        'profile_professionals_name': 'વ્યાવસાયિકો',
        'profile_professionals_desc': 'કાર્યસ્થળ અને વ્યવસાય કાયદો',
        'profile_families_name': 'પરિવારો',
        'profile_families_desc': 'પારિવારિક અને વ્યક્તિગત કાનૂની બાબતો',
        'profile_seniors_name': 'વરિષ્ઠ નાગરિકો',
        'profile_seniors_desc': 'વૃદ્ધો માટે અધિકારો અને લાભો',
        'profile_entrepreneurs_name': 'ઉદ્યોગસાહસિકો',
        'profile_entrepreneurs_desc': 'વ્યવસાય શરૂ કરવા માટે કાનૂની માર્ગદર્શન',
        'profile_tenants_name': 'ભાડૂતો',
        'profile_tenants_desc': 'ભાડા અને આવાસ અધિકારો',

        // Category translations (Gujarati)
        'category_consumer_rights': 'ગ્રાહક અધિકારો',
        'category_employment_law': 'રોજગાર કાયદો',
        'category_property_rights': 'સંપત્તિ અધિકારો',
        'category_family_law': 'પારિવારિક કાયદો',
        'category_criminal_law': 'ગુનાહિત કાયદો',
        'category_civil_rights': 'નાગરિક અધિકારો',
      },
      'kn': {
        'welcome_subtitle': 'ನಿಮ್ಮ ಹಕ್ಕುಗಳನ್ನು ತಿಳಿಯಿರಿ, ಕಾನೂನನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
        'config_warning': '⚠️ AI ಸೇವೆಗಳನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಲಾಗಿಲ್ಲ. ಕೆಲವು ವೈಶಿಷ್ಟ್ಯಗಳು ಸೀಮಿತವಾಗಿರಬಹುದು.',
        'i_am_a': 'ನಾನು ಒಬ್ಬ...',
        'quick_actions': 'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು',
        'popular_categories': 'ಜನಪ್ರಿಯ ವರ್ಗಗಳು',
        'ask_question_placeholder': 'ನಿಮ್ಮ ಕಾನೂನು ಪ್ರಶ್ನೆಯನ್ನು ಇಲ್ಲಿ ಕೇಳಿ...',
        'ask_ai': 'AI ಕೇಳಿ',
        'ai_response_title': 'AI ಪ್ರತಿಕ್ರಿಯೆ:',
        'tap_to_speak': 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
        'recording': 'ರೆಕಾರ್ಡಿಂಗ್...',
        'play_audio': 'ಆಡಿಯೋ ಪ್ಲೇ ಮಾಡಿ',
        'stop_audio': 'ಆಡಿಯೋ ನಿಲ್ಲಿಸಿ',
        'ai_legal_assistant': 'AI ಕಾನೂನು ಸಹಾಯಕ',
        'profile_selected_title': 'ಪ್ರೊಫೈಲ್ ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ',
        'action_find_legal_aid': 'ಕಾನೂನು ನೆರವು ಹುಡುಕಿ',
        'action_download_forms': 'ಫಾರ್ಮ್‌ಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
        'action_book_consultation': 'ಸಮಾಲೋಚನೆ ಬುಕ್ ಮಾಡಿ',
        'redirecting_legal_aid': 'ಕಾನೂನು ನೆರವು ಸಂಪನ್ಮೂಲಗಳಿಗೆ ಮರುನಿರ್ದೇಶಿಸಲಾಗುತ್ತಿದೆ...',
        'opening_forms_library': 'ಕಾನೂನು ನಮೂನೆಗಳ ಗ್ರಂಥಾಲಯವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ...',
        'opening_consultation_booking': 'ಸಮಾಲೋಚನೆ ಬುಕಿಂಗ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ...',
        'input_required_title': 'ಇನ್‌ಪುಟ್ ಅಗತ್ಯವಿದೆ',
        'input_required_message': 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ನಮೂದಿಸಿ ಅಥವಾ ಆಡಿಯೊ ರೆಕಾರ್ಡ್ ಮಾಡಿ.',
        'note_title': 'ಗಮನಿಸಿ',
        'error_title': 'ದೋಷ',
        'failed_ai_response': 'AI ನಿಂದ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಪಡೆಯಲು ವಿಫಲವಾಗಿದೆ.',
        'ai_processing_error': 'ಕ್ಷಮಿಸಿ, ಈ ಸಮಯದಲ್ಲಿ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ನನಗೆ ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',

        // Profile translations (Kannada)
        'profile_students_name': 'ವಿದ್ಯಾರ್ಥಿಗಳು',
        'profile_students_desc': 'ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಕಾನೂನು ಮಾರ್ಗದರ್ಶನ',
        'profile_professionals_name': 'ವೃತ್ತಿಪರರು',
        'profile_professionals_desc': 'ಕೆಲಸದ ಸ್ಥಳ ಮತ್ತು ವ್ಯಾಪಾರ ಕಾನೂನು',
        'profile_families_name': 'ಕುಟುಂಬಗಳು',
        'profile_families_desc': 'ಕುಟುಂಬ ಮತ್ತು ವೈಯಕ್ತಿಕ ಕಾನೂನು ವಿಷಯಗಳು',
        'profile_seniors_name': 'ಹಿರಿಯರು',
        'profile_seniors_desc': 'ವೃದ್ಧರಿಗಾಗಿ ಹಕ್ಕುಗಳು ಮತ್ತು ಪ್ರಯೋಜನಗಳು',
        'profile_entrepreneurs_name': 'ಉದ್ಯಮಿಗಳು',
        'profile_entrepreneurs_desc': 'ವ್ಯಾಪಾರ ಪ್ರಾರಂಭ ಕಾನೂನು ಮಾರ್ಗದರ್ಶನ',
        'profile_tenants_name': 'ಭೂಮಾಲೀಕರು',
        'profile_tenants_desc': 'ಬಾಡಿಗೆ ಮತ್ತು ವಸತಿ ಹಕ್ಕುಗಳು',

        // Category translations (Kannada)
        'category_consumer_rights': 'ಗ್ರಾಹಕ ಹಕ್ಕುಗಳು',
        'category_employment_law': 'ಉದ್ಯೋಗ ಕಾನೂನು',
        'category_property_rights': 'ಆಸ್ತಿ ಹಕ್ಕುಗಳು',
        'category_family_law': 'ಕುಟುಂಬ ಕಾನೂನು',
        'category_criminal_law': 'ಅಪರಾಧ ಕಾನೂನು',
        'category_civil_rights': 'ನಾಗರಿಕ ಹಕ್ಕುಗಳು',
      },
      'ml': {
        'welcome_subtitle': 'നിങ്ങളുടെ അവകാശങ്ങൾ അറിയുക, നിയമം മനസ്സിലാക്കുക',
        'config_warning': '⚠️ AI സേവനങ്ങൾ കോൺഫിഗർ ചെയ്തിട്ടില്ല. ചില സവിശേഷതകൾ പരിമിതപ്പെട്ടേക്കാം.',
        'i_am_a': 'ഞാനൊരു...',
        'quick_actions': 'വേഗത്തിലുള്ള പ്രവർത്തനങ്ങൾ',
        'popular_categories': 'ജനപ്രിയ വിഭാഗങ്ങൾ',
        'ask_question_placeholder': 'നിങ്ങളുടെ നിയമപരമായ ചോദ്യം ഇവിടെ ചോദിക്കുക...',
        'ask_ai': 'AI-യോട് ചോദിക്കുക',
        'ai_response_title': 'AI പ്രതികരണം:',
        'tap_to_speak': 'സംസാരിക്കാൻ ടാപ്പുചെയ്യുക',
        'recording': 'റെക്കോർഡിംഗ്...',
        'play_audio': 'ഓഡിയോ പ്ലേ ചെയ്യുക',
        'stop_audio': 'ഓഡിയോ നിർത്തുക',
        'ai_legal_assistant': 'AI നിയമ സഹായം',
        'profile_selected_title': 'പ്രൊഫൈൽ തിരഞ്ഞെടുത്തു',
        'action_find_legal_aid': 'നിയമ സഹായം കണ്ടെത്തുക',
        'action_download_forms': 'ഫോമുകൾ ഡൗൺലോഡ് ചെയ്യുക',
        'action_book_consultation': 'കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യുക',
        'redirecting_legal_aid': 'നിയമ സഹായ വിഭവങ്ങളിലേക്ക് റീഡയറക്‌ട് ചെയ്യുന്നു...',
        'opening_forms_library': 'നിയമപരമായ ഫോമുകളുടെ ലൈബ്രറി തുറക്കുന്നു...',
        'opening_consultation_booking': 'കൺസൾട്ടേഷൻ ബുക്കിംഗ് തുറക്കുന്നു...',
        'input_required_title': 'ഇൻപുട്ട് ആവശ്യമാണ്',
        'input_required_message': 'ദയവായി നിങ്ങളുടെ ചോദ്യം നൽകുക അല്ലെങ്കിൽ ഓഡിയോ റെക്കോർഡ് ചെയ്യുക.',
        'note_title': 'ശ്രദ്ധിക്കുക',
        'error_title': 'പിശക്',
        'failed_ai_response': 'AI-യിൽ നിന്ന് പ്രതികരണം ലഭിക്കുന്നതിൽ പരാജയപ്പെട്ടു.',
        'ai_processing_error': 'ക്ഷമിക്കണം, നിങ്ങളുടെ അഭ്യർത്ഥന ഇപ്പോൾ പ്രോസസ്സ് ചെയ്യാൻ എനിക്ക് കഴിയുന്നില്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക.',

        // Profile translations (Malayalam)
        'profile_students_name': 'വിദ്യാർത്ഥികൾ',
        'profile_students_desc': 'വിദ്യാർത്ഥികൾക്ക് നിയമപരമായ മാർഗ്ഗനിർദ്ദേശം',
        'profile_professionals_name': 'പ്രൊഫഷണലുകൾ',
        'profile_professionals_desc': 'തൊഴിൽ നിയമങ്ങളും ബിസിനസ് നിയമങ്ങളും',
        'profile_families_name': 'കുടുംബങ്ങൾ',
        'profile_families_desc': 'കുടുംബപരവും വ്യക്തിപരവുമായ നിയമകാര്യങ്ങൾ',
        'profile_seniors_name': 'മുതിർന്നവർ',
        'profile_seniors_desc': 'മുതിർന്നവർക്കുള്ള അവകാശങ്ങളും ആനുകൂല്യങ്ങളും',
        'profile_entrepreneurs_name': 'സംരംഭകർ',
        'profile_entrepreneurs_desc': 'ബിസിനസ്സ് തുടങ്ങുന്നതിനുള്ള നിയമപരമായ മാർഗ്ഗനിർദ്ദേശം',
        'profile_tenants_name': 'വാടകക്കാർ',
        'profile_tenants_desc': 'വാടകയും പാർപ്പിട അവകാശങ്ങളും',

        // Category translations (Malayalam)
        'category_consumer_rights': 'ഉപഭോക്തൃ അവകാശങ്ങൾ',
        'category_employment_law': 'തൊഴിൽ നിയമം',
        'category_property_rights': 'സ്വത്തവകാശങ്ങൾ',
        'category_family_law': 'കുടുംബ നിയമം',
        'category_criminal_law': 'ക്രിമിനൽ നിയമം',
        'category_civil_rights': 'പൗരാവകാശങ്ങൾ',
      },
      'mr': {
        'welcome_subtitle': 'आपले हक्क जाणून घ्या, कायदा समजून घ्या',
        'config_warning': '⚠️ AI सेवा कॉन्फिगर केलेल्या नाहीत. काही वैशिष्ट्ये मर्यादित असू शकतात.',
        'i_am_a': 'मी आहे एक...',
        'quick_actions': 'जलद कृती',
        'popular_categories': 'लोकप्रिय श्रेणी',
        'ask_question_placeholder': 'येथे तुमचा कायदेशीर प्रश्न विचारा...',
        'ask_ai': 'AI ला विचारा',
        'ai_response_title': 'AI प्रतिसाद:',
        'tap_to_speak': 'बोलण्यासाठी टॅप करा',
        'recording': 'रेकॉर्डिंग सुरू आहे...',
        'play_audio': 'ऑडिओ प्ले करा',
        'stop_audio': 'ऑडिओ थांबवा',
        'ai_legal_assistant': 'AI कायदेशीर सहायक',
        'profile_selected_title': 'प्रोफाईल निवडले',
        'action_find_legal_aid': 'कायदेशीर मदत शोधा',
        'action_download_forms': 'फॉर्म डाउनलोड करा',
        'action_book_consultation': 'सल्ला बुक करा',
        'redirecting_legal_aid': 'कायदेशीर मदत संसाधनांकडे पुनर्निर्देशित करत आहे...',
        'opening_forms_library': 'कायदेशीर फॉर्म्स लायब्ररी उघडत आहे...',
        'opening_consultation_booking': 'सल्ला बुकिंग उघडत आहे...',
        'input_required_title': 'इनपुट आवश्यक आहे',
        'input_required_message': 'कृपया तुमचा प्रश्न एंटर करा किंवा ऑडिओ रेकॉर्ड करा.',
        'note_title': 'टीप',
        'error_title': 'त्रुटी',
        'failed_ai_response': 'AI कडून प्रतिसाद मिळवण्यात अयशस्वी.',
        'ai_processing_error': 'क्षमस्व, मी सध्या तुमची विनंती प्रक्रिया करू शकत नाही. कृपया नंतर पुन्हा प्रयत्न करा।',

        // Profile translations (Marathi)
        'profile_students_name': 'विद्यार्थी',
        'profile_students_desc': 'विद्यार्थ्यांसाठी कायदेशीर मार्गदर्शन',
        'profile_professionals_name': 'व्यावसायिक',
        'profile_professionals_desc': 'कार्यस्थळ आणि व्यवसाय कायदा',
        'profile_families_name': 'कुटुंबे',
        'profile_families_desc': 'कौटुंबिक आणि वैयक्तिक कायदेशीर बाबी',
        'profile_seniors_name': 'ज्येष्ठ नागरिक',
        'profile_seniors_desc': 'ज्येष्ठांसाठी हक्क आणि फायदे',
        'profile_entrepreneurs_name': 'उद्योजक',
        'profile_entrepreneurs_desc': 'व्यवसाय सुरू करण्यासाठी कायदेशीर मार्गदर्शन',
        'profile_tenants_name': 'भाडेकरू',
        'profile_tenants_desc': 'भाडे आणि गृहनिर्माण हक्क',

        // Category translations (Marathi)
        'category_consumer_rights': 'ग्राहक हक्क',
        'category_employment_law': 'रोजगार कायदा',
        'category_property_rights': 'मालमत्ता हक्क',
        'category_family_law': 'कौटुंबिक कायदा',
        'category_criminal_law': 'गुन्हेगारी कायदा',
        'category_civil_rights': 'नागरिक हक्क',
      },
      'ta': {
        'welcome_subtitle': 'உங்கள் உரிமைகளை அறிந்து கொள்ளுங்கள், சட்டத்தைப் புரிந்து கொள்ளுங்கள்',
        'config_warning': '⚠️ AI சேவைகள் கட்டமைக்கப்படவில்லை. சில அம்சங்கள் குறைவாக இருக்கலாம்.',
        'i_am_a': 'நான் ஒரு...',
        'quick_actions': 'விரைவுச் செயல்கள்',
        'popular_categories': 'பிரபலமான வகைகள்',
        'ask_question_placeholder': 'உங்கள் சட்ட கேள்வியை இங்கே கேளுங்கள்...',
        'ask_ai': 'AI ஐக் கேளுங்கள்',
        'ai_response_title': 'AI பதில்:',
        'tap_to_speak': 'பேச தட்டவும்',
        'recording': 'பதிவு செய்கிறது...',
        'play_audio': 'ஆடியோவை இயக்கவும்',
        'stop_audio': 'ஆடியோவை நிறுத்தவும்',
        'ai_legal_assistant': 'AI சட்ட உதவியாளர்',
        'profile_selected_title': 'சுயவிவரம் தேர்ந்தெடுக்கப்பட்டது',
        'action_find_legal_aid': 'சட்ட உதவி தேடவும்',
        'action_download_forms': 'படிவங்களை பதிவிறக்கவும்',
        'action_book_consultation': 'ஆலோசனை பதிவு செய்யவும்',
        'redirecting_legal_aid': 'சட்ட உதவி ஆதாரங்களுக்குத் திருப்பி விடப்படுகிறது...',
        'opening_forms_library': 'சட்டப் படிவங்கள் நூலகத்தைத் திறக்கிறது...',
        'opening_consultation_booking': 'ஆலோசனை முன்பதிவைத் திறக்கிறது...',
        'input_required_title': 'உள்ளீடு தேவை',
        'input_required_message': 'தயவுசெய்து உங்கள் கேள்வியை உள்ளிடவும் அல்லது ஆடியோவை பதிவு செய்யவும்.',
        'note_title': 'குறிப்பு',
        'error_title': 'பிழை',
        'failed_ai_response': 'AI இலிருந்து பதிலைப் பெறத் தவறிவிட்டது.',
        'ai_processing_error': 'மன்னிக்கவும், உங்கள் கோரிக்கையை இப்போதைக்கு செயலாக்க முடியவில்லை. தயவுசெய்து பின்னர் மீண்டும் முயற்சிக்கவும்.',

        // Profile translations (Tamil)
        'profile_students_name': 'மாணவர்கள்',
        'profile_students_desc': 'மாணவர்களுக்கான சட்ட வழிகாட்டுதல்',
        'profile_professionals_name': 'தொழில் வல்லுநர்கள்',
        'profile_professionals_desc': 'பணிச்சூழல் மற்றும் வணிகச் சட்டம்',
        'profile_families_name': 'குடும்பங்கள்',
        'profile_families_desc': 'குடும்ப மற்றும் தனிப்பட்ட சட்ட விஷயங்கள்',
        'profile_seniors_name': 'மூத்த குடிமக்கள்',
        'profile_seniors_desc': 'முதியோருக்கான உரிமைகள் மற்றும் சலுகைகள்',
        'profile_entrepreneurs_name': 'தொழில்முனைவோர்',
        'profile_entrepreneurs_desc': 'வணிகத் தொடக்க சட்ட வழிகாட்டுதல்',
        'profile_tenants_name': 'குத்தகைதாரர்கள்',
        'profile_tenants_desc': 'வாடகை மற்றும் வீட்டுவசதி உரிமைகள்',

        // Category translations (Tamil)
        'category_consumer_rights': 'நுகர்வோர் உரிமைகள்',
        'category_employment_law': 'வேலைவாய்ப்பு சட்டம்',
        'category_property_rights': 'சொத்து உரிமைகள்',
        'category_family_law': 'குடும்பச் சட்டம்',
        'category_criminal_law': 'குற்றவியல் சட்டம்',
        'category_civil_rights': 'சிவில் உரிமைகள்',
      },
      'te': {
        'welcome_subtitle': 'మీ హక్కులను తెలుసుకోండి, చట్టాన్ని అర్థం చేసుకోండి',
        'config_warning': '⚠️ AI సేవలు కాన్ఫిగర్ చేయబడలేదు. కొన్ని ఫీచర్‌లు పరిమితం కావచ్చు.',
        'i_am_a': 'నేను ఒక...',
        'quick_actions': 'శీఘ్ర చర్యలు',
        'popular_categories': 'ప్రసిద్ధ వర్గాలు',
        'ask_question_placeholder': 'మీ న్యాయ ప్రశ్న ఇక్కడ అడగండి...',
        'ask_ai': 'AI అడగండి',
        'ai_response_title': 'AI ప్రతిస్పందన:',
        'tap_to_speak': 'మాట్లాడటానికి నొక్కండి',
        'recording': 'రికార్డింగ్...',
        'play_audio': 'ఆడియో ప్లే చేయండి',
        'stop_audio': 'ఆడియో ఆపండి',
        'ai_legal_assistant': 'AI న్యాయ సహాయకుడు',
        'profile_selected_title': 'ప్రొఫైల్ ఎంపిక చేయబడింది',
        'action_find_legal_aid': 'న్యాయ సహాయం కనుగొనండి',
        'action_download_forms': 'ఫారమ్‌లను డౌన్‌లోడ్ చేయండి',
        'action_book_consultation': 'సలహా బుక్ చేయండి',
        'redirecting_legal_aid': 'న్యాయ సహాయ వనరులకు మళ్ళిస్తుంది...',
        'opening_forms_library': 'న్యాయపరమైన ఫారమ్‌ల లైబ్రరీని తెరుస్తుంది...',
        'opening_consultation_booking': 'సలహా బుకింగ్ తెరుస్తుంది...',
        'input_required_title': 'ఇన్‌పుట్ అవసరం',
        'input_required_message': 'దయచేసి మీ ప్రశ్నను నమోదు చేయండి లేదా ఆడియోను రికార్డ్ చేయండి.',
        'note_title': 'గమనిక',
        'error_title': 'లోపం',
        'failed_ai_response': 'AI నుండి ప్రతిస్పందనను పొందడంలో విఫలమైంది.',
        'ai_processing_error': 'క్షమించండి, మీ అభ్యర్థనను ప్రస్తుతం ప్రాసెస్ చేయలేకపోతున్నాను. దయచేసి తర్వాత మళ్ళీ ప్రయత్నించండి.',

        // Profile translations (Telugu)
        'profile_students_name': 'విద్యార్థులు',
        'profile_students_desc': 'విద్యార్థులకు న్యాయ మార్గదర్శకం',
        'profile_professionals_name': 'నిపుణులు',
        'profile_professionals_desc': 'కార్యాలయం మరియు వ్యాపార చట్టం',
        'profile_families_name': 'కుటుంబాలు',
        'profile_families_desc': 'కుటుంబ మరియు వ్యక్తిగత న్యాయ విషయాలు',
        'profile_seniors_name': 'సీనియర్లు',
        'profile_seniors_desc': 'వృద్ధుల కోసం హక్కులు మరియు ప్రయోజనాలు',
        'profile_entrepreneurs_name': 'పారిశ్రామికవేత్తలు',
        'profile_entrepreneurs_desc': 'వ్యాపార ప్రారంభ న్యాయ మార్గదర్శకం',
        'profile_tenants_name': 'అద్దెదారులు',
        'profile_tenants_desc': 'అద్దె మరియు గృహ హక్కులు',

        // Category translations (Telugu)
        'category_consumer_rights': 'వినియోగదారుల హక్కులు',
        'category_employment_law': 'ఉద్యోగ చట్టం',
        'category_property_rights': 'ఆస్తి హక్కులు',
        'category_family_law': 'కుటుంబ చట్టం',
        'category_criminal_law': 'క్రిమినల్ చట్టం',
        'category_civil_rights': 'పౌర హక్కులు',
      },
      'ur': {
        'welcome_subtitle': 'اپنے حقوق جانیں، قانون کو سمجھیں',
        'config_warning': '⚠️ AI سروسز کنفیگر نہیں ہیں۔ کچھ خصوصیات محدود ہو سکتی ہیں۔',
        'i_am_a': 'میں ہوں ایک...',
        'quick_actions': 'فوری اقدامات',
        'popular_categories': 'مقبول زمرے',
        'ask_question_placeholder': 'یہاں اپنا قانونی سوال پوچھیں...',
        'ask_ai': 'اے آئی سے پوچھیں',
        'ai_response_title': 'اے آئی کا جواب:',
        'tap_to_speak': 'بولنے کے لیے تھپتھپائیں',
        'recording': 'ریکارڈنگ ہو رہی ہے...',
        'play_audio': 'آڈیو چلائیں',
        'stop_audio': 'آڈیو روکیں',
        'ai_legal_assistant': 'اے آئی قانونی معاون',
        'profile_selected_title': 'پروفائل منتخب',
        'action_find_legal_aid': 'قانونی امداد تلاش کریں',
        'action_download_forms': 'فارمز ڈاؤن لوڈ کریں',
        'action_book_consultation': 'مشاورت بک کریں',
        'redirecting_legal_aid': 'قانونی امداد کے وسائل کی طرف منتقل کیا جا رہا ہے...',
        'opening_forms_library': 'قانونی فارمز لائبریری کھول رہا ہے...',
        'opening_consultation_booking': 'مشاورت کی بکنگ کھول رہا ہے...',
        'input_required_title': 'ان پٹ درکار ہے',
        'input_required_message': 'براہ کرم اپنا سوال درج کریں یا آڈیو ریکارڈ کریں۔',
        'note_title': 'نوٹ',
        'error_title': 'خرابی',
        'failed_ai_response': 'اے آئی سے جواب حاصل کرنے میں ناکامی۔',
        'ai_processing_error': 'معذرت، میں فی الحال آپ کی درخواست پر کارروائی نہیں کر سکتا۔ براہ کرم بعد میں دوبارہ کوشش کریں۔',

        // Profile translations (Urdu)
        'profile_students_name': 'طلباء',
        'profile_students_desc': 'طلباء کے لیے قانونی رہنمائی',
        'profile_professionals_name': 'پیشہ ور',
        'profile_professionals_desc': 'کام کی جگہ اور کاروباری قانون',
        'profile_families_name': 'خاندان',
        'profile_families_desc': 'خاندانی اور ذاتی قانونی معاملات',
        'profile_seniors_name': 'بزرگ',
        'profile_seniors_desc': 'بزرگوں کے لیے حقوق اور فوائد',
        'profile_entrepreneurs_name': 'کاروباری',
        'profile_entrepreneurs_desc': 'کاروبار شروع کرنے کے لیے قانونی رہنمائی',
        'profile_tenants_name': 'کرایہ دار',
        'profile_tenants_desc': 'کرایہ اور ہاؤسنگ کے حقوق',

        // Category translations (Urdu)
        'category_consumer_rights': 'صارفین کے حقوق',
        'category_employment_law': 'ملازمت کا قانون',
        'category_property_rights': 'جائیداد کے حقوق',
        'category_family_law': 'خاندانی قانون',
        'category_criminal_law': 'فوجداری قانون',
        'category_civil_rights': 'شہری حقوق',
      },
    };
    return (translations[selectedLanguage.code] && translations[selectedLanguage.code][key]) || translations['en'][key];
  };


  return (
    <Layout
      selectedLanguage={selectedLanguage}
      onLanguageChange={handleLanguageChange}
      activeTab="Home"
      navigation={navigation}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>{getGreeting()}</Text>
          <Text style={styles.welcomeSubtitle}>
            {getTranslatedText('welcome_subtitle')}
          </Text>
          {/* Display warning if AI services are not configured */}
          {!apiConfigured && (
            <View style={styles.configWarning}>
              <Text style={styles.configWarningText}>
                {getTranslatedText('config_warning')}
              </Text>
            </View>
          )}
        </View>

        {/* User Profiles Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{getTranslatedText('i_am_a')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profilesContainer}>
            {USER_PROFILES_KEYS.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileCard,
                  { borderColor: profile.color },
                  selectedProfile?.id === profile.id && { backgroundColor: profile.color + '20' }
                ]}
                onPress={() => handleProfileSelect(profile)}
              >
                <Text style={styles.profileIcon}>{profile.icon}</Text>
                <Text style={styles.profileName}>{getTranslatedText(profile.nameKey)}</Text>
                <Text style={styles.profileDescription}>{getTranslatedText(profile.descriptionKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{getTranslatedText('quick_actions')}</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS_KEYS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionCard}
                onPress={() => handleQuickAction(action.action)}
              >
                <Text style={styles.quickActionIcon}>{action.icon}</Text>
                <Text style={styles.quickActionTitle}>
                  {getTranslatedText(action.titleKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Legal Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{getTranslatedText('popular_categories')}</Text>
          <View style={styles.categoriesGrid}>
            {LEGAL_CATEGORIES_KEYS.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryCard, { borderLeftColor: category.color }]}
                onPress={() => Alert.alert('Category', `Opening ${getTranslatedText(category.titleKey)}...`)} // Translate alert message too
              >
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{category.queries}</Text>
                  </View>
                </View>
                <Text style={styles.categoryTitle}>{getTranslatedText(category.titleKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Assistant Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={askAIModalVisible}
          onRequestClose={clearAIModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.aiModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🤖 {getTranslatedText('ai_legal_assistant')}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={clearAIModal}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <TextInput
                  style={styles.queryInput}
                  placeholder={getTranslatedText('ask_question_placeholder')}
                  multiline
                  numberOfLines={4}
                  value={userQuery}
                  onChangeText={setUserQuery}
                  editable={!recording} // Disable text input while recording
                />
                
                {/* Microphone button */}
                <TouchableOpacity
                  style={[
                    styles.microphoneButton,
                    recording ? styles.microphoneButtonRecording : null
                  ]}
                  onPress={handleRecordButtonPress}
                  disabled={isLoading} // Disable microphone while loading AI response
                >
                  <Text style={styles.microphoneIcon}>
                    {recording ? '🔴' : '🎤'}
                  </Text>
                  <Text style={styles.microphoneText}>
                    {recording ? getTranslatedText('recording') : getTranslatedText('tap_to_speak')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.askButton, isLoading && styles.askButtonDisabled]}
                  onPress={handleAskAI}
                  disabled={isLoading || (userQuery.trim() === '' && !recordedUri)} // Disable if no input or recording
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.askButtonText}>
                      {getTranslatedText('ask_ai')}
                    </Text>
                  )}
                </TouchableOpacity>

                {aiResponse ? (
                  <View style={styles.responseContainer}>
                    <Text style={styles.responseTitle}>
                      {getTranslatedText('ai_response_title')}
                    </Text>
                    <Text style={styles.responseText}>{aiResponse}</Text>
                    {/* Play Audio Button */}
                    <TouchableOpacity
                      style={[styles.playAudioButton, isPlayingAudio && styles.playAudioButtonPlaying]}
                      onPress={playAIResponseAudio}
                      disabled={isLoading || isPlayingAudio}
                    >
                      <Text style={styles.playAudioButtonText}>
                        {isPlayingAudio ? getTranslatedText('stop_audio') : getTranslatedText('play_audio')} 🔊
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Welcome Section
  welcomeSection: {
    padding: 20,
    backgroundColor: '#1E293B',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
  },
  configWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  configWarningText: {
    color: '#FCD34D',
    fontSize: 14,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },

  // User Profiles
  profilesContainer: {
    flexDirection: 'row',
  },
  profileCard: {
    width: 140,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },

  // Categories
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  aiModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  queryInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  microphoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60A5FA', // Blue for microphone
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  microphoneButtonRecording: {
    backgroundColor: '#EF4444', // Red when recording
  },
  microphoneIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  microphoneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  askButton: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  askButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  askButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  responseText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 10, // Added margin for button
  },
  playAudioButton: {
    backgroundColor: '#10B981', // Greenish color
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start', // Align to left
    marginTop: 10,
    flexDirection: 'row', // For icon and text
    alignItems: 'center',
  },
  playAudioButtonPlaying: {
    backgroundColor: '#F59E0B', // Orange when playing
  },
  playAudioButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },
});

export default HomeScreen;
