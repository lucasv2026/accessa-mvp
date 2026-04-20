import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173"
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev"
const FROM_NAME = "Accessa"

// Admin client — uses built-in Supabase secrets (auto-injected in Edge Functions)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { email, firstName, lastName, companyName, score, totalRisk, siren } = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY non configurée")
    }

    if (!email) {
      throw new Error("Email manquant")
    }

    // ── Generate a real Supabase magic link ──────────────────────────────────
    const redirectTo = `${APP_URL}/auth/callback${siren ? `?siren=${encodeURIComponent(siren)}` : ""}`
    let reportLink = `${APP_URL}/dashboard${siren ? `?siren=${encodeURIComponent(siren)}` : ""}`

    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email.trim().toLowerCase(),
        options: { redirectTo },
      })
      if (linkError) {
        console.error("[send-email] generateLink error:", linkError.message)
      } else if (linkData?.properties?.action_link) {
        reportLink = linkData.properties.action_link
      }
    } catch (linkEx) {
      console.error("[send-email] generateLink exception:", linkEx)
      // Non-blocking — fall back to direct dashboard link
    }

    // ── Build email HTML ─────────────────────────────────────────────────────
    const scoreColor = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626"
    const scoreLabel = score >= 80 ? "Excellent" : score >= 50 ? "Risques modérés" : "Exposition critique"
    const riskFormatted = (totalRisk || 0).toLocaleString("fr-FR")
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,"

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Votre rapport de conformité — Accessa</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Accessa</p>
                    <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Conformité administrative intelligente</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;color:#ffffff;">
                      Rapport prêt
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0;">

              <p style="margin:0 0 8px;font-size:16px;color:#374151;">${greeting}</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.2;letter-spacing:-0.5px;">
                Votre rapport de conformité<br />est prêt
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.65;">
                Nous avons analysé la situation de votre entreprise <strong style="color:#0f172a;">${companyName || "votre entreprise"}</strong>.
                Voici le résumé de votre diagnostic réglementaire.
              </p>

              <!-- Score card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1.5px solid #e4e4e7;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;">Score de conformité</p>
                          <p style="margin:0;font-size:48px;font-weight:800;color:${scoreColor};line-height:1;letter-spacing:-2px;">
                            ${score}<span style="font-size:18px;color:#a1a1aa;font-weight:500;">/100</span>
                          </p>
                          <span style="display:inline-block;margin-top:6px;padding:3px 10px;background:${scoreColor}18;border-radius:20px;font-size:12px;font-weight:600;color:${scoreColor};">
                            ${scoreLabel}
                          </span>
                        </td>
                        <td style="width:1px;background:#e4e4e7;" />
                        <td style="vertical-align:middle;padding-left:24px;">
                          <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;">Risques identifiés</p>
                          <p style="margin:0;font-size:32px;font-weight:800;color:#dc2626;line-height:1;letter-spacing:-1px;">${riskFormatted} €</p>
                          <p style="margin:4px 0 0;font-size:12px;color:#71717a;">de pénalités potentielles</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's in the report -->
              <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#0f172a;">Votre rapport inclut :</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                ${[
                  "Plan d'action personnalisé avec priorités",
                  "Liste complète de vos obligations réglementaires",
                  "Actions correctives pour chaque point",
                  "Documents légaux à préparer",
                  "Alertes avant les échéances clés",
                ].map(item => `
                <tr>
                  <td style="padding:4px 0;vertical-align:top;">
                    <span style="display:inline-block;width:18px;height:18px;background:#eef2ff;border-radius:50%;text-align:center;line-height:18px;font-size:11px;color:#4f46e5;font-weight:700;margin-right:10px;">✓</span>
                  </td>
                  <td style="padding:4px 0;font-size:14px;color:#374151;line-height:1.5;">${item}</td>
                </tr>`).join("")}
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
                <tr>
                  <td align="center">
                    <a href="${reportLink}"
                       style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.2px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
                      👉 Accéder à mon rapport complet
                    </a>
                    <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">Connexion automatique · Lien valable 1 heure</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:0;" />
            </td>
          </tr>

          <!-- Trust signals -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 8px;">
                    <p style="margin:0;font-size:12px;color:#a1a1aa;">🔒 Accès sécurisé</p>
                  </td>
                  <td align="center" style="padding:0 8px;border-left:1px solid #f0f0f0;">
                    <p style="margin:0;font-size:12px;color:#a1a1aa;">🚫 Aucun spam</p>
                  </td>
                  <td align="center" style="padding:0 8px;border-left:1px solid #f0f0f0;">
                    <p style="margin:0;font-size:12px;color:#a1a1aa;">🇫🇷 100% français</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:24px 40px;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4f46e5;">Accessa</p>
              <p style="margin:0 0 12px;font-size:12px;color:#a1a1aa;line-height:1.5;">
                Plateforme de conformité administrative intelligente pour TPE &amp; PME françaises.
              </p>
              <p style="margin:0;font-size:11px;color:#d4d4d8;">
                Cet email a été envoyé à ${email}. Vous recevez cet email car vous avez analysé votre entreprise sur Accessa.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`

    // ── Send via Resend ──────────────────────────────────────────────────────
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `${firstName ? firstName + ", votre" : "Votre"} rapport de conformité est prêt — Score ${score}/100`,
        html,
      }),
    })

    const resendResult = await response.json()

    if (!response.ok) {
      console.error("Resend error:", resendResult)
      throw new Error(`Resend error: ${resendResult.message || JSON.stringify(resendResult)}`)
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resendResult.id }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS }, status: 200 }
    )

  } catch (error) {
    console.error("Edge function error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS }, status: 400 }
    )
  }
})
