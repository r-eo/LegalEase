import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
# IMPORTANT: Replace these with your actual Azure OpenAI credentials.
# These should be the same as in your app.py's .env file.
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_DEPLOYMENT_NAME")
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview") # Use a default version if not set

def check_azure_openai_credentials():
    """
    Attempts to make a simple chat completion request to Azure OpenAI
    to verify if the configured credentials are correct and working.
    """
    print("--- Azure OpenAI Credential Checker ---")
    print(f"Endpoint: {AZURE_ENDPOINT}")
    print(f"Deployment: {AZURE_DEPLOYMENT}")
    print(f"API Version: {AZURE_API_VERSION}")
    print("-" * 35)

    # Basic validation for configuration
    if not all([AZURE_ENDPOINT, AZURE_API_KEY, AZURE_DEPLOYMENT, AZURE_API_VERSION]):
        print("\nERROR: One or more Azure OpenAI environment variables are missing or empty.")
        print("Please ensure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,")
        print("AZURE_DEPLOYMENT_NAME, and AZURE_OPENAI_API_VERSION are set in your .env file.")
        return

    # Prepare headers for the API request
    headers = {
        "Content-Type": "application/json",
        "api-key": AZURE_API_KEY
    }

    # Prepare a simple chat completion payload
    payload = {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, how are you today?"}
        ],
        "max_tokens": 50, # Keep it short for a quick check
        "temperature": 0.7
    }

    try:
        # Construct the full URL for the chat completions API
        request_url = (
            f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions"
            f"?api-version={AZURE_API_VERSION}"
        )
        print(f"Attempting to connect to: {request_url}")

        # Make the POST request to Azure OpenAI
        response = requests.post(
            request_url,
            headers=headers,
            json=payload,
            timeout=10 # Set a timeout for the request
        )

        # Raise an exception for HTTP errors (4xx or 5xx)
        response.raise_for_status()

        # Parse the JSON response
        data = response.json()

        # Extract the content from the AI's response
        ai_response_content = data.get("choices", [])[0].get("message", {}).get("content", "No content found.")

        print("\n--- Connection Successful! ---")
        print("Azure OpenAI API responded without errors.")
        print("Test AI Response (snippet):")
        print(f"'{ai_response_content}'")
        print("\nYour Azure OpenAI credentials appear to be correct and functional.")

    except requests.exceptions.HTTPError as e:
        print(f"\nERROR: HTTP Error occurred: {e.response.status_code} - {e.response.reason}")
        print(f"Response body: {e.response.text}")
        print("Possible causes:")
        print(" - Incorrect AZURE_OPENAI_ENDPOINT or AZURE_DEPLOYMENT_NAME.")
        print(" - Incorrect AZURE_OPENAI_API_KEY (401 Unauthorized or 403 Forbidden).")
        print(" - Invalid AZURE_OPENAI_API_VERSION (404 Not Found).")
        print(" - Network issues or Azure service outages.")
    except requests.exceptions.ConnectionError as e:
        print(f"\nERROR: Connection Error: {e}")
        print("Possible causes:")
        print(" - Azure OpenAI endpoint is unreachable. Check URL or your network connection.")
        print(" - DNS resolution issues.")
    except requests.exceptions.Timeout:
        print("\nERROR: Request timed out.")
        print("The request to Azure OpenAI took too long. This could be due to network latency")
        print("or an overloaded Azure service.")
    except requests.exceptions.RequestException as e:
        print(f"\nERROR: An unexpected request error occurred: {e}")
    except KeyError:
        print(f"\nERROR: Unexpected response format from Azure OpenAI: {data}")
        print("The response structure was not as expected. This might indicate an API version mismatch")
        print("or an issue on the Azure side.")
    except Exception as e:
        print(f"\nERROR: An unhandled exception occurred: {e}")

# Run the check when the script is executed
if __name__ == "__main__":
    check_azure_openai_credentials()

