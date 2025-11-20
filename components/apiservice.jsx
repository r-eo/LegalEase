// apiservice.jsx

// !!! IMPORTANT: For testing ONLY. DO NOT deploy production apps with hardcoded API keys. !!!
// You MUST replace these placeholders with your ACTUAL Azure OpenAI credentials.
// These should be the same as the ones you verified in your check_azure.py.
const LOCAL_AZURE_OPENAI_CONFIG = {
  endpoint: 'https://ashab-mbln8fxv-eastus2.cognitiveservices.azure.com/', // Example: 'https://your-resource-name>.openai.azure.com/'
  apiKey: '9yEnBebehsEHT2Ockg6sTGAJ33VHDGDPHTwPW0C1uAHwQsIU1gHmJQQJ99BFACHYHv6XJ3w3AAAAACOGWNHb',          // Example: 'abcdef1234567890abcdef1234567890'
  deploymentName: 'legal-ease_gpt-35'                      // Example: 'legal-ease_gpt-35' (your deployed chat model name)
};
// !!! END IMPORTANT !!!


// API Configuration for Azure OpenAI and Bhashini
// This setup prioritizes:
// 1. process.env (for proper Expo env variable setup, e.g., EXPO_PUBLIC_*)
// 2. LOCAL_AZURE_OPENAI_CONFIG/LOCAL_BHASHINI_ULCA_API_KEY (for quick local testing when process.env isn't configured)
// 3. Original 'YOUR_...' placeholders (as a last resort, but will fail checks)
const API_CONFIG = {
  AZURE_OPENAI: {
    endpoint: process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT || LOCAL_AZURE_OPENAI_CONFIG.endpoint || 'YOUR_AZURE_OPENAI_ENDPOINT',
    apiKey: process.env.EXPO_PUBLIC_AZURE_OPENAI_API_KEY || LOCAL_AZURE_OPENAI_CONFIG.apiKey || 'YOUR_AZURE_OPENAI_API_KEY',
    deploymentName: process.env.EXPO_PUBLIC_AZURE_DEPLOYMENT_NAME || LOCAL_AZURE_OPENAI_CONFIG.deploymentName || 'YOUR_DEPLOYMENT_NAME',
    apiVersion: '2024-02-15-preview' // This version is consistent with your backend
  },
  BHASHINI: {
    // Endpoint for fetching pipeline configurations (this is the one that was previously problematic)
    configEndpoint: 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline',
    // Common inference endpoint for Bhashini services (used for direct compute calls if config fails)
    inferenceEndpoint: 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline', 
    userId: process.env.EXPO_PUBLIC_BHASHINI_USER_ID || 'de6e93dab3b0411fb070df8a81dc1482', // Your Bhashini User ID
    ulcaApiKey: process.env.EXPO_PUBLIC_BHASHINI_API_KEY || 'DaLc3gNbxwzB7zSeBUeRtCILs25oJLiDLGiaosqujuhZXw2Vc7tYjYwPn9o1tTh7', // Your Bhashini ULCA API Key
    // Pipeline ID for the config call
    pipelineId: "64392f96daac500b55c543cd", // MeitY Pipeline ID
    // Hardcoded service IDs as a fallback if dynamic config retrieval fails.
    // These are common example IDs. They may need adjustment based on specific models.
    FALLBACK_SERVICE_IDS: {
        "translation": "ai4bharat/indictrans-v2-all-gpu--t4", 
        "asr": "ai4bharat/conformer-en-gpu--t4",               
        "tts": "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4"  
    }
  }
};

// Define the Flask API base URL
const FLASK_API_BASE = "http://127.0.0.1:5000";

// Global store for dynamically fetched pipeline configurations
// This will hold: {"translation": {...}, "asr": {...}, "tts": {...}, "inferenceEndpoint": "...", "computeAuthKey": "...", "computeAuthValue": "..."}
let globalPipelineConfigs = {}; // Use `let` to allow reassignment

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

