import asyncio
import json
import httpx
from openai import AsyncOpenAI
from backend.app.config import settings

class LLMService:
    # Client cache to enable connection pooling and eliminate TLS handshake latency
    _client_cache = {}

    @classmethod
    async def get_client(cls, user_key: str = None) -> AsyncOpenAI:
        # Use user-supplied key, or fall back to OpenAI / Groq keys in .env
        api_key = user_key or settings.OPENAI_API_KEY or settings.GROQ_API_KEY
        if not api_key:
            return None
        
        api_key_stripped = api_key.strip()
        if api_key_stripped in cls._client_cache:
            return cls._client_cache[api_key_stripped]
        
        # If it's a Groq key, route to Groq's endpoint
        if api_key_stripped.startswith("gsk_"):
            client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
                http_client=httpx.AsyncClient(verify=False)
            )
        else:
            client = AsyncOpenAI(
                api_key=api_key,
                http_client=httpx.AsyncClient(verify=False)
            )
            
        cls._client_cache[api_key_stripped] = client
        return client

    @classmethod
    async def stream_chat_response(
        cls, 
        messages: list, 
        user_key: str = None, 
        model: str = "gpt-4o", 
        temperature: float = 0.7, 
        max_tokens: int = 1000
    ):
        client = await cls.get_client(user_key)

        # Demo mode if client couldn't be initialized due to missing key
        if not client:
            demo_text = (
                "Hello! I am currently running in **Demo Mode** because no OpenAI or Groq API key has been configured. "
                "To get fully functional answers, please open the **Settings** panel (top right gear icon) and input your OpenAI or Groq API Key, "
                "or write it to the `.env` file on the server.\n\n"
                "Here are some interactive features you can explore right now:\n"
                "- **🎤 Voice Mode**: Click the mic icon, speak, and watch it transcribe.\n"
                "- **🔊 Text-to-Speech**: Listen to this message by clicking the speaker icon next to my response!\n"
                "- **📁 Document Upload**: Drag and drop or browse files (PDF, DOCX, CSV, Excel, TXT, MD) to parse them into our vector database.\n"
                "- **💬 Chat Management**: Create, rename, delete, search, and export chats using the left sidebar."
            )
            # Yield in small chunks to simulate typing
            words = demo_text.split(" ")
            for i in range(len(words)):
                chunk = (words[i] + " ") if i < len(words) - 1 else words[i]
                yield f"data: {json.dumps({'content': chunk})}\n\n"
                await asyncio.sleep(0.04)
            yield "data: [DONE]\n\n"
            return

        # Auto map OpenAI models to Groq models if Groq key is used
        api_key = user_key or settings.OPENAI_API_KEY or settings.GROQ_API_KEY
        if api_key and api_key.strip().startswith("gsk_"):
            if model in ["gpt-4o", "gpt-4-turbo"]:
                model = "llama-3.3-70b-versatile"
            elif model == "gpt-3.5-turbo":
                model = "llama-3.1-8b-instant"

        try:
            # Call completion stream (both OpenAI and Groq share standard API structure)
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )

            async for chunk in response:
                if len(chunk.choices) > 0:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_msg = f"Error communicating with AI service: {str(e)}"
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            yield "data: [DONE]\n\n"

    @classmethod
    async def generate_title(cls, user_message: str, user_key: str = None) -> str:
        client = await cls.get_client(user_key)
        if not client:
            # Fallback local naming
            words = user_message.split()
            title = " ".join(words[:4])
            if len(words) > 4:
                title += "..."
            return title

        api_key = user_key or settings.OPENAI_API_KEY or settings.GROQ_API_KEY
        model = "gpt-3.5-turbo"
        if api_key and api_key.strip().startswith("gsk_"):
            model = "llama-3.1-8b-instant"

        try:
            prompt = (
                "Generate a short, concise topic title (2 to 4 words max) "
                "summarizing the following user query. Do not include any quotes, "
                "prefixes like 'Title:', or markdown styling. Keep it professional.\n\n"
                f"Query: {user_message}"
            )
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=15,
                temperature=0.5
            )
            title = response.choices[0].message.content.strip()
            return title
        except Exception:
            # Fallback
            words = user_message.split()
            title = " ".join(words[:4])
            if len(words) > 4:
                title += "..."
            return title
