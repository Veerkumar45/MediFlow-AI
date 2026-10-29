#!/usr/bin/env python3
"""
Records the MediFlow AI assessment demo as a 1920x1080 video with on-screen captions.

Usage (from the project root):
    pip install playwright && playwright install chromium
    npm install && npm run build
    # optional: put your key in .env so the video shows REAL Gemini answers
    #   GEMINI_API_KEY="..."
    python demo/record_demo.py

Output: demo/output/mediflow-demo.mp4  (needs ffmpeg for the mp4 conversion; the raw .webm is kept too)

The script starts the app itself (production mode, clean database), drives the real UI like a user
would, and asks /api/ai/status which AI engine is active so the captions stay truthful:
with GEMINI_API_KEY set, every AI step is served by Google Gemini; without it the app runs its
offline grounded engine and the video says so.
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "demo" / "output"
PORT = int(os.environ.get("DEMO_PORT", "3200"))
BASE = f"http://localhost:{PORT}"
W, H = 1920, 1080


# --------------------------------------------------------------------------- helpers
def api(path, data=None, method=None):
    req = urllib.request.Request(
        BASE + "/api" + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
        method=method or ("POST" if data is not None else "GET"),
    )
    with urllib.request.urlopen(req, timeout=60) as f:
        return json.load(f)


def start_server():
    try:
        api("/ai/status")
        return None  # already running
    except Exception:
        pass
    env = dict(os.environ, NODE_ENV="production", PORT=str(PORT))
    proc = subprocess.Popen(["npx", "tsx", "server.ts"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            api("/ai/status")
            return proc
        except Exception:
            time.sleep(0.5)
    proc.kill()
    sys.exit("Server did not start. Run `npm install && npm run build` first.")


CAPTION_JS = r"""
(() => {
  const boot = () => {
  if (window.__capInstalled) return; window.__capInstalled = true;
  const css = document.createElement('style');
  css.textContent = `
  #__cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483647;max-width:1060px;width:max-content;
    background:rgba(10,25,47,.94);color:#fff;border-radius:16px;padding:18px 30px;font:500 27px/1.35 Inter,system-ui,sans-serif;
    box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(45,212,191,.45);display:none;text-align:center}
  #__cap b{color:#5eead4;display:block;font-size:19px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
  #__card{position:fixed;inset:0;z-index:2147483646;background:linear-gradient(135deg,#0a192f,#12325c);color:#fff;display:none;
    align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}
  #__card .in{max-width:1400px;padding:60px}
  #__card h1{font-size:68px;margin:0 0 18px;letter-spacing:-.02em} #__card h2{font-size:30px;font-weight:500;color:#99f6e4;margin:0 0 28px}
  #__card p,#__card li{font-size:27px;line-height:1.5;color:#e2e8f0} #__card ul{padding-left:30px}
  #__card .tag{display:inline-block;background:#134e4a;border:1px solid #2dd4bf;color:#99f6e4;border-radius:999px;padding:6px 18px;font-size:22px;margin-top:20px}
  `;
  document.documentElement.appendChild(css);
  const cap = document.createElement('div'); cap.id='__cap';
  const card = document.createElement('div'); card.id='__card';
  document.body.appendChild(cap); document.body.appendChild(card);
  window.__cap = (title, text) => { cap.innerHTML = '<b>'+title+'</b>'+text; cap.style.display = text||title ? 'block':'none'; };
  window.__capHide = () => { cap.style.display='none'; };
  window.__card = (html) => { card.innerHTML = '<div class="in">'+html+'</div>'; card.style.display = html ? 'flex':'none'; };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.webm"):
        f.unlink()
    server = start_server()
    api("/reset-data", {})  # always start from a completely clean clinic
    status = api("/ai/status")
    live = status["configured"]
    engine_line = (
        f"Google Gemini ({status['model']}) with function calling"
        if live
        else "the offline grounded engine (no GEMINI_API_KEY in this recording environment)"
    )

    # Pick a date on which the dermatologist (Tue/Wed/Thu/Sat) works so the demo is repeatable.
    today = dt.date.today()
    target, phrase = None, None
    for i in range(1, 9):
        d = today + dt.timedelta(days=i)
        if d.weekday() in (1, 2, 3, 5):  # Tue, Wed, Thu, Sat
            target = d
            phrase = "tomorrow" if i == 1 else d.strftime("%A")
            break

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-device-scale-factor=1"])
        ctx = browser.new_context(
            viewport={"width": W, "height": H},
            record_video_dir=str(OUT),
            record_video_size={"width": W, "height": H},
            locale="en-US",
        )
        ctx.add_init_script(CAPTION_JS)
        page = ctx.new_page()

        def say(title, text, secs=None):
            page.evaluate("([t,x]) => window.__cap && window.__cap(t,x)", [title, text])
            page.wait_for_timeout(int(1000 * (secs if secs is not None else max(3.0, len(text.split()) / 2.7))))

        def hide():
            page.evaluate("() => window.__capHide && window.__capHide()")

        def card(html, secs):
            page.evaluate("(h) => window.__card && window.__card(h)", html)
            page.wait_for_timeout(int(secs * 1000))
            page.evaluate("() => window.__card && window.__card('')")

        def nav(label):
            page.locator("aside").get_by_role("button", name=re.compile(rf"^{label}$")).first.click()
            page.wait_for_timeout(1200)

        def ask(text):
            box = page.get_by_test_id("assistant-input")
            box.click()
            box.type(text, delay=38)
            page.wait_for_timeout(500)
            box.press("Enter")
            page.wait_for_timeout(600)
            page.wait_for_selector("text=Checking the live schedule", state="detached", timeout=90000)
            page.wait_for_timeout(2500)

        # ------------------------------------------------------------------ 0. intro
        page.goto(BASE)
        page.wait_for_selector("text=Select Your Portal to Continue")
        card(
            "<h1>MediFlow AI</h1><h2>Smarter Clinics. Seamless Care.</h2>"
            "<p>An AI front desk and operations dashboard for outpatient clinics.</p>"
            "<ul><li>Problem: front desks lose hours to slot-hunting, phone tag, triage and daily reporting.</li>"
            "<li>Solution: an assistant that checks the live calendar, books with patient consent, "
            "classifies inquiries and writes the daily report from real data.</li></ul>"
            f"<span class='tag'>AI engine in this recording: {engine_line}</span>",
            9,
        )

        # ------------------------------------------------------------------ 1. dashboard
        say("1 - The problem it solves", "Three portals: patients self-serve with the AI assistant, reception works the desk, admins run the clinic. There is no public landing page.", 6)
        page.get_by_text("Access Admin Login").click()
        page.wait_for_timeout(800)
        page.get_by_placeholder("admin").fill("admin")
        page.get_by_placeholder("••••••••").fill("admin123")
        say("1 - Admin sign in", "Administrators sign in with a username and password.", 3)
        page.locator("button[type=submit]").click()
        page.wait_for_selector("text=Practice Operations Overview", timeout=15000)
        page.wait_for_timeout(1500)
        say("1 - Professional dashboard", "The overview is completely clean: no sample patients, appointments or inquiries. Every number you see next comes from real activity.", 7)
        page.mouse.wheel(0, 700)
        say("1 - What it tracks", "Live KPIs, appointment trends, inquiry categories and an automation audit trail, all updated as patients book.", 6)
        page.mouse.wheel(0, -1400)

        # ------------------------------------------------------------------ 2. AI books
        say("2 - Patient portal", "The AI assistant lives in the patient portal. A patient opens it from the portal page.", 4)
        page.locator("aside").get_by_role("button", name=re.compile("Patient Portal")).first.click()
        page.wait_for_selector("text=Book faster with the MediFlow AI assistant")
        page.wait_for_timeout(1500)
        page.get_by_test_id("banner-open-assistant").click()
        page.wait_for_selector("[data-testid=assistant-panel]")
        page.wait_for_timeout(1000)
        say("2 - Ask the assistant for slots", "The patient asks in plain language. The assistant calls a check_availability tool against the live calendar instead of guessing.", 5)
        ask(f"Do you have any dermatology appointments {phrase}?")
        hide()
        say("2 - Verified slots", "Every time shown was validated against doctor schedules, breaks, clinic hours and existing bookings.", 5)
        ask("Please book 10:00 AM. My name is Priya Sharma and my phone is +1 217 555 0188")
        hide()
        say("2 - Booking needs consent", "The assistant re-validates the slot and stages the booking, but nothing is saved until the patient presses Confirm.", 6)
        page.get_by_test_id("confirm-booking").click()
        page.wait_for_timeout(2500)
        say("2 - Booking created", "The patient receives a reference number (MF-xxxxx) that can be used to look the booking up later.", 5)

        # ------------------------------------------------------------------ 3. appears in management
        hide()
        page.get_by_role("button", name="Switch Portal").click()
        page.wait_for_selector("text=Select Your Portal to Continue")
        page.get_by_text("Resume Admin Console").click()
        page.wait_for_selector("text=Practice Operations Overview")
        page.wait_for_timeout(1500)
        say("3 - Management dashboard", "Back in the admin console the new request is already counted in the overview.", 5)
        nav("Appointments")
        say("3 - New appointment", "Priya Sharma's booking appears as Pending, with her doctor, service, time and booking reference.", 6)
        nav("Patients")
        say("3 - Patient record", "A real patient record was created automatically from the booking, with no placeholder data.", 5)

        # ------------------------------------------------------------------ 4. inquiry + automation
        nav("Inquiries")
        say("4 - Inquiry classification", "Incoming messages are classified by category and priority, and risky ones are escalated to clinical triage.", 5)
        page.get_by_role("button", name="Log Incoming Inquiry").click()
        page.get_by_placeholder("e.g. Robert Martin").fill("Daniel Brooks")
        page.get_by_placeholder(re.compile("555-0199")).fill("+1 217 555 0142")
        page.get_by_placeholder(re.compile("Detail the patient question")).type(
            "I need a refill for my blood pressure medication and I have been feeling dizzy since yesterday.", delay=25
        )
        page.wait_for_timeout(800)
        page.get_by_role("button", name=re.compile("Classify & Submit")).click()
        page.wait_for_timeout(3500)
        say("4 - Escalated automatically", "Medication and symptoms were classified as Human Assistance Required, high priority, and routed to nurse triage.", 6)
        page.get_by_role("button", name="Log Incoming Inquiry").click()
        page.get_by_placeholder("e.g. Robert Martin").fill("Maria Lopez")
        page.get_by_placeholder(re.compile("555-0199")).fill("maria.lopez@example.com")
        page.get_by_placeholder(re.compile("Detail the patient question")).type("What time do you close on Saturday and is there parking?", delay=25)
        page.get_by_role("button", name=re.compile("Classify & Submit")).click()
        page.wait_for_timeout(3500)
        say("4 - Routine question", "A hours-and-parking question is Clinic Information, low priority, answered by the front desk.", 5)

        nav("Automation Center")
        say("4 - Automated workflow", "Automation Center runs administrative workflows. Run Now on Appointment Request Processing.", 5)
        page.get_by_role("button", name="Run Now").first.click()
        page.wait_for_timeout(3500)
        say("4 - Pending request approved", "The workflow verified the slot is conflict-free and confirmed the pending appointment, logging an audit entry.", 6)
        page.mouse.wheel(0, 900)
        page.wait_for_timeout(1500)
        say("4 - Audit trail", "Every execution is recorded with its trigger, status and outcome.", 4)
        page.mouse.wheel(0, -1500)
        nav("Appointments")
        say("4 - Result", "Priya's appointment is now Confirmed, with no manual work by the front desk.", 5)

        # ------------------------------------------------------------------ 5. AI report
        nav("AI Reports")
        say("5 - AI daily clinic report", "The report is generated from the live database: appointments by status, doctor and service, plus inquiries and automation runs.", 6)
        page.locator("input[type=date]").nth(1).fill(target.isoformat())
        page.wait_for_timeout(800)
        page.get_by_role("button", name=re.compile("Generate AI Report")).click()
        page.wait_for_selector("text=Generated:", timeout=90000)
        page.wait_for_timeout(2000)
        say("5 - Grounded report", "Every sentence cites real figures from the data. Nothing is invented.", 5)
        page.mouse.wheel(0, 650)
        page.wait_for_timeout(2500)
        page.mouse.wheel(0, 650)
        page.wait_for_timeout(2500)
        hide()
        page.mouse.wheel(0, -2000)

        card(
            "<h1>How I improved the prompts</h1>"
            "<ul>"
            "<li><b>v1</b> asked for a formal report: the model invented trends and percentages.</li>"
            "<li><b>v2</b> added a don't-fabricate rule: better, but facts were still passed as a flat sentence.</li>"
            "<li><b>v3</b> separates ROLE, RULES and DATA. Facts are sent as JSON built from the database; "
            "every claim must cite a figure; zero-data periods are handled explicitly; output is schema-constrained JSON.</li>"
            "<li>The inquiry classifier got category definitions, a priority rubric, worked examples and enum-constrained output.</li>"
            "<li>The offline fallback no longer fabricates claims either.</li>"
            "</ul>"
            f"<span class='tag'>AI engine in this recording: {engine_line}</span>",
            14,
        )

        ctx.close()  # flushes the video
        browser.close()

    webm = max(OUT.glob("*.webm"), key=lambda f: f.stat().st_mtime)
    final_webm = OUT / "mediflow-demo.webm"
    shutil.move(webm, final_webm)
    mp4 = OUT / "mediflow-demo.mp4"
    if shutil.which("ffmpeg"):
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(final_webm), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
             "-r", "30", "-movflags", "+faststart", str(mp4)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print("Saved", mp4)
    else:
        print("ffmpeg not found; saved", final_webm)

    api("/reset-data", {})  # leave the database clean after the recording
    if server:
        server.terminate()


if __name__ == "__main__":
    main()
