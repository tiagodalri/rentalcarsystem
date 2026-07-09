import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter no minimo 3 caracteres"),
  email: z.string().trim().email("Email invalido"),
  telefone: z.string().optional(),
  mensagem: z.string().trim().min(10, "Mensagem deve ter no minimo 10 caracteres").max(1000, "Mensagem deve ter no maximo 1000 caracteres"),
  website: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contato = () => {
  const [loading, setLoading] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      mensagem: "",
      website: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    // Honeypot check — silently "succeed"
    if (data.website && data.website.length > 0) {
      toast.success("Mensagem enviada, retornaremos em breve");
      form.reset();
      return;
    }

    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-contact-form", {
        body: {
          nome: data.nome,
          email: data.email,
          telefone: data.telefone || "",
          mensagem: data.mensagem,
          website: data.website || "",
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast.success("Mensagem enviada, retornaremos em breve");
      form.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Contato | Sua Marca Orlando"
        description="Fale com a Sua Marca. Atendimento em português para reservas, dúvidas e suporte de aluguel de carros premium em Orlando."
        path="/contato"
      />
      <Navbar />


      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Fale conosco
            </h1>
            <p className="mt-3 text-muted-foreground text-base sm:text-lg">
              Envie sua mensagem e retornaremos o mais breve possivel.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="seuemail@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone (opcional)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+55 11 99999-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mensagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Escreva sua mensagem aqui..."
                          className="min-h-[140px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Honeypot — hidden from real users */}
                <div className="absolute opacity-0 -z-10 pointer-events-none" aria-hidden="true" tabIndex={-1}>
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="text" autoComplete="off" tabIndex={-1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gold-gradient text-primary-foreground font-semibold tracking-wide h-12 text-base"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Send size={18} />
                      Enviar mensagem
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contato;
