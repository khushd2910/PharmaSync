import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import api from '../api/axios';

// Module 9 — AI Chatbot. Client-side history only (not persisted) — a
// fresh page load starts a new conversation. Works for guests and
// logged-in users alike; the server attaches the user id when there is one.
const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! Ask me about a medicine, your order status, or a symptom like a headache." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSend = async () => {
    const text = input.trim();
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
