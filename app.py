# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS to allow cross-origin requests from your frontend
from rag_utils import load_documents, search # Import your RAG utilities
import os
import openai # Keep if you plan to switch to the openai library directly (currently using 'requests')
from dotenv import load_dotenv # To load environment variables from .env file
import requests # To make HTTP requests to Azure OpenAI

load_dotenv() # Load environment variables from .env file

# Retrieve Azure OpenAI configuration from environment variables
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_DEPLOYMENT_NAME")
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")

app = Flask(__name__)
CORS(app) # Enable CORS for all routes, allowing your frontend to connect

# Initialize the RAG model (load documents and build search index)
# This is called once when the Flask app starts.
try:
    load_documents()
    print("RAG model initialized successfully.")
except FileNotFoundError:
    print("Error: 'bareacts.txt' not found. Please ensure it's in the 'legal_data/' directory relative to app.py.")
    # In a production scenario, you might want to exit or disable AI features gracefully here.
except Exception as e:
    print(f"Error initializing RAG model: {e}")

# Define a simple root route for health checking and initial access
@app.route('/')
def home():
    """
    Provides a simple message indicating the Flask API is running.
    Useful for health checks from the frontend or direct browser access.
    """
    return "LegalEase Flask API is running! Access /ask for RAG functionality."

# Define the /ask endpoint for AI queries
@app.route("/ask", methods=["POST"])
def ask():
    """
    Handles POST requests for AI queries.
    Retrieves relevant legal chunks using RAG and sends them to Azure OpenAI for an answer.
    """
    question = request.json.get("question")
    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        # Step 1: Retrieve relevant chunks using the RAG search function
        chunks = search(question)
        context = "\n\n".join(chunks) # Combine chunks into a single context string

        # Step 2: Construct the prompt for Azure OpenAI with the RAG context
        # Instruct the AI to use the provided context and suggest consulting a lawyer if context is insufficient.
        prompt = f"""You are a helpful legal assistant for Indian citizens. Use the following context to answer the user's question.
        If the context does not contain enough information to answer the question, state that you cannot answer based on the provided context, and suggest consulting a qualified legal professional or visiting a legal aid center.
        Provide clear, simple explanations suitable for common people.

        Context:
        {context}

        Question: {question}"""

        # Prepare headers for the Azure OpenAI API request
        headers = {
            "Content-Type": "application/json",
            "api-key": AZURE_API_KEY
        }

        # Prepare the payload for the Azure OpenAI chat completion API
        payload = {
            "messages": [
                { "role": "system", "content": "You are a legal expert for Indian citizens." },
                { "role": "user", "content": prompt }
            ],
            "temperature": 0.5, # Controls randomness: lower for more deterministic, higher for more creative
            "max_tokens": 800,  # Maximum number of tokens (words/pieces) in the response
            "top_p": 0.95       # Controls diversity via nucleus sampling
        }

        # Step 3: Make the request to Azure OpenAI
        response = requests.post(
            f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}",
            headers=headers,
            json=payload
        )
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        data = response.json() # Parse the JSON response from Azure OpenAI

        # Step 4: Extract the AI's answer from the response
        ai_answer = data["choices"][0]["message"]["content"]
        
        # Return the AI's answer in a JSON response
        return jsonify({
            "answer": ai_answer
        })

    except requests.exceptions.RequestException as e:
        # Handle errors related to the HTTP request itself (e.g., network issues, invalid API key)
        print(f"Request to Azure OpenAI failed: {e}")
        return jsonify({ "error": f"Failed to connect to AI service or Azure API error: {e}" }), 500
    except KeyError:
        # Handle cases where the response structure from Azure OpenAI is not as expected
        print(f"Unexpected response structure from Azure OpenAI: {data}")
        return jsonify({ "error": "Unexpected AI response format. Please check Azure deployment." }), 500
    except RuntimeError as e:
        # Handle errors from rag_utils (e.g., RAG index not loaded)
        print(f"RAG error: {e}")
        return jsonify({ "error": f"RAG model not ready or search failed: {e}" }), 500
    except Exception as e:
        # Catch any other unexpected errors during the process
        print(f"An unexpected error occurred in Flask API: {e}")
        return jsonify({ "error": f"An internal server error occurred: {e}" }), 500

# Run the Flask application
if __name__ == "__main__":
    # Ensure the Flask app runs on port 5000 and is accessible externally (0.0.0.0)
    # This matches the FLASK_API_BASE in your apiservice.jsx
    app.run(debug=True, host='0.0.0.0', port=5000)
