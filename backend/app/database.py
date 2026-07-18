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
