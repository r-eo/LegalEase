// API Configuration
const API_CONFIG = {
  AZURE_OPENAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'YOUR_AZURE_OPENAI_ENDPOINT',
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'YOUR_AZURE_OPENAI_API_KEY',
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME || 'YOUR_DEPLOYMENT_NAME',
    apiVersion: '2024-02-15-preview'
  },
  BHASHINI: {
    endpoint: 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline',
    userId: process.env.BHASHINI_USER_ID || 'YOUR_BHASHINI_USER_ID',
    ulcaApiKey: process.env.BHASHINI_API_KEY || 'YOUR_BHASHINI_API_KEY'
  }
};

// Utility functions for API configuration
export const setApiConfig = (service, config) => {
  if (service === 'AZURE_OPENAI') {
    API_CONFIG.AZURE_OPENAI = { ...API_CONFIG.AZURE_OPENAI, ...config };
  } else if (service === 'BHASHINI') {
    API_CONFIG.BHASHINI = { ...API_CONFIG.BHASHINI, ...config };
  }
};

export const getApiConfig = (service) => {
  return API_CONFIG[service] || null;
};

// Check if APIs are properly configured
export const isApiConfigured = () => {
  const azureConfigured = API_CONFIG.AZURE_OPENAI.endpoint !== 'YOUR_AZURE_OPENAI_ENDPOINT' &&
                         API_CONFIG.AZURE_OPENAI.apiKey !== 'YOUR_AZURE_OPENAI_API_KEY';
  
  const bhashiniConfigured = API_CONFIG.BHASHINI.userId !== 'YOUR_BHASHINI_USER_ID' &&
                            API_CONFIG.BHASHINI.ulcaApiKey !== 'YOUR_BHASHINI_API_KEY';
  
  return {
    azureOpenAI: azureConfigured,
    bhashini: bhashiniConfigured,
    hasAnyConfig: azureConfigured || bhashiniConfigured
  };
};

