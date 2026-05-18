import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const expected = Deno.env.get("WORKSITES_API_KEY");
  const provided = req.headers.get("x-api-key") ?? new URL(req.url).searchParams.get("api_key");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: worksites, error: wErr }, { data: placements, error: pErr }, { data: interns, error: iErr }] = await Promise.all([
      supabase.from("worksites").select("*"),
      supabase.from("placements").select("*"),
      supabase.from("interns").select("id, first_name, last_name, dob, student_email, email_submission, school, other_school, grade, status, is_newest").eq("is_newest", true),
    ]);

    if (wErr || pErr || iErr) {
      return new Response(JSON.stringify({ error: "Query failed", details: wErr?.message || pErr?.message || iErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const internsById = new Map((interns ?? []).map((i: any) => [i.id, i]));
    const byWorksite = new Map<string, any[]>();
    for (const p of placements ?? []) {
      const intern: any = internsById.get((p as any).intern_id);
      if (!intern) continue;
      const arr = byWorksite.get((p as any).worksite_id) ?? [];
      arr.push({
        intern_id: intern.id,
        first_name: intern.first_name,
        last_name: intern.last_name,
        dob: intern.dob,
        email: intern.student_email || intern.email_submission || null,
        school: intern.other_school || intern.school || null,
        grade: intern.grade,
        status: intern.status,
      });
      byWorksite.set((p as any).worksite_id, arr);
    }

    const result = (worksites ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      category: w.category,
      description: w.description,
      location: w.location,
      contact_name: w.contact_name,
      contact_email: w.contact_email,
      capacity: w.capacity,
      filled: w.filled,
      status: w.status,
      tags: w.tags,
      students: byWorksite.get(w.id) ?? [],
    }));

    return new Response(JSON.stringify({ worksites: result, generated_at: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});