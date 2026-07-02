import { useState } from "react";
import { saveRecordingAsWav } from "../../audio/recorder";
import { toast } from "../../state/toastStore";

interface Props {
  blob: Blob;
  onDone: () => void;
}

export function SaveRecordingPanel({ blob, onDone }: Props) {
  const [name, setName] = useState("my-jam");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveRecordingAsWav(blob, name.trim() || "my-jam");
      toast.success("Recording saved as WAV.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not encode the recording.");
      setSaving(false);
    }
  };

  return (
    <div className="form">
      <label>
        File name
        <input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
          autoFocus
        />
      </label>
      <div className="row-between">
        <button className="btn ghost" onClick={onDone}>
          Discard
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim() || saving}>
          {saving ? "Encoding…" : "Save .wav"}
        </button>
      </div>
    </div>
  );
}
