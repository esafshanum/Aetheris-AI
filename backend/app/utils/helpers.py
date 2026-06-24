from fpdf import FPDF
from datetime import datetime
from typing import List, Any

class ChatPDF(FPDF):
    def header(self):
        # Header title
        self.set_font('helvetica', 'B', 14)
        self.cell(0, 10, 'AI Chatbot Assistant - Chat History', border=False, align='C')
        self.ln(12)
        
    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        # Page number
        self.cell(0, 10, f'Page {self.page_no()}', border=False, align='C')

class ExportHelpers:
    @staticmethod
    def export_to_text(chat_title: str, messages: List[Any]) -> str:
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        lines = [
            "==================================================",
            f"CHAT HISTORY EXPORT",
            f"Session Title: {chat_title}",
            f"Exported At: {timestamp}",
            "==================================================",
            "\n"
        ]

        for msg in messages:
            sender_label = "USER" if msg.sender == "user" else "AI ASSISTANT"
            msg_time = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            lines.append(f"[{sender_label}] ({msg_time}):")
            lines.append(msg.content)
            lines.append("-" * 50)
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def export_to_pdf(chat_title: str, messages: List[Any]) -> bytes:
        pdf = ChatPDF()
        pdf.add_page()
        pdf.set_font("helvetica", "B", 12)
        
        # Topic
        pdf.cell(0, 8, f"Topic: {chat_title}", border="B", ln=True)
        pdf.ln(5)
        
        for msg in messages:
            sender_label = "User" if msg.sender == "user" else "AI Assistant"
            msg_time = msg.timestamp.strftime("%Y-%m-%d %H:%M")
            
            # Print Speaker Header
            pdf.set_font("helvetica", "B", 10)
            if msg.sender == "user":
                pdf.set_text_color(26, 115, 232)  # Blue for user
            else:
                pdf.set_text_color(16, 124, 65)   # Green for AI
                
            pdf.cell(0, 6, f"{sender_label} ({msg_time})", ln=True)
            
            # Print Message Content
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("helvetica", "", 10)
            
            # Replace characters that are outside latin-1 to avoid fpdf errors
            content_cleaned = msg.content.encode("latin-1", "replace").decode("latin-1")
            
            # Use multi_cell to handle wrapping text
            pdf.multi_cell(0, 5, content_cleaned)
            pdf.ln(4)
            
        return bytes(pdf.output())
