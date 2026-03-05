"""
Gmail email sender using SMTP with App Password.

Setup:
1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password for "Mail"
4. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import Config

logger = logging.getLogger("email_sender")

GMAIL_HOST = "smtp.gmail.com"
GMAIL_PORT = 587


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Send an email via Gmail SMTP. Returns True on success."""
    user = Config.GMAIL_USER
    password = Config.GMAIL_APP_PASSWORD

    if not user or not password:
        logger.error("GMAIL_USER or GMAIL_APP_PASSWORD not set — email not sent")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Labs21 CEO <{user}>"
    msg["To"] = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(GMAIL_HOST, GMAIL_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(user, to, msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except smtplib.SMTPException as e:
        logger.error(f"Failed to send email: {e}")
        return False


def build_html_report(
    report_type: str,
    date_str: str,
    agent_name: str,
    content: str,
    questions: list[dict],
) -> str:
    """Build a clean HTML email for the CEO report."""

    type_labels = {"daily": "Daily Briefing", "weekly": "Weekly Recap", "monthly": "Monthly Board Meeting"}
    label = type_labels.get(report_type, "Report")

    accent = "#6366f1"
    bg = "#0f172a"
    surface = "#1e293b"
    text = "#e2e8f0"
    muted = "#94a3b8"

    questions_html = ""
    if questions:
        items = "".join(
            f'<li style="margin: 8px 0; color: {text}; font-size: 14px;">{q["q"]}</li>'
            for q in questions
        )
        questions_html = f"""
        <div style="margin: 24px 0; padding: 20px; background: {surface}; border-left: 3px solid {accent}; border-radius: 4px;">
            <h3 style="margin: 0 0 12px; color: {accent}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Questions for You</h3>
            <ol style="margin: 0; padding-left: 20px;">{items}</ol>
        </div>"""

    content_html = content.replace("\n\n", "</p><p>").replace("\n", "<br>")
    content_html = f"<p>{content_html}</p>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{label}</title>
</head>
<body style="margin: 0; padding: 0; background-color: {bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: {bg}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width: 620px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: {surface}; border-radius: 12px 12px 0 0; padding: 28px 32px; border-bottom: 1px solid #334155;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background: {accent}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">{label}</div>
                    <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">Labs21 {label}</h1>
                    <p style="margin: 4px 0 0; color: {muted}; font-size: 14px;">{date_str} · From {agent_name}</p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="width: 48px; height: 48px; background: {accent}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-weight: 800; font-size: 14px;">L21</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background: {surface}; padding: 28px 32px; border-radius: 0 0 12px 12px; color: {text}; font-size: 15px; line-height: 1.7;">
              {content_html}
              {questions_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 0 0; text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 12px;">
                Labs21 AI Operations · <a href="https://labs21.xyz/admin/briefings" style="color: {accent}; text-decoration: none;">View in portal</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
