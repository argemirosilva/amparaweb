import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

interface TimeSelectProps {
  value: string; // "HH:00"
  onChange: (value: string) => void;
}

export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  const [h] = (value || "00:00").split(":");
  const hour = h || "00";

  return (
    <Select value={hour} onValueChange={(v) => onChange(`${v}:00`)}>
      <SelectTrigger className="w-20 h-8 text-sm px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-48">
        {HOURS.map((hh) => (
          <SelectItem key={hh} value={hh}>{hh}h</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
