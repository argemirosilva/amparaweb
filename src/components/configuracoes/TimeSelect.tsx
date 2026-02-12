import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface TimeSelectProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  const [h, m] = (value || "00:00").split(":");
  const hour = h || "00";
  const minute = MINUTES.includes(m) ? m : "00";

  return (
    <div className="flex items-center gap-1">
      <Select value={hour} onValueChange={(v) => onChange(`${v}:${minute}`)}>
        <SelectTrigger className="w-16 h-8 text-sm px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {HOURS.map((hh) => (
            <SelectItem key={hh} value={hh}>{hh}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground text-xs">:</span>
      <Select value={minute} onValueChange={(v) => onChange(`${hour}:${v}`)}>
        <SelectTrigger className="w-16 h-8 text-sm px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((mm) => (
            <SelectItem key={mm} value={mm}>{mm}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
