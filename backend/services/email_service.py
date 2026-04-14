import smtplib
from email.message import EmailMessage
from typing import Optional
import io
import logging

from config import settings

logger = logging.getLogger(__name__)

def send_certificate_email(recipient_email: str, pdf_bytes: io.BytesIO, filename: str) -> bool:
    """
    Sends an email with the generated certificate attached as a PDF.
    Gracefully logs a warning and returns False if SMTP is incorrectly configured.
    """
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning(
            f"SMTP Config missing. Skipped sending certificate email to {recipient_email}. "
            f"To enable, set SMTP_USERNAME and SMTP_PASSWORD in your .env file."
        )
        return False

    msg = EmailMessage()
    msg['Subject'] = "Quiz Completion Certificate"
    msg['From'] = settings.SMTP_USERNAME
    msg['To'] = recipient_email

    body = (
        "Congratulations!\n\n"
        "You have successfully completed the quiz.\n"
        "Please find your certificate attached.\n\n"
        "Best regards,\n"
        "Quiz Platform Team"
    )
    msg.set_content(body)

    # Attach the PDF
    pdf_bytes.seek(0)
    msg.add_attachment(
        pdf_bytes.read(),
        maintype='application',
        subtype='pdf',
        filename=filename
    )

    try:
        # Determine if we should use SSL directly or STARTTLS
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logger.info(f"Successfully sent certificate email to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}. Error: {e}")
        return False
