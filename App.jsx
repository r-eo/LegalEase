import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './components/homescreen';
// Import other screens as needed
// import LearnScreen from './components/learnscreen';
// import QuizScreen from './components/quizscreen';
// import ProfileScreen from './components/profilescreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <View style={styles.container}>
        <StatusBar style="auto" />
        {/* For now, just show HomeScreen directly */}
        <HomeScreen />
        
        {/* Uncomment below when you have navigation set up */}
        { /*
        <Tab.Navigator>
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Learn" component={LearnScreen} />
          <Tab.Screen name="Quiz" component={QuizScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
        */}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});