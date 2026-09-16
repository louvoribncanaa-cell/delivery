import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Ler body da notificação
    const body = await req.json();

    // 2. Validar se é evento de pagamento
    if (body.type !== "payment") {
      return new Response("ignored: not a payment event", {
        status: 200,
        headers: corsHeaders,
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response("missing payment id", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 3. Conectar ao Supabase com service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Buscar config do gateway para obter access token
    const { data: gwConfig } = await supabase
      .from("pix_gateway_config")
      .select("access_token")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!gwConfig) {
      console.error("No active gateway config found");
      return new Response("no gateway config", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 5. Consultar pagamento no Mercado Pago para obter dados atualizados
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${gwConfig.access_token}`,
        },
      }
    );
    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Error fetching payment from MP:", JSON.stringify(payment));
      return new Response("error fetching payment", {
        status: 502,
        headers: corsHeaders,
      });
    }

    // 6. Verificar se pagamento foi aprovado
    if (payment.status !== "approved") {
      return new Response(`payment status: ${payment.status}`, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 7. Chamar RPC para confirmar pagamento (com idempotência)
    const { data: result, error: rpcError } = await supabase.rpc(
      "confirm_pix_payment",
      {
        p_pix_payment_id: String(paymentId),
        p_amount: payment.transaction_amount,
      }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response("rpc error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Payment confirmation result:", JSON.stringify(result));

    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("handle-pix-webhook error:", error);
    return new Response("error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
