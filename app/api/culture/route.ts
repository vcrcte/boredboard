import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * GET /api/culture
 * ?mode=today        → sujet du jour
 * ?mode=archive      → tous les sujets publiés (paginé)
 * ?mode=topic&slug=x → un sujet par slug
 * ?category=Science  → filtrer par catégorie
 * ?page=1&limit=12   → pagination
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "today";
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "12")));

  try {
    if (mode === "today") {
      const { data, error } = await supabase
        .from("daily_topics")
        .select("*")
        .lte("publish_date", new Date().toISOString().split("T")[0])
        .order("publish_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ topic: data }, { headers: cache(300) });
    }

    if (mode === "topic") {
      const slug = searchParams.get("slug");
      if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
      const { data, error } = await supabase
        .from("daily_topics")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

      // Increment views
      await supabase.rpc("increment_views", { topic_id: data.id }).catch(() => {});

      return NextResponse.json({ topic: data }, { headers: cache(600) });
    }

    if (mode === "categories") {
      const { data, error } = await supabase
        .from("daily_topics")
        .select("category")
        .lte("publish_date", new Date().toISOString().split("T")[0]);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: { category: string }) => {
        counts[r.category] = (counts[r.category] ?? 0) + 1;
      });
      return NextResponse.json({ categories: counts }, { headers: cache(3600) });
    }

    // mode === "archive"
    let query = supabase
      .from("daily_topics")
      .select("id, title, slug, summary, category, publish_date, reading_time_min, difficulty, likes_count, tags, fun_fact", { count: "exact" })
      .lte("publish_date", new Date().toISOString().split("T")[0])
      .order("publish_date", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category) query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json(
      { topics: data, total: count, page, limit },
      { headers: cache(300) }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function cache(seconds: number) {
  return { "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds * 2}` };
}