// Check if critical APIs (Azure OpenAI via Flask backend and Bhashini) are properly configured
export const isApiConfigured = () => {
  const flaskBackendUrlIsSet = FLASK_API_BASE !== "";

  const azureOpenAICredentialsProvided =
    !!API_CONFIG.AZURE_OPENAI.endpoint &&
    !!API_CONFIG.AZURE_OPENAI.apiKey &&
    !!API_CONFIG.AZURE_OPENAI.deploymentName &&
    API_CONFIG.AZURE_OPENAI.endpoint !== 'YOUR_ACTUAL_AZURE_OPENAI_ENDPOINT' && 
    API_CONFIG.AZURE_OPENAI.apiKey !== 'YOUR_ACTUAL_AZURE_OPENAI_API_KEY' &&
    API_CONFIG.AZURE_OPENAI.deploymentName !== 'YOUR_ACTUAL_AZURE_DEPLOYMENT_NAME';

  const bhashiniCredentialsProvided =
    !!API_CONFIG.BHASHINI.userId &&
    !!API_CONFIG.BHASHINI.ulcaApiKey &&
    API_CONFIG.BHASHINI.ulcaApiKey !== 'YOUR_FULL_UNMASKED_BHASHINI_API_KEY_HERE_STARTING_WITH_DaLc3';
  
  return {
    flaskBackend: flaskBackendUrlIsSet && azureOpenAICredentialsProvided, // Flask requires Azure config
    azureOpenAI: azureOpenAICredentialsProvided, // For direct Azure fallback
    bhashini: bhashiniCredentialsProvided, // For Bhashini services
    hasAnyConfig: (flaskBackendUrlIsSet && azureOpenAICredentialsProvided) || bhashiniCredentialsProvided // Overall check
  };
};

class AIService {

