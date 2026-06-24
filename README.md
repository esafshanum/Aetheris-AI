# Aetheris - Premium AI Chatbot Assistant

Aetheris is a fully-featured, modern, and visually stunning AI chatbot assistant built with a **FastAPI backend** and a **Vanilla HTML/CSS/JS frontend SPA**. Designed to mimic the user experience of ChatGPT, Aetheris integrates secure token-based user sessions, real-time multi-turn streaming exchanges, complex document parsing (PDF, DOCX, CSV, Excel, TXT, MD) with a hybrid RAG retrieval system, and real-time browser-based voice input and speech synthesis.

---

## 🌟 Key Features

1. **Stunning Glassmorphic Interface**: A clean, modern SPA utilizing Outfit typography, dynamic HSL colors, smooth state animations, and a seamless Dark/Light theme toggle.
2. **Multi-Turn Chat Streaming**: Real-time message streaming using Server-Sent Events (SSE) via FastAPI's `StreamingResponse`, yielding instant typing effects.
3. **Retrieval-Augmented Generation (RAG)**:
   - File parsers for PDF, DOCX, CSV, Excel, TXT, and Markdown files.
   - Recursive character text splitting and indexing.
   - Hybrid index database: utilizes OpenAI embeddings + FAISS when API Key is active, and automatically falls back to a custom **local TF-IDF vector ranking index** in Demo Mode (offline and zero-dependency).
4. **Voice Interaction**:
   - **Speech-to-Text (STT)**: Integrated with the Web Speech API `SpeechRecognition` to dictate prompts in real time.
   - **Text-to-Speech (TTS)**: Integrated with `SpeechSynthesis` to read AI responses. Features speed adjustments, voice model selection, and play/pause/stop and auto-read configurations.
5. **Secure Authentication (JWT)**: Secure user registration, password hashing (bcrypt), and token session validity checks.
6. **Chat Management**: Rename chat sessions, search histories, delete records, and export chats as raw Text (`.txt`) logs or formatted PDF (`.pdf`) transcripts.
7. **Client Settings Overrides**: Input a personal OpenAI API Key, select completion models, adjust response temperature, and toggle speech synthesis settings inside a sleek modal.
8. **Demo Mode Fallback**: Runs out of the box without any initial configuration or API keys, letting users explore the interface immediately.

---

## 📂 Project Architecture

```
AI_Chatbot/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── auth_routes.py     # Register and token login routes
│   │   │   ├── chat_routes.py     # Sessions management & SSE streaming
│   │   │   ├── document_routes.py # File ingestion and indexing
│   │   │   └── settings_routes.py # Configuration diagnostics
│   │   ├── services/
│   │   │   ├── llm_service.py     # OpenAI API integration & Title generation
│   │   │   └── rag_service.py     # Document text parsers & vector stores
│   │   ├── utils/
│   │   │   ├── security.py        # Validations, sanitization & Rate limits
│   │   │   └── helpers.py         # TXT and PDF exporters (fpdf2)
│   │   ├── config.py              # Environment variable loader
│   │   ├── database.py            # SQLite database connection sessions
│   │   ├── models.py              # Users, Chats, and Files database schemas
│   │   ├── schemas.py             # Pydantic data schemas
│   │   └── main.py                # FastAPI app bootstrap
│
├── frontend/
│   ├── templates/
│   │   └── index.html             # Combined Single Page Application layout
│   └── static/
│       ├── css/
│       │   └── styles.css         # Glassmorphic themes & animations styles
│       └── js/
│           ├── auth.js            # Auth login state manager
│           ├── voice.js           # Web Speech API (STT / TTS) controller
│           └── app.js             # Streams connection, settings & chat logic
│
├── uploads/                       # Temp folder for files storage
├── vectorstore/                   # Local FAISS index files directory
├── requirements.txt               # Backend Python requirements
├── .env                           # Local environment parameters
├── Dockerfile                     # Image recipe
├── docker-compose.yml             # Orchestration composition
└── README.md                      # Setup instructions
```

---

## 🚀 Local Installation & Execution

### Prerequisites
- **Python 3.11+** installed.
- Modern browser (Google Chrome, Microsoft Edge, or Apple Safari are recommended for full Web Speech API compatibility).

### Step-by-Step Setup

1. **Clone or navigate to the workspace**:
   ```bash
   cd c:\Users\Shanum\OneDrive\Desktop\AI_Chatbot
   ```

2. **Create a Python Virtual Environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment**:
   - On Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - On Linux/macOS:
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure Environment Variables**:
   Open the `.env` file in the project root. If you want to use the OpenAI API, add your key:
   ```env
   OPENAI_API_KEY=sk-proj-yourActualKeyHere...
   ```
   *Note: If left empty, Aetheris runs in **Demo Mode**. You can still input your API key inside the **Settings** modal in the UI later.*

6. **Start the Backend Server**:
   ```bash
   uvicorn backend.app.main:app --reload
   ```

7. **Open Aetheris in your Browser**:
   Open [http://localhost:8000](http://localhost:8000) in your web browser.

---

## 🐳 Docker Deployment

To build and run the entire application as a single Docker container, use Docker Compose:

1. **Verify your Docker installation is active**.
2. **Build and start the container**:
   ```bash
   docker-compose up --build -d
   ```
3. **Access the application**:
   Open [http://localhost:8000](http://localhost:8000).
4. **Stop the container**:
   ```bash
   docker-compose down
   ```

---

## 🔒 Security Measures
- **Rate Limiting**: Enforced via custom backend middleware, limiting client requests to a maximum of 100 requests per minute.
- **File Validation**: Uploads are capped at a maximum of 10MB. Files are sanitized and restricted only to allowed extensions (`.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx`, `.xls`, `.md`).
- **Input Sanitization**: User inputs are escaped to protect against XSS injections, and prompt inputs are filtered for jailbreak terms.
