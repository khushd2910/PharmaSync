/**
 * Module 9 — AI Chatbot.
 *
 * Node's job here is thin: take the message from the React chat widget,
 * attach the logged-in user's id (if any — see optionalAuth), and forward
 * it to the Django chatbot service (python-service/chatbot). All the
 * actual intent handling — MongoDB lookups, the recommendation
 * function, the Gemini fallback — lives there, same split as Module 8's
 * medicine_api.
 *
 * Resilience: if the Django service can't be reached at all (not running,
 * network error, timeout), this used to always show a flat "assistant is
 * temporarily unavailable" message — even for something as basic as
 * "I have a fever", which doesn't actually need a database or an AI call
 * to answer. Now it tries utils/localChatFallback.js first, a small JS
 * mirror of just the symptom knowledge base, so the common cases (a
 * greeting, a known symptom, or a vague "I don't feel well") still get a
 * real answer even with the Python service down. Anything outside that
 * scope (order lookups, medicine search, Gemini) still needs Django and
 * falls through to the unavailable message as before.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getLocalFallbackReply } = require('../utils/localChatFallback');

const CHATBOT_API_URL = process.env.CHATBOT_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 8000; // Gemini calls can take a moment longer than a plain DB lookup

// Resolves who's actually chatting: a logged-in user's real, server-verified
// id always wins (never trust a client-supplied id for that — it would let
// anyone pass someone else's id and read their order history). For a guest,
// though, there IS no server session to verify, so the per-tab id the
// widget generates (req.body.userId) is the only thing that distinguishes
// one guest from another — previously this was dropped entirely and every
// guest's follow-up context ("is it in stock?") collapsed onto a single
// shared `undefined` key on the Django side, leaking one guest's
// conversation into another's.
const resolveChatUserId = (req) => req.user?._id?.toString() || (req.body.userId || '').trim() || undefined;

const sendChatMessage = catchAsync(async (req, res, next) => {
  const message = (req.body.message || '').trim();
  if (!message) {
    return next(new AppError('message is required', 400));
  }

  const userId = resolveChatUserId(req);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const upstream = await fetch(`${CHATBOT_API_URL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const localReply = getLocalFallbackReply(message);
      if (localReply) {
        return res.status(200).json(localReply);
      }
      return next(new AppError('Chat assistant is temporarily unavailable', 502));
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    // Chat service down/unreachable/timed out — try the local fallback
    // before giving up, since a fair number of common questions (a
    // greeting, a known symptom) don't actually need Django at all.
    const localReply = getLocalFallbackReply(message);
    if (localReply) {
      return res.status(200).json(localReply);
    }
    return res.status(200).json({
      reply: 'Sorry, the assistant is temporarily unavailable. Please try again shortly.',
      intent: 'error',
    });
  }
});

// The widget's "restart chat" button posts here to clear the follow-up
// context (e.g. "last medicine asked about") the Django side keeps for this
// user/guest. Best-effort: if Django can't be reached, the client still
// clears its own local view, so this failing quietly is fine.
const resetChat = catchAsync(async (req, res) => {
  const userId = resolveChatUserId(req);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    await fetch(`${CHATBOT_API_URL.replace(/\/$/, '')}/api/chat/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    // Chat service down/unreachable — nothing to clear server-side, but the
    // client still resets its own view, so this isn't fatal.
  }

  return res.status(200).json({ success: true });
});

module.exports = { sendChatMessage, resetChat };