  // --- Utility for Bhashini Config Call ---
  static async _fetchBhashiniPipelineConfigs() {
      console.log("\nDEBUG: Attempting to fetch Bhashini pipeline configurations dynamically...");
      const headers = {
          'Content-Type': 'application/json',
          'userID': API_CONFIG.BHASHINI.userId,
          'ulcaApiKey': API_CONFIG.BHASHINI.ulcaApiKey,
          // Postman-observed headers from the successful config call are not always explicitly listed in cURL,
          // relying on fetch to add standard ones. If still 500s, specific User-Agent etc. might be needed.
      };
      
      const payload = {
          "pipelineTasks": [
              { "taskType": "asr", "config": { "language": { "sourceLanguage": "en" } } },
              { "taskType": "translation", "config": { "language": { "sourceLanguage": "en", "targetLanguage": "hi" } } },
              { "taskType": "tts", "config": { "language": { "sourceLanguage": "en" } } }
          ],
          "controlConfig": { "dataTracking": true },
          "pipelineRequestConfig": { "pipelineId": API_CONFIG.BHASHINI.pipelineId }
      };

      try {
          const response = await fetch(API_CONFIG.BHASHINI.configEndpoint, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(payload),
              timeout: 20000 // 20 seconds timeout
          });

          if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Bhashini Config API error: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const data = await response.json();
          let newConfigs = {};

          if (data.pipelineInferenceAPIEndPoint) {
              const inferenceEndpointInfo = data.pipelineInferenceAPIEndPoint;
              newConfigs.inferenceEndpoint = inferenceEndpointInfo.callbackUrl;
              if (inferenceEndpointInfo.inferenceApiKey) {
                  newConfigs.computeAuthKey = inferenceEndpointInfo.inferenceApiKey.name;
                  newConfigs.computeAuthValue = inferenceEndpointInfo.inferenceApiKey.value;
              }
          }

          if (data.pipelineResponseConfig && data.pipelineResponseConfig.length > 0) {
              data.pipelineResponseConfig.forEach(taskConfigEntry => {
                  const taskType = taskConfigEntry.taskType;
                  if (taskType && taskConfigEntry.config && taskConfigEntry.config.length > 0) {
                      newConfigs[taskType] = {
                          serviceId: taskConfigEntry.config[0].serviceId,
                          modelId: taskConfigEntry.config[0].modelId,
                          language_info: taskConfigEntry.config[0].language
                      };
                  }
              });
          }
          
          // Validate that we got all expected configurations
          if (newConfigs.inferenceEndpoint && newConfigs.computeAuthKey && newConfigs.computeAuthValue &&
              newConfigs.asr && newConfigs.translation && newConfigs.tts) {
              globalPipelineConfigs = newConfigs; // Store the fetched configs globally
              console.log("DEBUG: Successfully fetched and stored Bhashini pipeline configurations.");
              return true;
          } else {
              console.warn("WARNING: Bhashini config response was incomplete, some services may not be available dynamically.");
              console.log("DEBUG: Incomplete config response:", JSON.stringify(data, null, 2));
              return false;
          }

      } catch (error) {
          console.error(`ERROR: Failed to fetch Bhashini pipeline config: ${error.message}`);
          return false;
      }
  }

  // --- Get Task Specific Bhashini Info (Dynamic or Fallback) ---
  static async _getBhashiniTaskInfo(taskType, sourceLang, targetLang = null) {
      // Attempt to fetch configs if not already available or incomplete
      if (Object.keys(globalPipelineConfigs).length === 0 || !globalPipelineConfigs[taskType]) {
          console.log(`DEBUG: Bhashini configs for ${taskType} are missing, attempting dynamic fetch.`);
          const configFetched = await AIService._fetchBhashiniPipelineConfigs();
          if (!configFetched || !globalPipelineConfigs[taskType]) {
              console.warn(`WARNING: Dynamic Bhashini config for ${taskType} failed or incomplete, using hardcoded fallback.`);
              return {
                  serviceId: API_CONFIG.BHASHINI.FALLBACK_SERVICE_IDS[taskType],
                  endpoint: API_CONFIG.BHASHINI.inferenceEndpoint,
                  authKey: 'Authorization', // Default to Authorization for direct calls
                  authToken: API_CONFIG.BHASHINI.ulcaApiKey // Use main API key as auth token
              };
          }
      }

      const taskInfo = globalPipelineConfigs[taskType];
      return {
          serviceId: taskInfo.serviceId,
          endpoint: globalPipelineConfigs.inferenceEndpoint,
          authKey: globalPipelineConfigs.computeAuthKey,
          authToken: globalPipelineConfigs.computeAuthValue
      };
  }


  // --- Core Flask Backend Query ---
  static async queryFlaskBackend(prompt) {
    console.log(`Querying Flask backend at ${FLASK_API_BASE}/ask with prompt: "${prompt.substring(0, 50)}..."`);
    try {
      const response = await fetch(`${FLASK_API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP error! Status: ${response.status} ${response.statusText}`;
        throw new Error(`Flask backend failed: ${errorMsg}`);
      }

      const data = await response.json();

      if (data.answer) {
        console.log("Received answer from Flask backend:", data.answer.substring(0, 50));
        return {
          success: true,
          data: data.answer,
          model: "Azure via Flask (RAG)",
          timestamp: new Date().toISOString()
        };
      } else {
        console.error("Flask backend response missing 'answer' key:", data);
        return {
          success: false,
          error: data.error || "Unexpected response format from Flask backend (missing 'answer').",
          data: null
        };
      }
    } catch (error) {
      console.error("Flask API call failed:", error);
      return {
        success: false,
        error: error.message || "Failed to connect to Flask backend. Is it running on port 5000?",
        data: null
      };
    }
  }

  // --- Fallback Direct Azure OpenAI Query ---
  static async _queryAzureOpenAIDirect(prompt, language = 'en', options = {}) {
    const {
      maxTokens = 500,
      temperature = 0.7,
      systemMessage = null
    } = options;

    const configStatus = isApiConfigured();
    if (!configStatus.azureOpenAI) {
      console.warn("Direct Azure OpenAI is not configured. Skipping direct call.");
      return {
        success: false,
        error: 'Azure OpenAI is not configured in API_CONFIG. Please set up your API credentials.',
        data: null
      };
    }

    console.log(`Attempting direct Azure OpenAI query with prompt: "${prompt.substring(0, 50)}..."`);
    try {
      const languageInstructions = { 'en': 'English' };

      const defaultSystemMessage = `You are a legal literacy assistant helping people understand their legal rights and procedures in India. 
        Provide clear, simple explanations suitable for common people. Focus on practical legal advice and procedures.
        Respond in ${languageInstructions[language] || 'English'}. Keep answers concise but comprehensive.
        Include relevant Indian laws and procedures when applicable.
        If unsure about specific legal details, recommend consulting a lawyer. Use examples to make concepts clearer.`;
      
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
              { role: 'system', content: systemMessage || defaultSystemMessage },
              { role: 'user', content: prompt }
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
      console.log("Received answer directly from Azure:", data.choices[0]?.message?.content?.substring(0, 50));
      return {
        success: true,
        data: data.choices[0]?.message?.content || 'Sorry, I could not process your request directly from Azure.',
        usage: data.usage || null
      };
    } catch (error) {
      console.error('Azure OpenAI Direct Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get AI response directly from Azure',
        data: null
      };
    }
  }

  // --- Bhashini Translation (Text-to-Text) ---
  static async translateText(text, sourceLang, targetLang) {
    const configStatus = isApiConfigured();
    if (!configStatus.bhashini) {
      console.warn("Bhashini translation service is not configured.");
      return { success: false, error: 'Bhashini translation service is not configured.', data: null };
    }

    if (sourceLang === targetLang) {
      console.log("Skipping translation: source and target languages are the same.");
      return { success: true, data: text, sourceText: text, sourceLang: sourceLang, targetLang: targetLang, skipped: true };
    }

    console.log(`Translating from ${sourceLang} to ${targetLang}: "${text.substring(0, 50)}..."`);
    try {
      // Get translation service info (dynamic or fallback)
      const translationInfo = await AIService._getBhashiniTaskInfo('translation', sourceLang, targetLang);
      const translationEndpoint = translationInfo.endpoint;
      const translationServiceId = translationInfo.serviceId;

      const translationResponse = await fetch(translationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [translationInfo.authKey]: translationInfo.authToken // Use dynamic auth key/token
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
                source: text // Bhashini expects 'source' for text input
              }
            ]
          }
        })
      });

      if (!translationResponse.ok) {
        throw new Error(`Bhashini Translation API error: ${translationResponse.status} ${translationResponse.statusText} - ${await translationResponse.text()}`);
      }

      const translationData = await translationResponse.json();
      
      if (!translationData.pipelineResponse || 
          !translationData.pipelineResponse[0] || 
          !translationData.pipelineResponse[0].output || 
          !translationData.pipelineResponse[0].output[0]) {
        throw new Error('Invalid translation response structure from Bhashini translation API.');
      }

      console.log("Translation successful:", translationData.pipelineResponse[0].output[0].target.substring(0, 50));
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

  // --- Bhashini Speech-to-Text (ASR) ---
  static async speechToText(audioBase64, sourceLangCode) {
    const configStatus = isApiConfigured();
    if (!configStatus.bhashini) {
        return { success: false, error: 'Bhashini ASR service is not configured.', data: null };
    }

    console.log(`Performing ASR for ${sourceLangCode} audio.`);
    try {
        // Get ASR service info (dynamic or fallback)
        const asrInfo = await AIService._getBhashiniTaskInfo('asr', sourceLangCode);
        const asrEndpoint = asrInfo.endpoint;
        const asrServiceId = asrInfo.serviceId;

        // Perform ASR inference
        const asrResponse = await fetch(asrEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [asrInfo.authKey]: asrInfo.authToken // Use dynamic auth key/token
            },
            body: JSON.stringify({
                pipelineTasks: [{
                    taskType: 'asr',
                    config: {
                        language: { sourceLanguage: sourceLangCode },
                        serviceId: asrServiceId
                        // postProcessors: ['transliteration'] // Optional: for transliteration, if needed
                    }
                }],
                inputData: {
                    audio: [{ audioContent: audioBase64 }],
                    audioFormat: 'wav' // Ensure your recorded audio is in WAV format
                }
            })
        });

        if (!asrResponse.ok) {
            throw new Error(`Bhashini ASR Inference API error: ${asrResponse.status} ${asrResponse.statusText} - ${await asrResponse.text()}`);
        }
        const asrData = await asrResponse.json();
        const recognizedText = asrData.pipelineResponse[0]?.output[0]?.source;

        if (!recognizedText) {
            // ASR might return empty string for silent/unclear audio, check if it's explicitly null/undefined
            if (recognizedText === undefined || recognizedText === null) {
                throw new Error('ASR response missing recognized text content.');
            }
            // If it's an empty string, it's still a "success" but with no text.
            console.warn("ASR returned empty recognized text (likely silent audio).");
            return { success: true, data: "", sourceLang: sourceLangCode, warning: "No speech recognized." };
        }

        console.log("ASR successful, recognized text:", recognizedText.substring(0, 50));
        return { success: true, data: recognizedText, sourceLang: sourceLangCode };

    } catch (error) {
        console.error('Bhashini ASR Error:', error);
        return { success: false, error: error.message || 'Speech to text conversion failed', data: null };
    }
  }

  // --- Bhashini Text-to-Speech (TTS) ---
  static async textToSpeech(text, targetLangCode) {
    const configStatus = isApiConfigured();
    if (!configStatus.bhashini) {
        return { success: false, error: 'Bhashini TTS service is not configured.', data: null };
    }

    console.log(`Performing TTS for ${targetLangCode}: "${text.substring(0, 50)}..."`);
    try {
        // Get TTS service info (dynamic or fallback)
        const ttsInfo = await AIService._getBhashiniTaskInfo('tts', targetLangCode); // TTS sourceLang is targetLangCode
        const ttsEndpoint = ttsInfo.endpoint;
        const ttsServiceId = ttsInfo.serviceId;

        // Perform TTS inference
        const ttsResponse = await fetch(ttsEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [ttsInfo.authKey]: ttsInfo.authToken // Use dynamic auth key/token
            },
            body: JSON.stringify({
                pipelineTasks: [{
                    taskType: 'tts',
                    config: {
                        language: { sourceLanguage: targetLangCode }, // Source language for TTS is the language of the text input
                        serviceId: ttsServiceId,
                        gender: 'female' // You can specify male/female if available for the model
                    }
                }],
                inputData: {
                    input: [{ source: text }] // Bhashini expects 'source' for text input
                }
            })
        });

        if (!ttsResponse.ok) {
            throw new Error(`Bhashini TTS Inference API error: ${ttsResponse.status} ${ttsResponse.statusText} - ${await ttsResponse.text()}`);
        }
        const ttsData = await ttsResponse.json();
        const audioBase64Content = ttsData.pipelineResponse[0]?.audio[0]?.audioContent;
        const audioFormat = ttsData.pipelineResponse[0]?.audio[0]?.audioFormat || 'wav'; // Default to wav if not specified

        if (!audioBase64Content) {
            throw new Error('TTS response missing audio content.');
        }

        console.log("TTS successful, received audio.");
        return { success: true, data: `data:audio/${audioFormat};base64,${audioBase64Content}` };

    } catch (error) {
        console.error('Bhashini TTS Error:', error);
        return { success: false, error: error.message || 'Text to speech conversion failed', data: null };
    }
  }

  // --- Main AI Query Orchestration with Translation and Audio ---
  // This is the function homescreen.jsx will call.
  static async queryAIWithAudioAndTranslation({
    textQuery,
    audioQueryBase64,
    sourceLangCode, // Language of audio input if provided, or text input if no audio
    targetLangCode // Desired output language for AI response and TTS
  }) {
    console.log(`Initiating AI query. Audio input: ${!!audioQueryBase64}, Text input: ${!!textQuery}, Source: ${sourceLangCode}, Target: ${targetLangCode}`);
    try {
      const configStatus = isApiConfigured();
      let prompt = textQuery; // Start with text query, if provided

      // --- Step 1: Handle Speech-to-Text if audio input is provided ---
      if (audioQueryBase64) {
        if (!configStatus.bhashini) {
          // If Bhashini not configured, cannot do ASR
          return {
            success: true,
            data: "Bhashini ASR service not configured. Please enable and configure Bhashini to use audio input.",
            warning: "ASR service unavailable."
          };
        }
        const asrResult = await this.speechToText(audioBase64, sourceLangCode);
        if (asrResult.success && asrResult.data) { // Check for asrResult.data (recognized text)
          prompt = asrResult.data; // Use recognized text as the prompt
          console.log(`ASR converted audio to text: "${prompt.substring(0, 50)}..."`);
        } else {
            // If ASR failed or returned empty text
            const errorMessage = asrResult.error || asrResult.warning || "Speech to text conversion failed (no speech recognized or ASR error).";
            return {
              success: true,
              data: `Failed to convert speech to text: ${errorMessage}. Please try typing your question.`,
              warning: errorMessage
            };
        }
      }

      // If no text prompt (neither initial textQuery nor ASR result), return error
      if (!prompt || !prompt.trim()) {
        return { success: true, data: "No question provided for AI assistant.", warning: "Empty query." };
      }

      // --- Step 2: Translate User Query to English for Flask RAG (if necessary) ---
      let translatedPromptToEnglish = prompt;
      if (sourceLangCode && sourceLangCode !== 'en') {
        if (!configStatus.bhashini) {
          return { success: true, data: "Bhashini translation service not configured. Please configure Bhashini to ask questions in languages other than English.", warning: "Translation service unavailable." };
        }
        const translationResult = await this.translateText(prompt, sourceLangCode, 'en');
        if (translationResult.success) {
          translatedPromptToEnglish = translationResult.data;
          console.log(`Translated user prompt to English: "${translatedPromptToEnglish.substring(0, 50)}..."`);
        } else {
          // If translation fails, proceed with original prompt but add a warning
          console.warn(`Translation of user prompt failed: ${translationResult.error}. Proceeding with original prompt.`);
          return { success: true, data: `Translation of your query failed: ${translationResult.error}. Please try again.`, warning: "Translation failed. Original prompt sent." };
        }
      }

      // --- Step 3: Query Flask Backend (RAG + Azure OpenAI) ---
      const aiResponseResult = await this.queryFlaskBackend(translatedPromptToEnglish);
      if (!aiResponseResult.success) {
        // If Flask backend fails, try direct Azure OpenAI as a fallback
        if (configStatus.azureOpenAI) {
            console.warn("Flask backend query failed, attempting direct Azure OpenAI fallback.");
            const directAzureResult = await this._queryAzureOpenAIDirect(translatedPromptToEnglish, 'en');
            if (directAzureResult.success) {
                directAzureResult.warning = (directAzureResult.warning || '') + ' Flask backend unavailable, used direct Azure OpenAI.';
                return directAzureResult;
            } else {
                return { success: true, data: `AI service unavailable: ${directAzureResult.error}. Please consult a legal professional.`, warning: "AI service unavailable." };
            }
        } else {
            return { success: true, data: `AI service unavailable: ${aiResponseResult.error}. Please consult a legal professional.`, warning: "AI service unavailable." };
        }
      }

      // --- Step 4: Translate AI Response to Target Language (if necessary) ---
      if (targetLangCode && targetLangCode !== 'en') {
        if (!configStatus.bhashini) {
          return { success: true, data: aiResponseResult.data, warning: "Translation service not configured, returning response in English." };
        }
        const finalTranslationResult = await this.translateText(aiResponseResult.data, 'en', targetLangCode);
        if (finalTranslationResult.success) {
          console.log(`Translated AI response to target language: "${finalTranslationResult.data.substring(0, 50)}..."`);
          return { success: true, data: finalTranslationResult.data, originalText: aiResponseResult.data, translated: true, usage: aiResponseResult.usage };
        } else {
          console.warn(`Translation of AI response failed: ${finalTranslationResult.error}. Returning English response.`);
          return { success: true, data: aiResponseResult.data, warning: "Translation of AI response failed, returning in English." };
        }
      }

      // If no translation needed, return the AI response directly
      return aiResponseResult;

    } catch (error) {
      console.error('AI Query with Audio and Translation (Overall) Error:', error);
      return { success: false, error: error.message || 'Failed to process AI query with audio and translation', data: null };
    }
  }

  // Batch translation function
  static async batchTranslate(texts, sourceLang, targetLang) {
    const results = [];
    for (const text of texts) {
      const result = await this.translateText(text, sourceLang, targetLang);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 100)); // Add a small delay to avoid rate limiting
    }
    return results;
  }

  // Basic language detection (can be enhanced or replaced by a proper API)
  static detectLanguage(text) {
    const patterns = {
      hi: /[\u0900-\u097F]/, bn: /[\u0980-\u09FF]/, gu: /[\u0A80-\u0AFF]/,
      kn: /[\u0C80-\u0CFF]/, ml: /[\u0D00-\u0D7F]/, mr: /[\u0900-\u097F]/,
      ta: /[\u0B80-\u0BFF]/, te: /[\u0C00-\u0C7F]/, ur: /[\u0600-\u06FF]/,
      // Add more language patterns as needed
    };
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    return 'en'; // Default to English if no other language is detected
  }

  // Health check for all configured APIs
  static async checkAPIHealth() {
    const results = {
      flaskBackend: false,
      azureOpenAIDirect: false,
      bhashini: false,
      timestamp: new Date().toISOString(),
      configured: isApiConfigured() // Use the updated isApiConfigured check
    };

    // Check Flask Backend Health
    if (results.configured.flaskBackend) {
        try {
            const flaskResponse = await fetch(`${FLASK_API_BASE}/`); // Ping the root URL
            results.flaskBackend = flaskResponse.ok;
            if (!flaskResponse.ok) {
                console.error(`Flask backend health check failed: ${flaskResponse.status} ${flaskResponse.statusText}`);
            }
        } catch (error) {
            console.error('Flask backend health check failed:', error);
        }
    } else {
        console.warn("Flask backend API is not configured or URL is default, skipping health check.");
    }

    // Check Direct Azure OpenAI Health (only if configured in API_CONFIG)
    if (results.configured.azureOpenAI) {
        try {
            const azureTest = await this._queryAzureOpenAIDirect('Test health check', 'en', { maxTokens: 10 });
            results.azureOpenAIDirect = azureTest.success;
        } catch (error) {
            console.error('Direct Azure OpenAI health check failed:', error);
        }
    } else {
        console.warn("Direct Azure OpenAI API is not configured, skipping health check.");
    }

    // Check Bhashini Health (only if configured in API_CONFIG)
    if (results.configured.bhashini) {
        // Attempt a small translation to check Bhashini health
        try {
            const bhashiniTest = await AIService.translateText('Hello', 'en', 'hi');
            results.bhashini = bhashiniTest.success;
        } catch (error) {
            console.error('Bhashini health check failed:', error);
        }
    } else {
        console.warn("Bhashini API is not configured, skipping health check.");
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

// Language mapping for Bhashini (consistent with Layout component)
export const BHASHINI_LANGUAGE_CODES = {
  'en': 'en', 'hi': 'hi', 'bn': 'bn', 'gu': 'gu', 'kn': 'kn', 'ml': 'ml',
  'mr': 'mr', 'or': 'or', 'pa': 'pa', 'ta': 'ta', 'te': 'te', 'ur': 'ur'
};

// Supported languages (consistent with Layout component)
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', bhashiniCode: 'en' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', bhashiniCode: 'hi' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', bhashiniCode: 'bn' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳', bhashiniCode: 'gu' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳', bhashiniCode: 'kn' },
  { code: 'ml', name: 'മലയാളം', flag: '🇮🇳', bhashiniCode: 'ml' },
  { code: 'mr', name: 'मराठी', flag: '?🇳', bhashiniCode: 'mr' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳', bhashiniCode: 'ta' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳', bhashiniCode: 'te' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', bhashiniCode: 'ur' }
];

// Export the AIService class as the default export.
export default AIService;

// Export other necessary utility functions/constants as named exports.
// IMPORTANT: These are removed from this list because they are already exported where they are defined.
// export { isApiConfigured, SUPPORTED_LANGUAGES, BHASHINI_LANGUAGE_CODES, setApiConfig, getApiConfig };
export { }; // Empty export as they are already exported above
