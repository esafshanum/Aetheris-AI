import re
import html
import time
from typing import Dict, List
from fastapi import HTTPException, Request, status

# Allowed file extensions
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "csv", "xlsx", "xls", "md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Simple in-memory rate limiting dictionary: { ip: [timestamps] }
_rate_limit_records: Dict[str, List[float]] = {}
RATE_LIMIT_MAX_REQUESTS = 100  # requests
RATE_LIMIT_WINDOW = 60  # seconds

class SecurityUtils:
    @staticmethod
    def sanitize_input(text: str) -> str:
        if not text:
            return ""
        # Basic HTML escaping to prevent XSS
        return html.escape(text.strip())

    @staticmethod
    def validate_file(filename: str, file_size: int) -> str:
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is missing."
            )
            
        parts = filename.split(".")
        if len(parts) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File has no extension."
            )
            
        ext = parts[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '.{ext}' is not supported. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
            )

        # Make filename safe: replace whitespace and symbols with underscores
        safe_base = re.sub(r"[^\w\-_.]", "_", ".".join(parts[:-1]))
        return f"{safe_base}.{ext}"

    @staticmethod
    def sanitize_prompt(prompt: str) -> str:
        # Prevent prompt injection by adding explicit system-level isolation rules in the router,
        # but here we can strip out potential jailbreak prefixes
        sanitized = re.sub(r"(?i)(ignore previous instructions|system bypass|jailbreak)", "", prompt)
        return sanitized.strip()

    @staticmethod
    def check_rate_limit(request: Request):
        client_ip = request.client.host if request.client else "unknown_ip"
        now = time.time()

        # Clean old timestamps outside the window
        if client_ip in _rate_limit_records:
            _rate_limit_records[client_ip] = [
                t for t in _rate_limit_records[client_ip] if now - t < RATE_LIMIT_WINDOW
            ]
        else:
            _rate_limit_records[client_ip] = []

        # Check limit
        if len(_rate_limit_records[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Too many requests. Please try again after a minute."
            )

        # Log timestamp
        _rate_limit_records[client_ip].append(now)
