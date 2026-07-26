# AI Chatbot (Module 9)

A rule-based chatbot with a Gemini fallback for anything it doesn't
recognize. Talks to the same MongoDB the rest of the app uses (read-only).

```
User -> React Chat UI -> Node.js API -> this service
    -> just a greeting?         -> canned greeting (knowledge_base.py)
    -> order question?          -> query MongoDB
    -> medicine question?       -> query MongoDB
    -> recommendation request?  -> small curated-picks function
    -> prescription/delivery FAQ? -> canned answer (knowledge_base.py)
    -> symptom ("I have a headache")? -> OTC guidance + disclaimer (knowledge_base.py)
    -> vague health complaint ("I don't feel well")? -> asks which symptom (knowledge_base.py)
    -> otherwise                -> Gemini API (or a static fallback if no API key is set)
```

Checked in that order — a message that opens with a greeting but *also*
says something else ("hi, I have a fever") is intent-detected as the
fever, not the greeting; only a message that's essentially just the
greeting itself ("hi", "hey there") is treated as one. See
`is_pure_greeting()` in `views.py`.

> Built with Django, matching `../medicine_api`.

## If the chatbot only ever shows a generic error

That almost always means this Django service isn't reachable from Node —
either it isn't running, or `CHATBOT_API_URL` (`server/.env`) doesn't
point at it. Check with:

```bash
curl -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" -d '{"message":"i had a fever"}'
```

If that fails, start the service (see "Run" below). As a safety net, Node
also has its own small local mirror of just the symptom knowledge base
(`server/utils/localChatFallback.js`) — so greetings and known symptoms
(fever, headache, cold, etc.) still get a real answer even with this
service down, while anything that genuinely needs MongoDB or Gemini
(order lookups, medicine search, general questions) still requires this
service to actually be running.

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
consult a doctor or pharmacist" message. Note this only affects messages
that don't match anything else (greeting, symptom, FAQ, medicine/order
question) — most real questions never reach this path at all.

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
actual doctor. A message mentioning more than one known symptom (e.g.
"fever and headache") gets advice for all of them, not just whichever one
happens to be checked first internally.