// AI Service Integration Class
class AIService {
  // Azure OpenAI Integration
  static async queryAzureOpenAI(prompt, language = 'en', options = {}) {
    const {
      maxTokens = 500,
      temperature = 0.7,
      systemMessage = null
    } = options;

    // Check if Azure OpenAI is configured
    const configStatus = isApiConfigured();
    if (!configStatus.azureOpenAI) {
      return {
        success: false,
        error: 'Azure OpenAI is not configured. Please set up your API credentials.',
        data: null
      };
    }

    try {
      const languageInstructions = {
        'en': 'English',
        'hi': 'Hindi (हिन्दी)',
        'bn': 'Bengali (বাংলা)',
        'gu': 'Gujarati (ગુજરાતી)',
        'kn': 'Kannada (ಕನ್ನಡ)',
        'ml': 'Malayalam (മലയാളം)',
        'mr': 'Marathi (मराठी)',
        'ta': 'Tamil (தமிழ்)',
        'te': 'Telugu (తెలుగు)',
        'ur': 'Urdu (اردو)'
      };

      const defaultSystemMessage = `You are a legal literacy assistant helping people understand their legal rights and procedures in India. 

Guidelines:
- Provide clear, simple explanations suitable for common people
- Focus on practical legal advice and procedures
- Respond in ${languageInstructions[language] || 'English'}
- Keep answers concise but comprehensive
- Include relevant Indian laws and procedures when applicable
- If unsure about specific legal details, recommend consulting a lawyer
- Use examples to make concepts clearer`;
      
      const response = await fetch(
        `${API_CONFIG.AZURE_OPENAI.endpoint}/openai/deployments/${API_CONFIG.AZURE_OPENAI.deploymentName}/chat/completions?api-version=${API_CONFIG.AZURE_OPENAI.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': API_CONFIG.AZURE_OPENAI.apiKey
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: systemMessage || defaultSystemMessage
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: maxTokens,
            temperature: temperature
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.choices[0]?.message?.content || 'Sorry, I could not process your request.',
        usage: data.usage || null
      };
    } catch (error) {
      console.error('Azure OpenAI Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get AI response',
        data: null
      };
    }
  }

  // Bhashini Translation Integration
  static async translateText(text, sourceLang, targetLang) {
    // Check if Bhashini is configured
    const configStatus = isApiConfigured();
    if (!configStatus.bhashini) {
      return {
        success: false,
        error: 'Bhashini translation service is not configured.',
        data: null
      };
    }

    // Skip translation if source and target are the same
    if (sourceLang === targetLang) {
      return {
        success: true,
        data: text,
        sourceText: text,
        sourceLang: sourceLang,
        targetLang: targetLang,
        skipped: true
      };
    }

    try {
      // Step 1: Get the pipeline for translation
      const pipelineResponse = await fetch(API_CONFIG.BHASHINI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'userID': API_CONFIG.BHASHINI.userId,
          'ulcaApiKey': API_CONFIG.BHASHINI.ulcaApiKey
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: 'translation',
              config: {
                language: {
                  sourceLanguage: sourceLang,
                  targetLanguage: targetLang
                }
              }
            }
          ]
        })
      });

      if (!pipelineResponse.ok) {
        throw new Error(`Bhashini Pipeline API error: ${pipelineResponse.status}`);
      }

      const pipelineData = await pipelineResponse.json();
      
      // Validate pipeline response
      if (!pipelineData.pipelineResponseConfig || 
          !pipelineData.pipelineResponseConfig[0] || 
          !pipelineData.pipelineResponseConfig[0].config || 
          !pipelineData.pipelineResponseConfig[0].config[0]) {
        throw new Error('Invalid pipeline response structure');
      }

      const translationServiceId = pipelineData.pipelineResponseConfig[0].config[0].serviceId;
      const translationEndpoint = pipelineData.pipelineResponseConfig[0].config[0].modelId;

      // Step 2: Translate the text
      const translationResponse = await fetch(translationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': API_CONFIG.BHASHINI.ulcaApiKey
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: 'translation',
              config: {
                language: {
                  sourceLanguage: sourceLang,
                  targetLanguage: targetLang
                },
                serviceId: translationServiceId
              }
            }
          ],
          inputData: {
            input: [
              {
                source: text
              }
            ]
          }
        })
      });

      if (!translationResponse.ok) {
        throw new Error(`Bhashini Translation API error: ${translationResponse.status}`);
      }

      const translationData = await translationResponse.json();
      
      // Validate translation response
      if (!translationData.pipelineResponse || 
          !translationData.pipelineResponse[0] || 
          !translationData.pipelineResponse[0].output || 
          !translationData.pipelineResponse[0].output[0]) {
        throw new Error('Invalid translation response structure');
      }

      return {
        success: true,
        data: translationData.pipelineResponse[0].output[0].target,
        sourceText: text,
        sourceLang: sourceLang,
        targetLang: targetLang
      };
    } catch (error) {
      console.error('Bhashini Translation Error:', error);
      return {
        success: false,
        error: error.message || 'Translation failed',
        data: null
      };
    }
  }

  // Enhanced function to handle AI query with translation
  static async queryAIWithTranslation(prompt, targetLanguage = 'en') {
    try {
      const configStatus = isApiConfigured();
      
      // If no APIs are configured, return a helpful message
      if (!configStatus.hasAnyConfig) {
        return {
          success: true,
          data: "Thank you for your question! To get AI-powered responses, please configure your Azure OpenAI and Bhashini API credentials. For now, I recommend consulting with a legal professional for specific legal advice.",
          warning: "API services not configured"
        };
      }

      // First get the AI response in English
      const aiResponse = await this.queryAzureOpenAI(prompt, 'en');
      
      if (!aiResponse.success) {
        // If AI fails, provide a fallback response
        return {
          success: true,
          data: "I apologize, but I'm unable to process your query at the moment. For legal advice, please consult with a qualified legal professional or visit your nearest legal aid center.",
          warning: aiResponse.error
        };
      }

      // If target language is English or translation is not configured, return as is
      if (targetLanguage === 'en' || !configStatus.bhashini) {
        if (!configStatus.bhashini && targetLanguage !== 'en') {
          aiResponse.warning = 'Translation service not configured, returning response in English';
        }
        return aiResponse;
      }

      // Translate the response to target language
      const translationResponse = await this.translateText(
        aiResponse.data, 
        'en', 
        targetLanguage
      );

      if (!translationResponse.success) {
        // If translation fails, return original English response with warning
        return {
          success: true,
          data: aiResponse.data,
          warning: 'Translation failed, returning response in English',
          translationError: translationResponse.error
        };
      }

      return {
        success: true,
        data: translationResponse.data,
        originalText: aiResponse.data,
        translated: true,
        usage: aiResponse.usage
      };
    } catch (error) {
      console.error('AI Query with Translation Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process AI query with translation',
        data: null
      };
    }
  }

  // Batch translation function
  static async batchTranslate(texts, sourceLang, targetLang) {
    const results = [];
    
    for (const text of texts) {
      const result = await this.translateText(text, sourceLang, targetLang);
      results.push(result);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  // Language detection (basic implementation)
  static detectLanguage(text) {
    // Simple language detection based on character patterns
    const patterns = {
      hi: /[\u0900-\u097F]/,
      bn: /[\u0980-\u09FF]/,
      gu: /[\u0A80-\u0AFF]/,
      kn: /[\u0C80-\u0CFF]/,
      ml: /[\u0D00-\u0D7F]/,
      mr: /[\u0900-\u097F]/,
      ta: /[\u0B80-\u0BFF]/,
      te: /[\u0C00-\u0C7F]/,
      ur: /[\u0600-\u06FF]/,
      ar: /[\u0600-\u06FF]/,
      zh: /[\u4e00-\u9fff]/
    };
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    
    return 'en'; // Default to English
  }

  // Health check for APIs
  static async checkAPIHealth() {
    const results = {
      azureOpenAI: false,
      bhashini: false,
      timestamp: new Date().toISOString(),
      configured: isApiConfigured()
    };

    try {
      // Test Azure OpenAI only if configured
      if (results.configured.azureOpenAI) {
        const azureTest = await this.queryAzureOpenAI('Test', 'en', { maxTokens: 10 });
        results.azureOpenAI = azureTest.success;
      }
    } catch (error) {
      console.error('Azure OpenAI health check failed:', error);
    }

    try {
      // Test Bhashini only if configured
      if (results.configured.bhashini) {
        const bhashiniTest = await this.translateText('Hello', 'en', 'hi');
        results.bhashini = bhashiniTest.success;
      }
    } catch (error) {
      console.error('Bhashini health check failed:', error);
    }

    return results;
  }

  // Get sample legal queries for testing
  static getSampleQueries(language = 'en') {
    const samples = {
      en: [
        "What are my rights as a tenant?",
        "How do I file a complaint against workplace harassment?",
        "What documents do I need for property registration?",
        "How can I get free legal aid?",
        "What are consumer protection rights?"
      ],
      hi: [
        "किरायेदार के रूप में मेरे क्या अधिकार हैं?",
        "कार्यक्षेत्र में उत्पीड़न के खिलाफ शिकायत कैसे दर्ज करूं?",
        "संपत्ति पंजीकरण के लिए मुझे कौन से दस्तावेज चाहिए?",
        "मुझे मुफ्त कानूनी सहायता कैसे मिल सकती है?",
        "उपभोक्ता संरक्षण अधिकार क्या हैं?"
      ]
    };

    return samples[language] || samples.en;
  }
}

// Language mapping for Bhashini
export const BHASHINI_LANGUAGE_CODES = {
  'en': 'en',
  'hi': 'hi',
  'bn': 'bn',
  'gu': 'gu',
  'kn': 'kn',
  'ml': 'ml',
  'mr': 'mr',
  'or': 'or',
  'pa': 'pa',
  'ta': 'ta',
  'te': 'te',
  'ur': 'ur'
};

// Supported languages (consistent with Layout component)
export const SUPPORTED_LANGUAGES = [
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

// Export the AIService class and utilities
export default AIService;
