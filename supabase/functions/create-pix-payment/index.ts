import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Service role para bypassar RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar configuração do gateway
    const { data: gwConfig, error: gwError } = await supabase
      .from("pix_gateway_config")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (gwError || !gwConfig) {
      return new Response(
        JSON.stringify({
          error: "Gateway PIX não configurado. Configure no painel admin.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, customer_name, customer_phone")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Gerar txid único (baseado no order_id, max 25 chars)
    const txid = order.id.replace(/-/g, "").slice(0, 25);

    // 4. Chamar API do Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gwConfig.access_token}`,
        "X-Idempotency-Key": txid,
      },
      body: JSON.stringify({
        transaction_amount: order.total,
        description: `Pedido #${order.id.slice(0, 8)}`,
        payment_method_id: "pix",
        external_reference: order_id,
        payer: {
          email: order.customer_phone
            ? `${order.customer_phone.replace(/\D/g, "")}@delivery.app`
            : `cliente-${order.id.slice(0, 8)}@delivery.app`,
        },
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", JSON.stringify(mpData));
      return new Response(
        JSON.stringify({
          error: "Erro ao criar pagamento no Mercado Pago",
          details: mpData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Extrair dados do PIX da resposta
    const pixData = mpData.point_of_interaction?.transaction_data;

    if (!pixData) {
      return new Response(
        JSON.stringify({ error: "Resposta do MP sem dados PIX" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // 6. Salvar referência no pedido
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        pix_payment_id: String(mpData.id),
        pix_copy_paste: pixData.qr_code,
        pix_expires_at: expiresAt,
      })
      .eq("id", order_id);

    if (updateError) {
      console.error("Error updating order:", updateError);
    }

    return new Response(
      JSON.stringify({
        qr_code_base64: pixData.qr_code_base64,
        qr_code: pixData.qr_code,
        ticket_url: pixData.ticket_url,
        payment_id: mpData.id,
        expires_at: expiresAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("create-pix-payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
