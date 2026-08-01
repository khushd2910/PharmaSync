import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, RotateCcw } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'pharmacare-chat-history';
const DEFAULT_MESSAGES = [
  { role: 'bot', text: "Hi! Ask me about a medicine, your order status, or a symptom like a headache." },
];
const QUICK_REPLIES = ['Track my order', 'I have a headache', 'Do I need a prescription?', 'Delivery time?'];

// A guest (not logged in) has no server-verified identity, so we hand them
// a random one for this tab and remember it for the session — this is what
// lets the server keep guest A's "last medicine asked about" separate from
// guest B's (see server/controllers/chatController.js).
const createGuestId = () => {
  const id = `guest-${Math.random().toString(36).slice(2, 10)}`;
  try {
    sessionStorage.setItem('pharmacare-chat-guest-id', id);
  } catch {
    // ignore — id still works for this render, just won't survive a reload
  }
  return id;
};
const getOrCreateGuestId = () => {
  try {
    return sessionStorage.getItem('pharmacare-chat-guest-id') || createGuestId();
  } catch {
    return createGuestId();
  }
};

const loadHistoryFor = (identity) => {
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY}-${identity}`);
    return stored ? JSON.parse(stored) : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
};

// Module 9 — AI Chatbot. History persists in sessionStorage so switching
// pages (or accidentally closing the panel) doesn't wipe the
// conversation — it clears naturally when the browser tab closes,
// same as the rest of the app's session-scoped state. Works for guests
// and logged-in users alike; the server attaches the user id when there is one.
const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  // null until the very first identity-resolution effect runs, so the
  // "save" effect below never writes under a placeholder key before we
  // know who's actually chatting.
  const [chatIdentity, setChatIdentity] = useState(null);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  // undefined = not resolved yet (first render); a real id = we were last
  // chatting as that logged-in user; null = we were last chatting as a guest.
  const prevLoggedInIdRef = useRef(undefined);

  // Resolve who we're chatting as, and load THAT identity's history in the
  // very same update as switching identity. Previously this was two
  // separate effects (one to set chatIdentity, another reacting to it to
  // load history) — between those two renders, a third "save" effect fired
  // using the OUTGOING user's still-current messages paired with the NEW
  // user's storage key, permanently copying user A's transcript into user
  // B's slot the moment B logged in. Setting both in one go means the save
  // effect only ever sees a matched (identity, messages) pair.
  //
  // On top of that: logging out now deletes the outgoing user's saved chat
  // outright, and hands the next session (guest or a different login) a
  // completely clean slate rather than falling back to whatever was last
  // saved for that identity.
  useEffect(() => {
    const loggedInId = user?.id || user?._id || user?.email || null;
    const prevLoggedInId = prevLoggedInIdRef.current;
    const justLoggedOut = prevLoggedInId !== undefined && prevLoggedInId && !loggedInId;

    if (justLoggedOut) {
      try {
        sessionStorage.removeItem(`${STORAGE_KEY}-${prevLoggedInId}`);
      } catch {
        // ignore — nothing to clean up if storage isn't available
      }
      // Best-effort — also clear the "last medicine asked about" style
      // context the server keeps for this user. Not awaited: this is a
      // cleanup side-effect, not something the UI should wait on.
      api.post('/chat/reset', { userId: prevLoggedInId }).catch(() => {});
    }
    prevLoggedInIdRef.current = loggedInId;

    let resolvedIdentity;
    if (loggedInId) {
      resolvedIdentity = loggedInId;
    } else if (justLoggedOut) {
      // Don't reuse this tab's old guest id — it may have picked up
      // messages before this person logged in, and we just promised a
      // clean slate on logout.
      resolvedIdentity = createGuestId();
    } else {
      resolvedIdentity = getOrCreateGuestId();
    }

    setChatIdentity(resolvedIdentity);
    setMessages(justLoggedOut ? DEFAULT_MESSAGES : loadHistoryFor(resolvedIdentity));
  }, [user]);

  // Persist messages for the current identity only — guarded so it can
  // never fire before an identity has actually been resolved.
  useEffect(() => {
    if (!chatIdentity) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEY}-${chatIdentity}`, JSON.stringify(messages));
    } catch {
      // Storage full/unavailable (private browsing, etc.) — chat still
      // works within the tab, it just won't persist across a reload.
    }
  }, [messages, chatIdentity]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendText = async (text) => {
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/chat', { message: text, userId: chatIdentity });
      const { reply, disclaimer } = res.data;
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: reply, disclaimer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendText(input.trim());

  const handleReset = async () => {
    try {
      await api.post('/chat/reset', { userId: chatIdentity });
    } catch {
      // ignore reset errors and still clear the local view
    }
    setMessages(DEFAULT_MESSAGES);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick replies stay available for the first couple of turns (common
  // starting points), then step aside once the conversation is underway
  // so they don't clutter a longer back-and-forth.
  const showQuickReplies = messages.length <= 1;

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>PharmaSync Assistant</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="icon-btn" onClick={handleReset} aria-label="Restart chat">
                <RotateCcw size={16} strokeWidth={2} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="chat-panel-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                <p>{m.text}</p>
                {m.disclaimer && <p className="chat-disclaimer">{m.disclaimer}</p>}
              </div>
            ))}
            {sending && <div className="chat-bubble chat-bubble-bot chat-typing">Typing…</div>}

            {showQuickReplies && !sending && (
              <div className="chat-quick-replies">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} type="button" className="chat-quick-reply" onClick={() => sendText(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="chat-panel-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={sending}
            />
            <button type="button" className="btn-primary chat-send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
              <Send size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X size={22} strokeWidth={2} /> : <MessageCircle size={22} strokeWidth={2} />}
      </button>
    </div>
  );
};

export default ChatWidget;
