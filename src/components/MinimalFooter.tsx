const MinimalFooter = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-8">
      {/* Separador minimalista: gradiente fino + selo central */}
      <div className="relative h-px w-full bg-gradient-to-r from-transparent via-border/70 to-transparent" />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 ring-4 ring-background" />
      </div>

      <div
        className="bg-muted/30 px-6 pt-6"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="h-px w-6 bg-border" />
            <span>GoDrive</span>
            <span className="h-px w-6 bg-border" />
          </div>
          <p className="text-[11px] text-muted-foreground/60 text-center tabular-nums">
            © {year} • Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
};

export default MinimalFooter;
