import os
from fastapi import FastAPI, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine, Base
from backend.app.routes import auth_routes, chat_routes, document_routes, settings_routes, voice_routes
from backend.app.utils.security import SecurityUtils

# Create SQLite database tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Chatbot Assistant API",
    description="Backend API supporting authentication, chat history, document uploads and voice integrations.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local execution
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Apply global rate limit middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exclude static assets and main UI page from rate limit
    path = request.url.path
    if not (path.startswith("/static") or path == "/" or path == "/favicon.ico"):
        try:
            SecurityUtils.check_rate_limit(request)
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": str(e.detail) if hasattr(e, 'detail') else "Rate limit exceeded."}
            )
    response = await call_next(request)
    return response

# Ensure static directories and template folders exist
os.makedirs("frontend/static", exist_ok=True)
os.makedirs("frontend/templates", exist_ok=True)

# Serve Static Files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Templates setup
templates = Jinja2Templates(directory="frontend/templates")

# Frontend routes (serve Single Page Application)
@app.get("/", response_class=HTMLResponse)
def serve_spa(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# Register Backend Routers
app.include_router(auth_routes.router)
app.include_router(chat_routes.router)
app.include_router(document_routes.router)
app.include_router(settings_routes.router)
app.include_router(voice_routes.router)

# Custom Global Error Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please contact the administrator."}
    )
