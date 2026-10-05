import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, artist, album, platform, token } = body

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 401 })

    // Mapping direct token → user_id
    const TOKEN_MAP: Record<string, string> = {
      'boredboard-victor-2026': 'bfd2c43a-f905-4abc-ba26-66379e25a342'
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Tokens from the /raccourci page are stored as their SHA-256 in shortcut_tokens.
    let userId: string | undefined = TOKEN_MAP[token]
    if (!userId) {
      const hash = createHash('sha256').update(String(token)).digest('hex')
      const { data } = await supabase
        .from('shortcut_tokens')
        .select('user_id')
        .eq('token', hash)
        .maybeSingle()
      userId = data?.user_id
    }
    // Only the start of the token: Vercel keeps its logs, a full token is enough to post.
    console.log('Token reçu:', `${String(token).slice(0, 8)}…`, 'userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    let finalTitle = title || ''
    let finalArtist = artist || ''
    let finalMetadata: Record<string, unknown> = { title: finalTitle, artist: finalArtist, album, platform: platform || 'apple-music' }

    // Shared from Spotify, Deezer, YouTube or Apple Music: only a link arrives.
    // Some apps share text around the link ("Écoute X sur Spotify https://…"): keep the link only.
    const url = typeof body.url === 'string' ? (/https:\/\/\S+/.exec(body.url)?.[0] ?? null) : null

    if (url && !title) {
      try {
        // This deployment's own embed route (lib/music.ts format, read by the feed's player card).
        const embedRes = await fetch(`${new URL(request.url).origin}/api/music/embed?url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(5000)
        })
        if (embedRes.ok) {
          const embedData = await embedRes.json()
          finalTitle = embedData.title || 'Titre inconnu'
          finalArtist = ''
          finalMetadata = { ...embedData, url }
        }
      } catch (e) {
        console.log('Erreur oEmbed:', e)
      }
    }

    // A link was sent but not understood: say so instead of posting "Titre inconnu".
    if (body.url && !title && !finalMetadata.embed_url) {
      return NextResponse.json({ error: 'Lien non reconnu : partage un lien Spotify, Deezer, YouTube ou Apple Music' }, { status: 400 })
    }

    if (!finalTitle) finalTitle = 'Titre inconnu'

    // Artwork and Apple Music link from the iTunes Search API (free, no key),
    // for songs sent by name; a shared link already brings its cover.
    // A slow or failed lookup only leaves them out.
    if (title) {
      try {
        const searchRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(finalTitle + ' ' + finalArtist)}&media=music&country=FR&limit=1`,
          { signal: AbortSignal.timeout(3000) }
        )
        const searchData = await searchRes.json()
        finalMetadata.artwork = searchData.results?.[0]?.artworkUrl100?.replace('100x100', '300x300') || null
        finalMetadata.trackUrl = searchData.results?.[0]?.trackViewUrl || null
      } catch {
        // No artwork: the card shows its music icon.
      }
    }

    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      type: 'musique',
      content: finalArtist ? `J'écoute "${finalTitle}" — ${finalArtist}` : `J'écoute "${finalTitle}"`,
      url,
      category: 'Musique',
      metadata: finalMetadata,
      likes_count: 0
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      message: `"${finalTitle}" partagé sur BoredBoard ! 🎵`
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
