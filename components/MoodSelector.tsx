import { Check } from "lucide-react";
import { MASCOT_MOODS, type Mood } from "@/lib/moods";

export function MoodSelector({ value, onChange }: { value: Mood; onChange: (mood: Mood) => void }) {
  return (
    <div className="mood-grid" role="radiogroup" aria-label="Approved mascot mood">
      {MASCOT_MOODS.filter((mood) => mood.active).map((mood) => {
        const selected = value === mood.id;
        return (
          <button type="button" role="radio" aria-checked={selected} className={`mood-card ${selected ? "selected" : ""}`} key={mood.id} onClick={() => onChange(mood.id)}>
            <span className="mood-thumb"><img src={mood.thumbnailPath} alt="" /></span>
            <span>{mood.displayName}</span>
            {selected && <i><Check size={12} strokeWidth={3} /></i>}
          </button>
        );
      })}
    </div>
  );
}

