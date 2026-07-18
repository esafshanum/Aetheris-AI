# Aetheris - Production Deployed AI Chatbot Assistant

Aetheris is a fully-featured, modern, and visually stunning AI chatbot assistant built with a **FastAPI backend** and a **Vanilla HTML/CSS/JS frontend SPA**. 

This repository is configured for a modern, decoupled production architecture:
1. **Frontend**: Hosted on **Vercel** as a high-performance static SPA.
2. **Backend**: Hosted on **Railway** inside a containerized FastAPI service.
3. **Database**: Hosted on **Supabase** via PostgreSQL.

---

## 📂 Project Architecture

```
AI_Chatbot/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── admin_routes.py    # System administration endpoints
│   │   │   ├── auth_routes.py     # Register, token, and change password routes
│   │   │   ├── chat_routes.py     # Session management & SSE message streaming
│   │   │   ├── document_routes.py # Document ingestion, parsing & indexing
│   │   │   ├── settings_routes.py # Client key validation endpoints
│   │   │   └── voice_routes.py    # Voice synthesis & TTS integrations
│   │   ├── services/
│   │   │   ├── llm_service.py     # Client cache, Groq, and OpenAI models
│   │   │   └── rag_service.py     # Document text parsers & vector stores
│   │   ├── utils/
│   │   │   ├── security.py        # Validations, sanitization & Rate limits
│   │   │   └── helpers.py         # TXT and PDF exporters (fpdf2)
│   │   ├── config.py              # Environment variables settings loader
│   │   ├── database.py            # PostgreSQL database connection sessionmaker
│   │   ├── models.py              # Users, Chats, and Files database tables
│   │   ├── schemas.py             # Pydantic validation schemas
│   │   └── main.py                # FastAPI bootstrap, health, and CORS setups
│
├── frontend/
│   ├── index.html                 # Main Single Page Application layout
│   ├── config.js                  # Dynamic API base URL & fetch interceptor (NEW)
│   ├── vercel.json                # Vercel routing configuration (NEW)
│   └── static/
│       ├── css/
│       │   └── styles.css         # Glassmorphic styles & responsiveness
│       └── js/
│           ├── auth.js            # Auth login state manager
│           ├── voice.js           # Web Speech API (STT / TTS) controller
│           └── app.js             # Streams connection, settings & chat logic
│
├── requirements.txt               # Python package dependencies
├── Dockerfile                     # Docker image setup
├── railway.toml                   # Railway production deployment configurations
├── Procfile                       # Gunicorn/Uvicorn process configurations
└── README.md                      # Deployment instructions
```

---

## 🚀 Migration & Production Deployment Steps

Follow these sequential steps to deploy your production system:

### Step 1: Create a Supabase Project & Retrieve Database Connection String
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Go to **Project Settings** > **Database** > **Connection string** > select **URI** (Connection Pooler or Direct).
3. Copy the URL string. It will look like:
   `postgresql://postgres.your-project-id:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`
4. Note your database credentials (URL, anonymous key, and service role key).

### Step 2: Deploy Backend to Railway
1. Sign in to [Railway](https://railway.app/).
2. Click **New Project** > **Deploy from GitHub repository** > Select your `Aetheris-AI` repository.
3. Railway will read the `railway.toml` file in the root and build the project using your `Dockerfile`.
4. Go to the project **Settings** > **Domains** > Click **Generate Domain** to get your live backend URL (e.g. `https://your-backend.up.railway.app`).

### Step 3: Add Backend Environment Variables on Railway
In the **Variables** tab of your Railway project, add the following variables:
- `DATABASE_URL` = *(Your Supabase Connection String from Step 1)*
- `JWT_SECRET` = *(Generate a strong secure string)*
- `OPENAI_API_KEY` = *(Your OpenAI API Key)*
- `GROQ_API_KEY` = *(Your Groq API Key)*
- `CORS_ALLOWED_ORIGINS` = `https://your-frontend.vercel.app` *(Your Vercel URL, or `*` temporarily)*
- `ADMIN_USERNAME` = `Shanumer@admin1204`
- `ADMIN_PASSWORD` = `Shanum@Aetheris#2026`

*Note: The backend will automatically run tables initialization and schema migration scripts on start to set up the users, chats, and files tables on Supabase PostgreSQL!*

### Step 4: Configure Frontend Live API URL
1. Open the [frontend/config.js](frontend/config.js) file.
2. Update the `window.API_BASE_URL` with your Railway backend domain:
   ```javascript
   window.API_BASE_URL = "https://your-backend-url.up.railway.app";
   ```
3. Commit and push this change to your GitHub repository:
   ```bash
   git add frontend/config.js
   git commit -m "Configure production Railway backend URL"
   git push origin main
   ```

### Step 5: Deploy Frontend to Vercel
1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New** > **Project** > Import your `Aetheris-AI` repository.
3. Under **Configure Project**:
   - Set **Root Directory** = `frontend` (This tells Vercel to serve the frontend SPA directly).
   - Keep build command and output directory default (Vercel automatically detects static HTML/JS).
4. Click **Deploy**. Vercel will build your static files and deploy them to a domain (e.g. `https://your-frontend.vercel.app`).
5. Copy your live Vercel URL and add it to your Railway backend's `CORS_ALLOWED_ORIGINS` variable to secure your APIs.

---

## 🧪 Verification & Health Testing

1. **Verify API connectivity**: Open your browser and navigate to `https://your-backend-url.up.railway.app/health`. You should see `{"status":"healthy",...}`.
2. **Test Database Connection**: Log in to Supabase and view the **Table Editor**. You should see the `users`, `chats`, and `files` tables initialized automatically.
3. **Verify CORS**: Open your live Vercel URL, click **Create Account** or **Log In**. Use your credentials and test a multi-turn chat stream!
