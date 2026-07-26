import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import api from '../api/axios';

const STORAGE_KEY = 'pharmacare-chat-history';
const DEFAULT_MESSAGES = [
  { role: 'bot', text: "Hi! Ask me about a medicine, your order status, or a symptom like a headache." },
];
const QUICK_REPLIES = ['Track my order', 'I have a headache', 'Do I need a prescription?', 'Delivery time?'];

// Module 9 — AI Chatbot. History persists in sessionStorage so switching
// pages (or accidentally closing the panel) doesn't wipe the
// conversation — it clears naturally when the browser tab closes,
// same as the rest of the app's session-scoped state. Works for guests
// and logged-in users alike; the server attaches the user id when there is one.
const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_MESSAGES;
    } catch {
      return DEFAULT_MESSAGES;
    }
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage full/unavailable (private browsing, etc.) — chat still
      // works within the tab, it just won't persist across a reload.
    }
  }, [messages, open]);

  const sendText = async (text) => {
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/chat', { message: text });
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
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={16} strokeWidth={2} />
            </button>
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
