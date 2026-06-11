import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que a tag "Turo" exista e a atribui ao cliente.
 * Idempotente — não duplica atribuição.
 */
export async function ensureTuroTagAssigned(customerId: string) {
  // 1) Procura tag "Turo" (case-insensitive)
  const { data: existing } = await supabase
    .from("customer_tags")
    .select("id, name")
    .ilike("name", "turo")
    .limit(1);

  let tagId = existing?.[0]?.id as string | undefined;

  // 2) Se não existir, cria
  if (!tagId) {
    const { data: created, error } = await supabase
      .from("customer_tags")
      .insert({ name: "Turo", color: "purple", sort_order: 999 })
      .select("id")
      .single();
    if (error || !created) return;
    tagId = created.id;
  }

  // 3) Atribui ao cliente (ignora se já existir)
  await supabase
    .from("customer_tag_assignments")
    .upsert(
      { customer_id: customerId, tag_id: tagId },
      { onConflict: "customer_id,tag_id", ignoreDuplicates: true },
    );
}
