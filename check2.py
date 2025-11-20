import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID")
BHASHINI_ULCA_API_KEY = os.getenv("BHASHINI_API_KEY")

# Endpoint for fetching pipeline configurations
BHASHINI_PIPELINE_CONFIG_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
BHASHINI_SPECIFIC_PIPELINE_ID = "64392f96daac500b55c543cd" # MeitY Pipeline ID

# Global store for dynamically fetched pipeline configurations
# This will hold: {"translation": {...}, "asr": {...}, "tts": {...}, "inferenceEndpoint": "...", "computeAuthKey": "...", "computeAuthValue": "..."}
global_pipeline_configs = {}

def fetch_all_pipeline_configs(asr_source_lang="en", translation_source_lang="en", translation_target_lang="hi", tts_input_lang="en"):
    """
    Fetches configurations for ASR, Translation, and TTS in a single call
    and stores them globally for subsequent inference calls. This method is crucial
    for obtaining the correct dynamic service IDs and inference endpoint.
    """
    global global_pipeline_configs
    
    headers = {
        'Content-Type': 'application/json',
        'userID': BHASHINI_USER_ID,
        'ulcaApiKey': BHASHINI_ULCA_API_KEY,
        # Default headers for a general HTTP call, removed mobile-mimicking headers for simplicity
    }
    
    # Construct the payload to request configs for ASR, Translation, and TTS
    # based on the comprehensive structure that worked in Postman.
    payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {
                        "sourceLanguage": asr_source_lang
                    }
                }
            },
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": translation_source_lang,
                        "targetLanguage": translation_target_lang
                    }
                }
            },
            {  
                "taskType": "tts",
                "config": {
                    "language": {
                        "sourceLanguage": tts_input_lang # Language of the text input for TTS
                    }
                }
            }
        ],
        "controlConfig": {
            "dataTracking": True 
        },
        "pipelineRequestConfig": {
            "pipelineId": BHASHINI_SPECIFIC_PIPELINE_ID
        }
    }

    print(f"\nDEBUG: Calling overall pipeline config endpoint: {BHASHINI_PIPELINE_CONFIG_ENDPOINT}")
    print(f"DEBUG: Pipeline Config Request Headers: {headers}")
    print(f"DEBUG: Pipeline Config Request Payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(BHASHINI_PIPELINE_CONFIG_ENDPOINT, headers=headers, json=payload, timeout=20)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        data = response.json()
        
        # Store common inference endpoint and auth details
        if data.get("pipelineInferenceAPIEndPoint"):
            inference_api_endpoint_info = data["pipelineInferenceAPIEndPoint"]
            global_pipeline_configs["inferenceEndpoint"] = inference_api_endpoint_info.get("callbackUrl")
            
            inference_api_key_info = inference_api_endpoint_info.get("inferenceApiKey")
            if inference_api_key_info:
                global_pipeline_configs["computeAuthKey"] = inference_api_key_info.get("name")
                global_pipeline_configs["computeAuthValue"] = inference_api_key_info.get("value")

        # Extract specific configs (serviceId, modelId, language_info) for each task type
        if data.get("pipelineResponseConfig") and len(data["pipelineResponseConfig"]) > 0:
            for task_config_entry in data["pipelineResponseConfig"]:
                task_type = task_config_entry.get("taskType")
                if task_type and task_config_entry.get("config") and len(task_config_entry["config"]) > 0:
                    # Take the first available config for that task type
                    config_details = task_config_entry["config"][0]
                    global_pipeline_configs[task_type] = {
                        "serviceId": config_details.get("serviceId"),
                        "modelId": config_details.get("modelId"), # modelId can be useful for other calls/feedback
                        "language_info": config_details.get("language") # Store full language object for reference
                    }
        
        # Validate that we got all expected configurations
        if (global_pipeline_configs.get("inferenceEndpoint") and 
            global_pipeline_configs.get("computeAuthKey") and
            global_pipeline_configs.get("computeAuthValue") and
            global_pipeline_configs.get("asr") and 
            global_pipeline_configs.get("translation") and 
            global_pipeline_configs.get("tts")):
            print("\nDEBUG: Successfully fetched all pipeline configurations.")
            return True
        else:
            print(f"ERROR: Failed to fetch all required pipeline configs. Full response: {json.dumps(data, indent=2)}")
            global_pipeline_configs = {} # Clear partial config
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to fetch overall pipeline config: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response status: {e.response.status_code}")
            print(f"  Response body: {e.response.text}")
        global_pipeline_configs = {}
        return False


def get_task_specific_pipeline_info(task_type):
    """Retrieves specific pipeline info for a given task from the globally stored configs."""
    if not global_pipeline_configs:
        print("ERROR: Pipeline configurations not fetched yet. Call fetch_all_pipeline_configs first.")
        return None
    
    task_info = global_pipeline_configs.get(task_type)
    if not task_info:
        print(f"ERROR: No pipeline configuration found for task type: {task_type}")
        return None
    
    return {
        "serviceId": task_info["serviceId"],
        "inferenceEndpoint": global_pipeline_configs["inferenceEndpoint"],
        "computeAuthKey": global_pipeline_configs["computeAuthKey"],
        "computeAuthValue": global_pipeline_configs["computeAuthValue"]
    }


# --- Individual API Checker Functions (Now relying on dynamic config from fetch_all_pipeline_configs) ---

def check_bhashini_translation():
    """Checks Bhashini Text-to-Text Translation (NMT) API."""
    print("\n--- Checking Bhashini Translation (NMT) ---")
    
    test_text = "Hello, how are you?"
    source_lang = "en"
    target_lang = "hi"

    try:
        pipeline_info = get_task_specific_pipeline_info("translation")
        if not pipeline_info:
            print("Translation check skipped: Could not get pipeline info.")
            return

        service_id = pipeline_info["serviceId"]
        endpoint = pipeline_info["inferenceEndpoint"] # Dynamic endpoint
        compute_auth_key = pipeline_info["computeAuthKey"]
        compute_auth_value = pipeline_info["computeAuthValue"]

        print(f"Translation serviceId: {service_id}")
        print(f"Translation endpoint: {endpoint}")
        print(f"Translation Compute Auth: {compute_auth_key}: {compute_auth_value[:10]}...")

        headers = {
            'Content-Type': 'application/json',
            compute_auth_key: compute_auth_value # This will be "Authorization": "Bearer <token>"
        }
        
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang,
                            "targetLanguage": target_lang
                        },
                        "serviceId": service_id
                    }
                }
            ],
            "inputData": {
                "input": [
                    {"source": test_text} # Bhashini expects 'source' for text input
                ]
                # 'audio' field is deliberately omitted for translation
            }
        }
        
        print(f"DEBUG: Calling translation inference endpoint: {endpoint}")
        print(f"DEBUG: Translation Inference Request Headers (Auth masked): {{'Content-Type': 'application/json', 'Authorization': '{headers['Authorization'][:10]}...'}}")
        print(f"DEBUG: Translation Inference Request Payload: {json.dumps(payload, indent=2)}")


        response = requests.post(endpoint, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()

        translated_text = data.get("pipelineResponse", [])[0].get("output", [])[0].get("target")

        if translated_text:
            print(f"Original Text: '{test_text}' ({source_lang})")
            print(f"Translated Text: '{translated_text}' ({target_lang})")
            print("Bhashini Translation API appears to be working correctly.")
        else:
            print(f"ERROR: Translation response missing output. Response: {json.dumps(data, indent=2)}")
            print("Bhashini Translation API check failed.")

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Bhashini Translation API request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response status: {e.response.status_code}")
            print(f"  Response body: {e.response.text}")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during translation check: {e}")

def check_bhashini_asr():
    """Checks Bhashini Automatic Speech Recognition (ASR) API."""
    print("\n--- Checking Bhashini ASR (Speech-to-Text) ---")
    
    dummy_audio_base64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARgAAAUQAAABhAAgAU2FtY2tnaW9uAQAAAAIAAAAAAAAAAAAAAAAAAAAAAFRFWFQAAAAFQ2xvc3UAAABEYXRhAAAAAA=="
    source_lang = "en" # Language of the dummy audio

    try:
        pipeline_info = get_task_specific_pipeline_info("asr")
        if not pipeline_info:
            print("ASR check skipped: Could not get pipeline info.")
            return

        service_id = pipeline_info["serviceId"]
        endpoint = pipeline_info["inferenceEndpoint"] # Dynamic endpoint
        compute_auth_key = pipeline_info["computeAuthKey"]
        compute_auth_value = pipeline_info["computeAuthValue"]

        print(f"ASR serviceId: {service_id}")
        print(f"ASR endpoint: {endpoint}")
        print(f"ASR Compute Auth: {compute_auth_key}: {compute_auth_value[:10]}...")

        headers = {
            'Content-Type': 'application/json',
            compute_auth_key: compute_auth_value
        }
        
        # Optimized payload for ASR: only 'audio' field in 'inputData'
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {"sourceLanguage": source_lang},
                        "serviceId": service_id
                    }
                }
            ],
            "inputData": {
                "audio": [
                    {"audioContent": dummy_audio_base64}
                ],
                "audioFormat": "wav"
                # 'input' field is deliberately omitted for ASR
            }
        }
        
        print(f"DEBUG: Calling ASR inference endpoint: {endpoint}")
        print(f"DEBUG: ASR Inference Request Headers (Auth masked): {{'Content-Type': 'application/json', 'Authorization': '{headers['Authorization'][:10]}...'}}")
        print(f"DEBUG: ASR Inference Request Payload (truncated): {json.dumps(payload, indent=2)[:500]}...")


        response = requests.post(endpoint, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()

        recognized_text = data.get("pipelineResponse", [])[0].get("output", [])[0].get("source")

        if recognized_text:
            print(f"Recognized Text (from dummy audio): '{recognized_text}'")
            print("Bhashini ASR API appears to be working correctly.")
        else:
            print(f"WARNING: ASR response missing recognized text. Response: {json.dumps(data, indent=2)}")
            print("Bhashini ASR API check completed, but no text was recognized (expected for silent audio).")
            print("This likely indicates the API call itself was successful, but the dummy audio produced no output.")

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Bhashini ASR API request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response status: {e.response.status_code}")
            print(f"  Response body: {e.response.text}")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during ASR check: {e}")

def check_bhashini_tts():
    """Checks Bhashini Text-to-Speech (TTS) API."""
    print("\n--- Checking Bhashini TTS (Text-to-Speech) ---")
    
    test_text = "This is a test of the text to speech service."
    # The source language for TTS is the language of the text that will be converted to speech
    tts_input_lang = "en" 

    try:
        pipeline_info = get_task_specific_pipeline_info("tts")
        if not pipeline_info:
            print("TTS check skipped: Could not get pipeline info.")
            return

        service_id = pipeline_info["serviceId"]
        endpoint = pipeline_info["inferenceEndpoint"] # Dynamic endpoint
        compute_auth_key = pipeline_info["computeAuthKey"]
        compute_auth_value = pipeline_info["computeAuthValue"]

        print(f"TTS serviceId: {service_id}")
        print(f"TTS endpoint: {endpoint}")
        print(f"TTS Compute Auth: {compute_auth_key}: {compute_auth_value[:10]}...")

        headers = {
            'Content-Type': 'application/json',
            compute_auth_key: compute_auth_value
        }
        
        # Optimized payload for TTS: only 'input' field in 'inputData' with 'source' key
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {"sourceLanguage": tts_input_lang},
                        "serviceId": service_id,
                        "gender": "female" # Or "male" if supported/preferred
                    }
                }
            ],
            "inputData": {
                "input": [
                    {"source": test_text} # Changed to 'source' key based on Bhashini's error
                ]
                # 'audio' field is deliberately omitted for TTS
            }
        }

        print(f"DEBUG: Calling TTS inference endpoint: {endpoint}")
        print(f"DEBUG: TTS Inference Request Headers (Auth masked): {{'Content-Type': 'application/json', 'Authorization': '{headers['Authorization'][:10]}...'}}")
        print(f"DEBUG: TTS Inference Request Payload: {json.dumps(payload, indent=2)}")

        response = requests.post(endpoint, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()

        audio_content = data.get("pipelineResponse", [])[0].get("audio", [])[0].get("audioContent")
        audio_format = data.get("pipelineResponse", [])[0].get("audio", [])[0].get("audioFormat")

        if audio_content and audio_format:
            print(f"Received audio content (first 50 chars): '{audio_content[:50]}...'")
            print(f"Audio format: {audio_format}")
            print("Bhashini TTS API appears to be working correctly.")
            # Optionally, save to a file to verify playback
            # import base64 # Uncomment this and the line below
            # with open(f"test_tts_output.{audio_format}", "wb") as f:
            #     f.write(base64.b64decode(audio_content))
            # print(f"Audio saved to test_tts_output.{audio_format}")
        else:
            print(f"ERROR: TTS response missing audio content. Response: {json.dumps(data, indent=2)}")
            print("Bhashini TTS API check failed.")

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Bhashini TTS API direct request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response status: {e.response.status_code}")
            print(f"  Response body: {e.response.text}")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during direct TTS check: {e}")

# --- Main function to run all checks ---
if __name__ == "__main__":
    print("\n--- Bhashini API Credential Checker (Dynamic Config and Compute Test) ---")
    print(f"User ID: {BHASHINI_USER_ID}")
    print(f"API Key (masked): {BHASHINI_ULCA_API_KEY[:5]}...{BHASHINI_ULCA_API_KEY[-5:]}")
    print("-" * 35)

    if not BHASHINI_ULCA_API_KEY or BHASHINI_ULCA_API_KEY == "YOUR_FULL_UNMASKED_BHASHINI_API_KEY_HERE_STARTING_WITH_DaLc3":
        print("\nERROR: Please replace 'YOUR_FULL_UNMASKED_BHASHINI_API_KEY_HERE_STARTING_WITH_DaLc3'")
        print("in the script with your actual Bhashini Inference API Key before running.")
    else:
        # First, attempt to fetch all pipeline configs dynamically
        if fetch_all_pipeline_configs():
            # If successful, then proceed with checking individual tasks
            check_bhashini_translation()
            check_bhashini_asr()
            check_bhashini_tts()
        else:
            print("\nFATAL: Failed to fetch initial pipeline configurations. Cannot proceed with API checks.")
        print("\n--- Bhashini Checks Complete ---")
