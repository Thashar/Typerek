import httpx
from core.config import settings


def send_email(to: str, subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY nie jest ustawiony")

    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={"from": settings.RESEND_FROM, "to": [to], "subject": subject, "html": html},
        timeout=10,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend API error {resp.status_code}: {resp.text}")


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
