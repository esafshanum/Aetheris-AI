import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db, SessionLocal
from backend.app.models import User, ChatSession, Message, Document
from backend.app.schemas import (
    ChatSessionCreate, 
    ChatSessionResponse, 
    ChatSessionDetailResponse, 
    ChatSessionUpdate,
    MessageCreate,
    MessageResponse
)
from backend.app.auth import get_current_user
from backend.app.services.llm_service import LLMService
from backend.app.services.rag_service import RAGService
from backend.app.utils.security import SecurityUtils
from backend.app.utils.helpers import ExportHelpers

router = APIRouter(prefix="/api/chats", tags=["Chats"])

@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatSessionCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    session = ChatSession(
        user_id=current_user.id,
        title=payload.title or "New Conversation"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("", response_model=List[ChatSessionResponse])
def list_chat_sessions(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    return db.query(ChatSession)\
        .filter(ChatSession.user_id == current_user.id)\
        .order_by(ChatSession.updated_at.desc())\
        .all()

@router.get("/search", response_model=List[ChatSessionResponse])
def search_chats(
    q: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if not q:
        return []
    
    # Clean and sanitize search query
    clean_query = SecurityUtils.sanitize_input(q)
    
    # Find chats where title matches, or message content matches
    sessions = db.query(ChatSession)\
        .join(Message, Message.session_id == ChatSession.id, isouter=True)\
        .filter(ChatSession.user_id == current_user.id)\
        .filter(
            (ChatSession.title.ilike(f"%{clean_query}%")) | 
            (Message.content.ilike(f"%{clean_query}%"))
        )\
        .distinct()\
        .order_by(ChatSession.updated_at.desc())\
        .all()
        
    return sessions

@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
def get_chat_session(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session

@router.put("/{session_id}", response_model=ChatSessionResponse)
def rename_chat_session(
    session_id: str, 
    payload: ChatSessionUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
        
    session.title = SecurityUtils.sanitize_input(payload.title)
    db.commit()
    db.refresh(session)
    return session

@router.delete("/{session_id}")
def delete_chat_session(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
        
    # Delete database record
    db.delete(session)
    db.commit()
    
    # Delete vectors index folder
    RAGService.delete_session_index(session_id)
    
    return {"detail": "Chat session deleted successfully."}


@router.post("/{session_id}/messages")
async def send_message(
    session_id: str,
    payload: MessageCreate,
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_model: Optional[str] = Header("gpt-4o", alias="X-Model"),
    x_temperature: Optional[float] = Header(0.7, alias="X-Temperature"),
    x_max_tokens: Optional[int] = Header(1000, alias="X-Max-Tokens"),
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

    # Sanitize user input
    sanitized_content = SecurityUtils.sanitize_prompt(payload.content)
    if not sanitized_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Save User Message to DB
    user_msg = Message(
        session_id=session_id,
        sender="user",
        content=sanitized_content,
        timestamp=datetime.utcnow()
    )
    db.add(user_msg)
    
    # Update chat updated_at timestamp
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user_msg)

    # 2. Retrieve Document Context (RAG)
    # Check if session has uploaded documents
    has_docs = db.query(Document).filter(Document.session_id == session_id).count() > 0
    context_str = ""
    if has_docs:
        retrieved_chunks = RAGService.query_vector_store(
            query=sanitized_content,
            session_id=session_id,
            user_key=x_openai_key,
            k=4
        )
        if retrieved_chunks:
            context_blocks = []
            for c in retrieved_chunks:
                context_blocks.append(f"[Source: {c['source']} (Chunk #{c['chunk_index']})]\n{c['text']}")
            context_str = "\n\n".join(context_blocks)

    # 3. Compile Recent Chat History (e.g., last 10 messages)
    history_messages = db.query(Message)\
        .filter(Message.session_id == session_id)\
        .order_by(Message.timestamp.desc())\
        .limit(10)\
        .all()
    history_messages.reverse() # Restore chronological order

    system_instruction = (
        "You are a helpful, professional, and friendly AI chatbot assistant.\n"
        "Format your responses nicely in Markdown. Use lists, tables, headers, and code highlighting where appropriate.\n"
        "To satisfy user requests for images, you have two options depending on their intent:\n"
        "1. **AI Image Generation (ChatGPT-style)**: If the user explicitly asks to 'generate', 'create', 'draw', 'paint', or 'make' a new image, diagram, flowchart, or concept, you MUST embed a Markdown image pointing to Pollinations AI: `![Generated Image](https://image.pollinations.ai/prompt/[URL_ENCODED_PROMPT]?width=768&height=768&nologo=true&model=turbo)` where `[URL_ENCODED_PROMPT]` is a detailed description (replace spaces with `%20`).\n"
        "2. **Real-world Photo Fetching (Google/Flickr-style)**: If the user asks to 'show photos of', 'search images of', or 'fetch images of' real-world food, objects, places, animals, or landmarks (e.g., 'image of tiramisu', 'photo of Eiffel Tower'), you MUST embed a Markdown image pointing to Lorem Flickr: `![Photo of [QUERY]](https://loremflickr.com/800/600/[URL_ENCODED_QUERY])` where `[URL_ENCODED_QUERY]` is the search term (replace spaces with `%20`). This fetches a real high-quality photo of the subject dynamically.\n"
    )
    
    if context_str:
        system_instruction += (
            "\n[CRITICAL DOCUMENT CONTEXT]\n"
            "The user has uploaded documents for this conversation. Below is the most relevant retrieved information. "
            "Use this context to formulate your response. When referencing it, explicitly mention the file source "
            "so the user knows which document the info comes from. If the context does not contain the answer, "
            "rely on your knowledge but note that the documents do not specify the details.\n\n"
            f"{context_str}\n"
        )
        
    prompt_messages = [{"role": "system", "content": system_instruction}]
    for msg in history_messages[:-1]: # exclude the one we just inserted to add separately
        prompt_messages.append({
            "role": "user" if msg.sender == "user" else "assistant",
            "content": msg.content
        })
        
    # Append the fresh user message
    prompt_messages.append({"role": "user", "content": sanitized_content})

    # 5. Define SSE Generator
    async def sse_generator():
        # Open separate thread-safe session connection
        local_db = SessionLocal()
        try:
            accumulated_response = ""
            async for chunk in LLMService.stream_chat_response(
                messages=prompt_messages,
                user_key=x_openai_key,
                model=x_model,
                temperature=x_temperature,
                max_tokens=x_max_tokens
            ):
                yield chunk
                
                # Extract text for DB compilation
                if chunk.startswith("data: ") and not "[DONE]" in chunk:
                    try:
                        data = json.loads(chunk[6:].strip())
                        if "content" in data:
                            accumulated_response += data["content"]
                        elif "error" in data:
                            accumulated_response += f"\n[{data['error']}]"
                    except Exception:
                        pass
            
            # Save final response from assistant
            if accumulated_response.strip():
                ai_msg = Message(
                    session_id=session_id,
                    sender="ai",
                    content=accumulated_response,
                    timestamp=datetime.utcnow()
                )
                local_db.add(ai_msg)
                
                # Fetch session to check title rename
                local_session = local_db.query(ChatSession).filter(ChatSession.id == session_id).first()
                if local_session:
                    local_session.updated_at = datetime.utcnow()
                    
                    # Auto rename default titled sessions after the first exchange
                    num_msgs = local_db.query(Message).filter(Message.session_id == session_id).count()
                    if local_session.title == "New Conversation" and num_msgs <= 2:
                        title_suggestion = await LLMService.generate_title(sanitized_content, x_openai_key)
                        local_session.title = title_suggestion
                
                local_db.commit()
        except Exception as e:
            print(f"Error in SSE stream generation: {str(e)}")
        finally:
            local_db.close()

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.get("/{session_id}/export/{format_type}")
def export_chat(
    session_id: str,
    format_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
        
    messages = db.query(Message)\
        .filter(Message.session_id == session_id)\
        .order_by(Message.timestamp.asc())\
        .all()
        
    format_type = format_type.lower()
    
    if format_type == "txt":
        text_content = ExportHelpers.export_to_text(session.title, messages)
        filename = f"chat_export_{session_id}.txt"
        return Response(
            content=text_content,
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    elif format_type == "pdf":
        pdf_bytes = ExportHelpers.export_to_pdf(session.title, messages)
        filename = f"chat_export_{session_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    elif format_type == "docx":
        docx_bytes = ExportHelpers.export_to_docx(session.title, messages)
        filename = f"chat_export_{session_id}.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Choose 'txt', 'pdf' or 'docx'.")
