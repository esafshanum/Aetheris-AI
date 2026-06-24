import os
import re
import math
import json
import pypdf
import docx2txt
import pandas as pd
import httpx
from collections import Counter
from typing import List, Dict, Any

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

from backend.app.config import settings

class RAGService:
    @staticmethod
    def extract_text(file_path: str, file_type: str) -> str:
        text = ""
        file_type = file_type.lower()

        if file_type == "pdf":
            reader = pypdf.PdfReader(file_path)
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            text = "\n".join(pages_text)

        elif file_type == "docx":
            text = docx2txt.process(file_path)

        elif file_type in ["txt", "md"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        elif file_type == "csv":
            df = pd.read_csv(file_path)
            rows = []
            for idx, row in df.iterrows():
                row_str = ", ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                rows.append(f"Row {idx + 1}: {row_str}")
            text = "\n".join(rows)

        elif file_type in ["xlsx", "xls"]:
            df = pd.read_excel(file_path)
            rows = []
            for idx, row in df.iterrows():
                row_str = ", ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                rows.append(f"Row {idx + 1}: {row_str}")
            text = "\n".join(rows)
            
        return text

    @classmethod
    def process_and_index_document(
        cls, 
        file_path: str, 
        file_type: str, 
        filename: str, 
        session_id: str, 
        user_key: str = None
    ) -> None:
        # Extract text
        raw_text = cls.extract_text(file_path, file_type)
        if not raw_text.strip():
            raise ValueError("No text could be extracted from this document.")

        # Chunk the text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, 
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(raw_text)
        
        # Meta dictionary for chunks
        chunk_dicts = []
        for i, chunk in enumerate(chunks):
            chunk_dicts.append({
                "id": f"{filename}_chunk_{i}",
                "text": chunk,
                "metadata": {
                    "source": filename,
                    "session_id": session_id,
                    "chunk_index": i
                }
            })

        # Save raw chunks to local JSON for our TF-IDF fallback index
        session_store_dir = os.path.join(settings.VECTOR_STORE_DIR, session_id)
        os.makedirs(session_store_dir, exist_ok=True)
        
        chunks_file = os.path.join(session_store_dir, "chunks.json")
        existing_chunks = []
        if os.path.exists(chunks_file):
            try:
                with open(chunks_file, "r", encoding="utf-8") as f:
                    existing_chunks = json.load(f)
            except Exception:
                existing_chunks = []

        existing_chunks.extend(chunk_dicts)
        with open(chunks_file, "w", encoding="utf-8") as f:
            json.dump(existing_chunks, f, indent=2, ensure_ascii=False)

        # Standard RAG indexing using FAISS if API Key is available
        api_key = user_key or settings.OPENAI_API_KEY
        if api_key:
            try:
                embeddings = OpenAIEmbeddings(
                    openai_api_key=api_key,
                    http_client=httpx.Client(verify=False)
                )
                texts = [c["text"] for c in chunk_dicts]
                metadatas = [c["metadata"] for c in chunk_dicts]
                
                faiss_index_path = os.path.join(session_store_dir, "faiss_index")
                
                if os.path.exists(faiss_index_path):
                    # Load existing FAISS index and add documents
                    db = FAISS.load_local(faiss_index_path, embeddings, allow_dangerous_deserialization=True)
                    db.add_texts(texts, metadatas=metadatas)
                else:
                    # Create new FAISS index
                    db = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
                
                db.save_local(faiss_index_path)
            except Exception as e:
                # Log error and fallback to pure local search
                print(f"FAISS indexing failed: {str(e)}. Falling back to local TF-IDF.")

    @classmethod
    def query_vector_store(
        cls, 
        query: str, 
        session_id: str, 
        user_key: str = None, 
        k: int = 4
    ) -> List[Dict[str, Any]]:
        session_store_dir = os.path.join(settings.VECTOR_STORE_DIR, session_id)
        if not os.path.exists(session_store_dir):
            return []

        api_key = user_key or settings.OPENAI_API_KEY
        faiss_index_path = os.path.join(session_store_dir, "faiss_index")

        # Try to use FAISS if configured and exists
        if api_key and os.path.exists(faiss_index_path):
            try:
                embeddings = OpenAIEmbeddings(
                    openai_api_key=api_key,
                    http_client=httpx.Client(verify=False)
                )
                db = FAISS.load_local(faiss_index_path, embeddings, allow_dangerous_deserialization=True)
                docs = db.similarity_search(query, k=k)
                
                return [
                    {
                        "text": doc.page_content,
                        "source": doc.metadata.get("source", "Unknown"),
                        "chunk_index": doc.metadata.get("chunk_index", 0)
                    }
                    for doc in docs
                ]
            except Exception as e:
                print(f"FAISS search failed: {str(e)}. Falling back to local TF-IDF.")

        # Fallback: Pure-Python TF-IDF similarity search
        chunks_file = os.path.join(session_store_dir, "chunks.json")
        if not os.path.exists(chunks_file):
            return []

        try:
            with open(chunks_file, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            if not chunks:
                return []
            
            return cls._tfidf_search(query, chunks, k)
        except Exception as e:
            print(f"Local TF-IDF search failed: {str(e)}")
            return []

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        # Simple lowercase tokenizer
        return re.findall(r"\w+", text.lower())

    @classmethod
    def _tfidf_search(cls, query: str, chunks: List[Dict[str, Any]], k: int) -> List[Dict[str, Any]]:
        query_tokens = cls._tokenize(query)
        if not query_tokens:
            # Return first k chunks if query tokenization is empty
            return [
                {
                    "text": c["text"],
                    "source": c["metadata"]["source"],
                    "chunk_index": c["metadata"]["chunk_index"]
                }
                for c in chunks[:k]
            ]

        # Calculate Document Frequency (DF) for IDF calculation
        # Documents = chunks
        num_docs = len(chunks)
        df = Counter()
        doc_tokens_list = []
        
        for c in chunks:
            tokens = cls._tokenize(c["text"])
            doc_tokens_list.append(tokens)
            unique_tokens = set(tokens)
            for token in unique_tokens:
                df[token] += 1

        # Calculate IDF
        idf = {}
        for token, count in df.items():
            idf[token] = math.log(1 + (num_docs / count))

        # Calculate scores
        scores = []
        for idx, c in enumerate(chunks):
            tokens = doc_tokens_list[idx]
            if not tokens:
                scores.append((0.0, idx))
                continue
                
            tf = Counter(tokens)
            
            # Compute similarity dot product (query terms only)
            dot_product = 0.0
            query_tf = Counter(query_tokens)
            
            # Vector magnitudes
            query_magnitude = 0.0
            doc_magnitude = 0.0
            
            # Since query is small, we calculate intersection
            for token in query_tf:
                q_val = query_tf[token] * idf.get(token, 0.0)
                query_magnitude += q_val ** 2
                
                if token in tf:
                    d_val = tf[token] * idf.get(token, 0.0)
                    dot_product += q_val * d_val

            # Compute doc vector magnitude for all terms in doc
            for token in tf:
                d_val = tf[token] * idf.get(token, 0.0)
                doc_magnitude += d_val ** 2

            query_magnitude = math.sqrt(query_magnitude)
            doc_magnitude = math.sqrt(doc_magnitude)

            if query_magnitude > 0 and doc_magnitude > 0:
                cosine_sim = dot_product / (query_magnitude * doc_magnitude)
            else:
                cosine_sim = 0.0
                
            scores.append((cosine_sim, idx))

        # Sort by similarity score descending
        scores.sort(key=lambda x: x[0], reverse=True)
        top_indices = [idx for _, idx in scores[:k]]

        results = []
        for idx in top_indices:
            c = chunks[idx]
            results.append({
                "text": c["text"],
                "source": c["metadata"]["source"],
                "chunk_index": c["metadata"]["chunk_index"]
            })
        return results

    @classmethod
    def delete_session_index(cls, session_id: str) -> None:
        session_store_dir = os.path.join(settings.VECTOR_STORE_DIR, session_id)
        if os.path.exists(session_store_dir):
            import shutil
            try:
                shutil.rmtree(session_store_dir)
            except Exception as e:
                print(f"Error deleting session directory {session_store_dir}: {str(e)}")
