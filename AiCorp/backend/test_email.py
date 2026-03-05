"""
Quick email test — no LLM or DB required.
Run: python test_email.py
"""
from dotenv import load_dotenv
load_dotenv()

from config import Config
from email_sender import send_email, build_html_report

def main():
    print(f"GMAIL_USER:      {Config.GMAIL_USER}")
    print(f"CEO_EMAIL_TO:    {Config.CEO_EMAIL_TO}")
    print(f"APP_PASSWORD:    {'*' * len(Config.GMAIL_APP_PASSWORD or '')} ({len(Config.GMAIL_APP_PASSWORD or '')} chars)")
    print()

    if not Config.GMAIL_USER or not Config.GMAIL_APP_PASSWORD:
        print("ERROR: GMAIL_USER or GMAIL_APP_PASSWORD not set in .env")
        return

    if not Config.CEO_EMAIL_TO:
        print("ERROR: CEO_EMAIL_TO not set in .env")
        return

    if len(Config.GMAIL_APP_PASSWORD) != 16:
        print(f"WARNING: App Password is {len(Config.GMAIL_APP_PASSWORD)} chars — should be 16.")
        print("  Get one at: https://myaccount.google.com/apppasswords")
        print("  Select 'Mail', copy the 16-char password WITHOUT spaces.")
        print()

    html = build_html_report(
        report_type="daily",
        date_str="March 5, 2026",
        agent_name="CEO",
        content="""## Executive Summary
This is a test email from your Labs21 CEO agent. If you are reading this, Gmail SMTP is working correctly.

## Key Highlights
- Email delivery confirmed
- HTML formatting looks correct
- Labs21 admin portal is operational

## Recommendations
No action required — this is a test. The CEO will begin sending real daily briefings once AI model keys are configured.""",
        questions=[
            {"q": "Is the email formatting readable on your device?"},
            {"q": "Does the Labs21 branding look correct?"},
        ],
    )

    print(f"Sending test email to {Config.CEO_EMAIL_TO}...")
    ok = send_email(
        to=Config.CEO_EMAIL_TO,
        subject="[Labs21 TEST] CEO Email Connection — March 5, 2026",
        html_body=html,
    )

    if ok:
        print("SUCCESS — check your inbox!")
    else:
        print("FAILED — see error above.")
        print()
        print("Common fixes:")
        print("  1. App Password must be exactly 16 lowercase letters (no spaces, no special chars)")
        print("     → https://myaccount.google.com/apppasswords")
        print("  2. If using a custom domain (e.g. ceo@labs21.xyz), it must be a Google Workspace account")
        print("     OR use a regular Gmail address (yourname@gmail.com)")
        print("  3. Make sure 2FA is enabled on the Google account")

if __name__ == "__main__":
    main()
