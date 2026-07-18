from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.app.config import settings

# Normalize and auto-encode credentials in connection URIs (handles passwords with @ or # symbols)
import urllib.parse

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://") or db_url.startswith("postgresql://"):
    prefix, remainder = db_url.split("://", 1)
    if "@" in remainder:
        # Split by the last '@' to separate credentials from host
        credentials, host_part = remainder.rsplit("@", 1)
        
        # Self-healing: if host is direct db.xxx.supabase.co (IPv6), rewrite to pooler host (IPv4)
        # db.hkiqwefjeugeukxnngal.supabase.co -> aws-0-ap-southeast-1.pooler.supabase.com:6543
        if "supabase.co" in host_part and not "pooler.supabase.co" in host_part:
            host_clean = host_part.split(":")[0].split("/")[0]
            if host_clean.startswith("db."):
                project_id = host_clean.split(".")[1]
                region = "ap-southeast-1" # Southeast Asia (Singapore)
                db_and_query = "/postgres?sslmode=require"
                if "/" in host_part:
                    db_and_query = "/" + host_part.split("/", 1)[1]
                host_part = f"aws-0-{region}.pooler.supabase.com:6543{db_and_query}"
        
        if ":" in credentials:
            user, password = credentials.split(":", 1)
            # URL encode username and password to prevent connection parsing errors
            user_encoded = urllib.parse.quote_plus(user)
            password_encoded = urllib.parse.quote_plus(password)
            db_url = f"postgresql://{user_encoded}:{password_encoded}@{host_part}"
        else:
            db_url = f"postgresql://{remainder}"
    else:
        db_url = f"postgresql://{remainder}"

# For SQLite, we require connect_args={"check_same_thread": False}
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
