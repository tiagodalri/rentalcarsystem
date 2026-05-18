import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useJobTitles } from "@/hooks/useJobTitles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  value: string | null;
  onChange: (id: string | null, name: string | null) => void;
  className?: string;
}

export function JobTitleSelect({ value, onChange, className }: Props) {
  const { jobTitles, refresh } = useJobTitles();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = jobTitles.find((j) => j.id === value);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("job_titles")
      .insert({ name, sort_order: 100 })
      .select("id, name")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar cargo", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    onChange(data.id, data.name);
    setNewName("");
    setCreating(false);
    setOpen(false);
    toast({ title: "Cargo criado" });
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreating(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-left transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
            !selected && "text-muted-foreground/60",
            className,
          )}
        >
          <span className="truncate">{selected?.name || "Selecione um cargo"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {creating ? (
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Novo cargo</p>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
              placeholder="Nome do cargo"
              className="h-9"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(""); }}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleCreate} disabled={!newName.trim() || saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Criar
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Buscar cargo..." />
            <CommandList>
              <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
              <CommandGroup>
                {jobTitles.map((jt) => (
                  <CommandItem
                    key={jt.id}
                    value={jt.name}
                    onSelect={() => { onChange(jt.id, jt.name); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === jt.id ? "opacity-100" : "opacity-0")} />
                    {jt.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem onSelect={() => setCreating(true)} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar novo cargo
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
