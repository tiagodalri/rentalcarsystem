import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, UserPlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export type CustomerLite = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

interface Props {
  selected: CustomerLite | null;
  onSelect: (c: CustomerLite | null) => void;
}

export function CustomerCombobox({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newC, setNewC] = useState({ full_name: "", email: "", phone: "", document_number: "" });
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const builder = supabase.from("customers").select("id, full_name, email, phone").order("full_name").limit(10);
      const { data } = q
        ? await builder.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        : await builder;
      setResults((data as CustomerLite[]) || []);
      setLoading(false);
    }, 250);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [query, open]);

  const handleCreate = async () => {
    if (!newC.full_name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        full_name: newC.full_name.trim(),
        email: newC.email.trim() || null,
        phone: newC.phone.trim() || null,
        document_number: newC.document_number.trim() || null,
      })
      .select("id, full_name, email, phone")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Erro ao criar cliente", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cliente criado" });
    onSelect(data as CustomerLite);
    setShowNewForm(false);
    setNewC({ full_name: "", email: "", phone: "", document_number: "" });
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Cliente vinculado</div>
          <div className="text-sm font-medium text-foreground truncate">{selected.full_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[selected.email, selected.phone].filter(Boolean).join(" · ") || ""}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="shrink-0">
          <X size={14} className="mr-1" /> Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row gap-2 w-full min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 min-w-0 justify-between font-normal">
              <span className="truncate">Buscar cliente por nome, email ou telefone...</span>
              <ChevronsUpDown size={14} className="opacity-50 shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Digite para buscar..." value={query} onValueChange={setQuery} />
              <CommandList>
                {loading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Buscando...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {results.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => {
                            onSelect(c);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selected?.id === c.id ? "opacity-100" : "opacity-0")} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.full_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[c.email, c.phone].filter(Boolean).join(" · ") || ""}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button type="button" variant="secondary" onClick={() => setShowNewForm((v) => !v)} className="shrink-0 w-full md:w-auto whitespace-nowrap">
          <UserPlus size={14} className="mr-1" />
          {showNewForm ? "Cancelar" : "Criar novo"}
        </Button>
      </div>

      {showNewForm && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome completo *</Label>
              <Input value={newC.full_name} onChange={(e) => setNewC((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={newC.email} onChange={(e) => setNewC((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={newC.phone} onChange={(e) => setNewC((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Documento (CPF/Passport/ID)</Label>
              <Input value={newC.document_number} onChange={(e) => setNewC((p) => ({ ...p, document_number: e.target.value }))} />
            </div>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={12} className="mr-1 animate-spin" />}
            Salvar cliente
          </Button>
        </div>
      )}
    </div>
  );
}
