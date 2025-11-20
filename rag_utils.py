import os
from sentence_transformers import SentenceTransformer
from sklearn.neighbors import NearestNeighbors
import numpy as np

# Global variables
texts = []
vectors = None
nn_model = None
model = SentenceTransformer('all-MiniLM-L6-v2')

def load_documents():
    """
    Loads and encodes legal documents from bareacts.txt using sentence-transformers
    and builds a nearest neighbor search index.
    """
    global texts, vectors, nn_model

    file_path = os.path.join("legal_data", "bareacts.txt")
    if not os.path.exists(file_path):
        raise FileNotFoundError("bareacts.txt not found in legal_data/")

    with open(file_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    # Split by double newlines
    texts = [chunk.strip() for chunk in raw_text.split("\n\n") if chunk.strip()]
    
    if not texts:
        raise ValueError("No valid chunks found in bareacts.txt")

    # Embed the text
    print(f"Encoding {len(texts)} legal chunks...")
    vectors = model.encode(texts, convert_to_numpy=True)

    # Build Nearest Neighbors index
    nn_model = NearestNeighbors(n_neighbors=3, metric='cosine')
    nn_model.fit(vectors)
    print("NearestNeighbors index built.")

def search(query, k=3):
    """
    Returns top-k most relevant chunks for the given query using cosine similarity.
    """
    global texts, vectors, nn_model
    if nn_model is None:
        raise RuntimeError("Index not loaded. Call load_documents() first.")

    query_vec = model.encode([query])
    distances, indices = nn_model.kneighbors(query_vec, n_neighbors=k)
    return [texts[i] for i in indices[0]]
