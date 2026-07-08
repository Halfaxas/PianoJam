import { useEffect, useRef, useState } from "react";
import { REACTION_COOLDOWN_MS, REACTIONS } from "@pianojam/shared";
import { getSocket } from "../lib/socket";

/**
 * Compact one-click reaction picker on the stage. Sending is rate limited
 * server-side; the bar mirrors that with a short client-side cooldown so
 * the buttons visibly recover.
 */
export function ReactionBar() {
  const [coolingDown, setCoolingDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = (reaction: (typeof REACTIONS)[number]) => {
    if (coolingDown) return;
    getSocket().emit("reaction:send", reaction);
    setCoolingDown(true);
    timer.current = setTimeout(() => setCoolingDown(false), REACTION_COOLDOWN_MS);
  };

  return (
    <div className={`reaction-bar${coolingDown ? " cooldown" : ""}`}>
      {REACTIONS.map((reaction) => (
        <button
          key={reaction}
          className="reaction-btn"
          disabled={coolingDown}
          aria-label={`React with ${reaction}`}
          onClick={() => send(reaction)}
        >
          {reaction}
        </button>
      ))}
    </div>
  );
}
