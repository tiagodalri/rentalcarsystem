import { lazy, Suspense, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile, Loader2 } from "lucide-react";

// Load emoji-picker-react lazily — heavy bundle we don't want on every route.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface Props {
  onSelect: (emoji: string) => void;
}

export function EmojiPickerButton({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          title="Emoji"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="p-0 border-0 shadow-xl w-auto bg-transparent"
        sideOffset={8}
      >
        <Suspense
          fallback={
            <div className="w-[320px] h-[400px] rounded-md bg-background flex items-center justify-center border">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <EmojiPicker
            width={320}
            height={400}
            searchPlaceholder="Buscar emoji"
            previewConfig={{ showPreview: false }}
            onEmojiClick={(e) => {
              onSelect(e.emoji);
              setOpen(false);
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
