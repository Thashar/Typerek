import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings


def send_email(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], to, msg.as_string())


def send_reset_email(to: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#22c55e">⚽ Typerek — reset hasła</h2>
      <p>Kliknij poniższy link, aby ustawić nowe hasło. Link wygasa po 15 minutach.</p>
      <a href="{link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
        Resetuj hasło
      </a>
      <p style="color:#9ca3af;font-size:13px">Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość.</p>
    </div>
    """
    send_email(to, "Typerek — reset hasła", html)
