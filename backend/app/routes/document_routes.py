import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, ChatSession, Document
from backend.app.schemas import DocumentResponse
from backend.app.auth import get_current_user
from backend.app.utils.security import SecurityUtils
from backend.app.services.rag_service import RAGService
from backend.app.config import settings

router = APIRouter(prefix="/api/chats/{session_id}/documents", tags=["Documents"])

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    session_id: str,
    file: UploadFile = File(...),
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    # Read file size to validate
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0) # reset position

    # Validate file size & extension, return safe name
    safe_filename = SecurityUtils.validate_file(file.filename, file_size)

    # Define upload path
    session_upload_dir = os.path.join(settings.UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)
    file_path = os.path.join(session_upload_dir, safe_filename)

    # Save to disk
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file to disk: {str(e)}"
        )

    # Determine file type extension
    file_type = safe_filename.split(".")[-1].lower()

    # Create document db entry
    doc = Document(
        session_id=session_id,
        filename=safe_filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Index the document for RAG
    try:
        RAGService.process_and_index_document(
            file_path=file_path,
            file_type=file_type,
            filename=safe_filename,
            session_id=session_id,
            user_key=x_openai_key
        )
    except Exception as e:
        # If indexing fails, delete DB record and file, then raise error
        db.delete(doc)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to index document: {str(e)}"
        )

    return doc


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    return session.documents


@router.get("/{document_id}/download")
def download_document(
    session_id: str,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    # Find document
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.session_id == session_id
    ).first()

    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found on server.")

    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type="application/octet-stream"
    )


@router.delete("/{document_id}")
def delete_document(
    session_id: str,
    document_id: int,
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    # Find document
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.session_id == session_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove file from disk if exists
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Error deleting file {doc.file_path} from disk: {str(e)}")

    # Remove database record
    db.delete(doc)
    db.commit()

    # Rebuild vector index from scratch using remaining documents
    RAGService.delete_session_index(session_id)
    
    remaining_docs = db.query(Document).filter(Document.session_id == session_id).all()
    for d in remaining_docs:
        if os.path.exists(d.file_path):
            try:
                RAGService.process_and_index_document(
                    file_path=d.file_path,
                    file_type=d.file_type,
                    filename=d.filename,
                    session_id=session_id,
                    user_key=x_openai_key
                )
            except Exception as e:
                print(f"Re-indexing failed for {d.filename} during document deletion: {str(e)}")

    return {"detail": "Document deleted and index rebuilt successfully."}
