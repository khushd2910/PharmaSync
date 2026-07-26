/**
 * Module 9 — AI Chatbot.
 *
 * Node's job here is thin: take the message from the React chat widget,
 * attach the logged-in user's id (if any — see optionalAuth), and forward
 * it to the Django chatbot service (python-service/chatbot). All the
 * actual intent handling — MongoDB lookups, the recommendation
 * function, the Gemini fallback — lives there, same split as Module 8's
 * medicine_api.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const CHATBOT_API_URL = process.env.CHATBOT_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 8000; // Gemini calls can take a moment longer than a plain DB lookup

const sendChatMessage = catchAsync(async (req, res, next) => {
  const message = (req.body.message || '').trim();
  if (!message) {
    return next(new AppError('message is required', 400));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const upstream = await fetch(`${CHATBOT_API_URL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId: req.user?._id?.toString() }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const upstreamText = await upstream.text();
    console.error('[chatController] upstream status', upstream.status, 'body', upstreamText);

    if (!upstream.ok) {
      return next(new AppError('Chat assistant is temporarily unavailable', 502));
    }

    let data;
    try {
      data = JSON.parse(upstreamText);
    } catch {
      data = { reply: upstreamText };
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('[chatController] upstream fetch failed', err?.message || err, err?.code, err?.cause);
    // Chat service down/unreachable/timed out — fail gracefully rather
    // than a raw 500, since this is a "nice to have" assistant, not a
    // critical path.
    return res.status(200).json({
      reply: "Sorry, the assistant is temporarily unavailable. Please try again shortly.",
      intent: 'error',
    });
  }
});

module.exports = { sendChatMessage };
