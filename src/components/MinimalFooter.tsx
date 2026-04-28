const MinimalFooter = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="py-4 px-6 border-t border-border/20 bg-background/60">
      <p className="text-[10px] text-muted-foreground/50 text-center tracking-wide">
        © {year} Zeus Rental Car. Todos os direitos reservados.
      </p>
    </footer>
  );
};

export default MinimalFooter;
