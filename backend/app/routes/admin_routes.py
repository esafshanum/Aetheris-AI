import os
import shutil
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import User, ChatSession, Message, Document
from backend.app.auth import get_current_user
from backend.app.config import settings

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# Admin dependency helper
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrator privileges required."
        )
    return current_user

@router.get("/stats", response_model=Dict[str, Any])
def get_system_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    total_users = db.query(User).count()
    total_sessions = db.query(ChatSession).count()
    total_messages = db.query(Message).count()
    
    # Calculate total size of files uploaded
    total_files_size = db.query(func.sum(Document.file_size)).scalar() or 0
    total_files_count = db.query(Document).count()
    
    return {
        "total_users": total_users,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "total_files_count": total_files_count,
        "total_files_size_bytes": total_files_size
    }

@router.get("/users", response_model=List[Dict[str, Any]])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    users = db.query(User).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "is_admin": u.is_admin,
            "created_at": u.created_at
        })
    return result

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    # Prevent self-deletion
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Clean up files on disk for all user sessions
    for session in user.sessions:
        session_upload_dir = os.path.join(settings.UPLOAD_DIR, session.id)
        if os.path.exists(session_upload_dir):
            try:
                shutil.rmtree(session_upload_dir)
            except Exception as e:
                print(f"Error cleaning up user files at {session_upload_dir}: {str(e)}")
                
    # Cascade deletion in DB (relationships are set with cascade="all, delete-orphan")
    db.delete(user)
    db.commit()
    return {"detail": "User and all associated data deleted successfully."}
