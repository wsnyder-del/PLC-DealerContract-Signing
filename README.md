# PLC Dealer Agreement — Electronic Signing Portal

## Overview
A simple 4-step web portal where dealers and reps can sign PLC agreements online. 
Upon submission, a signed PDF is automatically emailed to both the signer and PLC.

## How It Works
1. Signer selects which document(s) to sign
2. Signer enters their information
3. Signer reads the full agreement text
4. Signer draws their signature and submits
5. A signed PDF is generated server-side and emailed to both the signer and wsnyder@plc-us.com

---

## Deployment — Netlify

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/plc-signing.git
git push -u origin main
```

### Step 2: Connect to Netlify
1. Go to app.netlify.com → "Add new site" → "Import an existing project"
2. Connect your GitHub repo
3. Build settings are auto-detected from netlify.toml (no changes needed)
4. Click "Deploy site"

### Step 3: Set Environment Variables
In Netlify → Site Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `SMTP_HOST` | Your SMTP server (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | Your sending email address |
| `SMTP_PASS` | Your email password or app password |
| `PLC_NOTIFY_EMAIL` | `wsnyder@plc-us.com` |

### Recommended SMTP Options (Free/Low Cost)
- **Gmail** — Use an App Password (requires 2FA): smtp.gmail.com, port 587
- **SendGrid** — Free tier: 100 emails/day. smtp.sendgrid.net, port 587, user = `apikey`, pass = your API key
- **Mailgun** — Free tier: 100 emails/day. Get credentials from mailgun.com

### Step 4: Trigger a Redeploy
After setting env variables, go to Netlify → Deploys → "Trigger deploy"

---

## Sending to a Dealer or Rep
Just share the Netlify URL (e.g., `https://plc-dealer-signing.netlify.app`).
- Dealer owners → select Dealer Agreement (and Rep Compliance if signing both)
- Individual reps → select Rep Compliance Agreement only

## Files
```
├── netlify.toml              — Build config
├── package.json              — Dependencies (pdf-lib, nodemailer)
├── public/
│   └── index.html            — The signing portal (all frontend)
└── netlify/functions/
    └── sign-agreement.js     — Server function: generates PDF + sends emails
```
