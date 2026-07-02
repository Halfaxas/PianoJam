import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "../../state/roomStore";
import { getSocket } from "../../lib/socket";

export function ChatPanel() {
  const messages = useRoomStore((s) => s.messages);
  const setChatOpen = useRoomStore((s) => s.setChatOpen);
  const myName = useRoomStore((s) => s.self?.name);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatOpen(true);
    return () => setChatOpen(false);
  }, [setChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("chat:send", text);
    setDraft("");
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-message${m.from === myName ? " mine" : ""}${m.from === "PianoJam" ? " system" : ""}`}
          >
            <span className="chat-from">{m.from}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={draft}
          maxLength={500}
          placeholder="Message the room…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn primary" onClick={send} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
