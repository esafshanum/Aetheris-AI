from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

# --- Authentication Schemas ---

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    is_admin: bool
    created_at: datetime

class TokenData(BaseModel):
    username: Optional[str] = None


# --- Message Schemas ---

class MessageBase(BaseModel):
    sender: str
    content: str

class MessageCreate(BaseModel):
    content: str

class MessageResponse(MessageBase):
    id: int
    session_id: str
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Document Schemas ---

class DocumentResponse(BaseModel):
    id: int
    session_id: str
    filename: str
    file_type: str
    file_size: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


# --- Chat Session Schemas ---

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ChatSessionUpdate(BaseModel):
    title: str

class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatSessionDetailResponse(ChatSessionResponse):
    messages: List[MessageResponse] = []
    documents: List[DocumentResponse] = []


# --- User Settings Schemas ---

class SettingsResponse(BaseModel):
    has_api_key: bool
    has_sarvam_key: bool = False

class UserSettingsUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000
    model: Optional[str] = "gpt-4o"
