# AI Chatbot (Module 9)

A rule-based chatbot with a Gemini fallback for anything it doesn't
recognize. Talks to the same MongoDB the rest of the app uses (read-only).

```
User -> React Chat UI -> Node.js API -> this service
    -> order question?        -> query MongoDB
    -> medicine question?      -> query MongoDB
    -> recommendation request? -> small curated-picks function
    -> prescription/delivery FAQ? -> canned answer (knowledge_base.py)
    -> symptom ("I have a headache")? -> OTC guidance + disclaimer (knowledge_base.py)
    -> otherwise                -> Gemini API (or a static fallback if no API key is set)
```

> Built with Django, matching `../medicine_api`.

## Setup

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
```

Add a `GEMINI_API_KEY` to `.env` if you want the general-health fallback to
actually call Gemini — without it, that path just returns a static "please
consult a doctor or pharmacist" message.

## Run

```bash
python3 manage.py runserver 0.0.0.0:8000
```

Starts on `http://localhost:8000` by default. Node reaches it via
`CHATBOT_API_URL` (`server/.env`, default `http://localhost:8000`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/api/chat` | `{ message, userId }` → `{ reply, intent, disclaimer?, data? }` |

`userId` is optional — Node passes the logged-in user's id when there is
one (from the session cookie), or omits it for a guest. Only
`order_status` actually needs it; everything else works for guests too.

Every symptom-advice reply includes the same disclaimer: this is general
information, not medical advice, and persistent symptoms should go to an
actual doctor.
