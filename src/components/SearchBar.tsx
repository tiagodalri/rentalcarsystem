import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, Clock, MapPin, Search, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

const locations = [
  "Aeroporto de Orlando (MCO)",
  "Aeroporto de Miami (MIA)",
  "Aeroporto de Tampa (TPA)",
  "Orlando (Entrega no Hotel)",
  "Miami (Entrega no Hotel)",
  "Kissimmee",
  "International Drive",
  "Lake Buena Vista",
];

const timeSlots = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

const SearchBar = () => {
  const navigate = useNavigate();
  const [pickupDate, setPickupDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [differentReturnLocation, setDifferentReturnLocation] = useState(false);
  const [driverOver26, setDriverOver26] = useState(true);
  const [driverAge, setDriverAge] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const isUnderageBlocked = !driverOver26 && !!driverAge && Number(driverAge) < 21;

  const handleSearch = () => {
    if (isUnderageBlocked) return;
    const params = new URLSearchParams();
    if (pickupDate) params.set("pickupDate", pickupDate.toISOString());
    if (returnDate) params.set("returnDate", returnDate.toISOString());
    if (pickupTime) params.set("pickupTime", pickupTime);
    if (returnTime) params.set("returnTime", returnTime);
    if (pickupLocation) params.set("pickupLocation", pickupLocation);
    params.set("returnLocation", differentReturnLocation ? returnLocation : pickupLocation);
    if (!driverOver26 && driverAge) params.set("driverAge", driverAge);
    navigate(`/buscar?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1 }}
      className="mt-6 md:mt-10 w-full max-w-5xl mx-auto"
    >
      <div className="glass-card p-3 sm:p-5 md:p-7 rounded-2xl border border-border/15">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3.5">
          {/* Pickup Date */}
          <Popover open={openPicker === "pickupDate"} onOpenChange={(o) => setOpenPicker(o ? "pickupDate" : null)}>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full",
                pickupDate && "border-primary/30"
              )}>
                <CalendarIcon size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Data Retirada</p>
                  <p className="text-sm text-foreground truncate">
                    {pickupDate ? format(pickupDate, "dd MMM yyyy", { locale: pt }) : "Selecione"}
                  </p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="single"
                selected={pickupDate}
                onSelect={(d) => { setPickupDate(d); setOpenPicker(null); }}
                disabled={(date) => date < new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Pickup Time */}
          <Popover open={openPicker === "pickupTime"} onOpenChange={(o) => setOpenPicker(o ? "pickupTime" : null)}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full">
                <Clock size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Horário Retirada</p>
                  <p className="text-sm text-foreground">{pickupTime}</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 bg-card border-border max-h-60 overflow-y-auto" align="start">
              {timeSlots.map((t) => (
                <button
                  key={t}
                  onClick={() => { setPickupTime(t); setOpenPicker(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    pickupTime === t ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {t}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Pickup Location */}
          <Popover open={openPicker === "pickupLoc"} onOpenChange={(o) => setOpenPicker(o ? "pickupLoc" : null)}>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full",
                pickupLocation && "border-primary/30"
              )}>
                <MapPin size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Local Retirada</p>
                  <p className="text-sm text-foreground truncate">{pickupLocation || "Selecione"}</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 bg-card border-border" align="start">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setPickupLocation(loc); setOpenPicker(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                    pickupLocation === loc ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {loc}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Return Date */}
          <Popover open={openPicker === "returnDate"} onOpenChange={(o) => setOpenPicker(o ? "returnDate" : null)}>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full",
                returnDate && "border-primary/30"
              )}>
                <CalendarIcon size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Data Devolução</p>
                  <p className="text-sm text-foreground truncate">
                    {returnDate ? format(returnDate, "dd MMM yyyy", { locale: pt }) : "Selecione"}
                  </p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="single"
                selected={returnDate}
                onSelect={(d) => { setReturnDate(d); setOpenPicker(null); }}
                disabled={(date) => date < (pickupDate || new Date())}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Return Time */}
          <Popover open={openPicker === "returnTime"} onOpenChange={(o) => setOpenPicker(o ? "returnTime" : null)}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full">
                <Clock size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Horário Devolução</p>
                  <p className="text-sm text-foreground">{returnTime}</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 bg-card border-border max-h-60 overflow-y-auto" align="start">
              {timeSlots.map((t) => (
                <button
                  key={t}
                  onClick={() => { setReturnTime(t); setOpenPicker(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    returnTime === t ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {t}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={isUnderageBlocked}
            className="gold-gradient text-primary-foreground font-bold uppercase tracking-widest h-auto py-3 rounded-xl hover:opacity-90 transition-opacity text-sm gap-2 disabled:opacity-40 disabled:cursor-not-allowed col-span-2 lg:col-span-1"
          >
            <Search size={16} />
            Buscar
          </Button>
        </div>

        {/* Different return location toggle + field */}
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={differentReturnLocation}
              onCheckedChange={(checked) => {
                setDifferentReturnLocation(checked);
                if (!checked) setReturnLocation("");
              }}
              className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted"
            />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Devolver em outro local?
            </span>
          </div>

          <AnimatePresence>
            {differentReturnLocation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <Popover open={openPicker === "returnLoc"} onOpenChange={(o) => setOpenPicker(o ? "returnLoc" : null)}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors w-full sm:w-auto sm:min-w-[280px]",
                      returnLocation && "border-primary/30"
                    )}>
                      <MapPin size={16} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Local Devolução</p>
                        <p className="text-sm text-foreground truncate">{returnLocation || "Selecione"}</p>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 bg-card border-border" align="start">
                    {locations.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => { setReturnLocation(loc); setOpenPicker(null); }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                          returnLocation === loc ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                      >
                        {loc}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Driver age toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={driverOver26}
              onCheckedChange={(checked) => {
                setDriverOver26(checked);
                if (checked) setDriverAge("");
              }}
              className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted"
            />
            <UserCheck size={16} className="text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Condutor tem 26 anos ou mais?
            </span>
          </div>

          <AnimatePresence>
            {!driverOver26 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border bg-background/50 w-full sm:w-auto sm:min-w-[280px]",
                  isUnderageBlocked ? "border-destructive/60" : "border-primary/40"
                )}>
                  <UserCheck size={16} className={cn("shrink-0", isUnderageBlocked ? "text-destructive" : "text-primary")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Idade do Condutor</p>
                    <input
                      type="number"
                      min="18"
                      max="25"
                      value={driverAge}
                      onChange={(e) => setDriverAge(e.target.value)}
                      placeholder="Ex: 22"
                      className="text-sm text-foreground bg-transparent outline-none w-full placeholder:text-muted-foreground/50"
                    />
                  </div>
                  {!isUnderageBlocked && (
                    <span className="text-[10px] text-primary font-semibold whitespace-nowrap">+8% na diária</span>
                  )}
                </div>
                {isUnderageBlocked && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <span className="text-xs text-destructive font-medium">
                      ⚠ Idade mínima para locação: 21 anos. Não é possível prosseguir.
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default SearchBar;
