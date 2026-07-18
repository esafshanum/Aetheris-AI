import os
from fastapi import FastAPI, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine, Base
from backend.app.routes import auth_routes, chat_routes, document_routes, settings_routes, voice_routes, admin_routes
from backend.app.utils.security import SecurityUtils

# Create database tables if they do not exist (wrapped in try-except for startup resilience)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"CRITICAL: Database initialization failed on startup: {str(e)}")
    print("Continuing server startup in degraded/offline database mode.")

# Run database migrations for is_admin column (adds column if missing from existing deploys)
try:
    from backend.app.database import SessionLocal
    from sqlalchemy import text
    db_session = SessionLocal()
    try:
        # Check if is_admin column exists
        db_session.execute(text("SELECT is_admin FROM users LIMIT 1"))
    except Exception:
        db_session.rollback()
        print("Migration: 'is_admin' column is missing in 'users' table. Altering table...")
        dialect = engine.url.drivername
        if "sqlite" in dialect:
            db_session.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
        else:
            db_session.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))
        db_session.commit()
        print("Migration completed: 'is_admin' column added to 'users' table.")
    db_session.close()
except Exception as mig_err:
    print(f"Error executing database migrations: {str(mig_err)}")

# Seed default admin user
try:
    from backend.app.database import SessionLocal
    from backend.app.models import User
    from backend.app.auth import get_password_hash
    db_session = SessionLocal()
    admin_username = os.environ.get("ADMIN_USERNAME", "Shanumer@admin1204")
    admin_exists = db_session.query(User).filter(User.username == admin_username).first()
    if not admin_exists:
        admin_password = os.environ.get("ADMIN_PASSWORD", "Shanum@Aetheris#2026")
        new_admin = User(
            username=admin_username,
            hashed_password=get_password_hash(admin_password),
            is_admin=True
        )
        db_session.add(new_admin)
        db_session.commit()
        print(f"Stealth admin user '{admin_username}' seeded successfully.")
    else:
        if not admin_exists.is_admin:
            admin_exists.is_admin = True
            db_session.commit()
            print(f"Existing user '{admin_username}' promoted to administrator.")
    db_session.close()
except Exception as seed_err:
    print(f"Error seeding default admin account: {str(seed_err)}")

app = FastAPI(
    title="AI Chatbot Assistant API",
    description="Backend API supporting authentication, chat history, document uploads and voice integrations.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing) with production-ready origins
allowed_origins = ["*"]
origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if origins_env:
    allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if allowed_origins != ["*"] else False,
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

# Ensure static directories exist
os.makedirs("frontend/static", exist_ok=True)

# Serve Static Files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Serve dynamic config.js locally
from fastapi.responses import FileResponse
@app.get("/config.js")
def get_config_js():
    return FileResponse("frontend/config.js")

# Templates setup (serve SPA from frontend root)
templates = Jinja2Templates(directory="frontend")

# Frontend routes (serve Single Page Application)
@app.get("/", response_class=HTMLResponse)
def serve_spa(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# Health Check & Ping endpoints
@app.get("/health")
def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "environment": "production"}

@app.get("/api/ping")
def ping():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Register Backend Routers
app.include_router(auth_routes.router)
app.include_router(chat_routes.router)
app.include_router(document_routes.router)
app.include_router(settings_routes.router)
app.include_router(voice_routes.router)
app.include_router(admin_routes.router)

# Custom Global Error Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please contact the administrator."}
    )

if __name__ == "__main__":
    import uvicorn
    import os
    port_env = os.environ.get("PORT", "8000")
    try:
        port = int(port_env)
    except ValueError:
        # Fallback if port_env contains literal '$PORT' or invalid string
        port = 8000
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port)
