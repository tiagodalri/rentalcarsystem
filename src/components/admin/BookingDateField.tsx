import { useEffect, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BookingDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function maskDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function fromIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function toDisplay(value: string) {
  const parsed = fromIso(value);
  return parsed ? format(parsed, "dd/MM/yyyy") : "";
}

function toIso(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const parsed = parse(value, "dd/MM/yyyy", new Date());
  if (!isValid(parsed) || format(parsed, "dd/MM/yyyy") !== value) return null;
  return format(parsed, "yyyy-MM-dd");
}

export function BookingDateField({ value, onChange, className }: BookingDateFieldProps) {
  const [text, setText] = useState(() => toDisplay(value));
  const [editing, setEditing] = useState(false);
  const selected = fromIso(value);
  const invalid = text.length === 10 && !toIso(text);

  useEffect(() => {
    if (!editing) setText(toDisplay(value));
  }, [editing, value]);

  const handleTextChange = (nextValue: string) => {
    const next = maskDate(nextValue);
    setText(next);

    if (!next) {
      onChange("");
      return;
    }

    const iso = toIso(next);
    if (iso) onChange(iso);
    else if (value) onChange("");
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          const iso = toIso(text);
          setText(iso ? toDisplay(iso) : "");
        }}
        aria-invalid={invalid}
        className={cn(
          "h-11 pr-11 text-[15px] tabular-nums",
          invalid && "border-destructive focus-visible:ring-destructive",
          className,
        )}
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Selecionar data"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="z-[70] w-auto p-0 bg-popover border-border" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              const iso = format(date, "yyyy-MM-dd");
              setText(format(date, "dd/MM/yyyy"));
              onChange(iso);
            }}
            defaultMonth={selected ?? new Date()}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}