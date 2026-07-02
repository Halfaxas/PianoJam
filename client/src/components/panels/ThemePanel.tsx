import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useThemeStore, type ThemeColors } from "../../state/themeStore";

const FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "whiteTrail", label: "White-key trails" },
  { key: "blackTrail", label: "Black-key trails" },
];

export function ThemePanel() {
  const theme = useThemeStore();
  const [editing, setEditing] = useState<keyof ThemeColors>("background");

  return (
    <div className="theme-panel">
      <div className="theme-swatches">
        {FIELDS.map(({ key, label }) => (
          <button
            key={key}
            className={`swatch-row${editing === key ? " selected" : ""}`}
            onClick={() => setEditing(key)}
          >
            <span className="swatch" style={{ background: theme[key] }} />
            {label}
          </button>
        ))}
      </div>
      <HexColorPicker
        color={theme[editing]}
        onChange={(c) => theme.setColor(editing, c)}
      />
      <button className="btn ghost full" onClick={theme.reset}>
        Reset theme
      </button>
    </div>
  );
}
