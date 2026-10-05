import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { title, artist, album, platform, token } = body

    // Debug: the token is cut short so the server logs never hold a usable one.
    const shortToken = token ? `${String(token).slice(0, 8)}… (${String(token).length} caractères)` : token
    console.log('=== SHORTCUTS DEBUG ===')
    console.log('Body reçu:', JSON.stringify({ ...body, token: shortToken }))
    console.log('Token reçu:', shortToken)
    console.log('SERVICE_KEY présente:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 401 })
    // A Shortcut run while nothing plays sends an empty (or non-text) title: share anyway.
    const titleValue = (typeof title === 'string' && title.trim()) || 'Titre inconnu'

    // Debug: every stored token is compared here, but none is ever logged or
    // returned: this route is public, and a token is enough to post as its owner.
    // Tokens from /raccourci are stored as their SHA-256; one typed into the
    // table by hand is stored as is.
    const hash = createHash('sha256').update(String(token)).digest('hex')
    const { data: allTokens, error: tokenError } = await supabase
      .from('shortcut_tokens')
      .select('token, user_id')

    const formats = (allTokens ?? []).map((row) => (/^[0-9a-f]{64}$/.test(row.token) ? 'empreinte' : 'texte'))
    const matchedToken = allTokens?.find((row) => row.token === token || row.token === hash)

    console.log('Tokens en base:', allTokens?.length ?? 0, JSON.stringify(formats))
    console.log('Token cherché:', shortToken)
    console.log('Match trouvé:', matchedToken ? `oui (${matchedToken.token === hash ? 'empreinte' : 'texte'})` : 'non')

    if (tokenError || !matchedToken) {
      return NextResponse.json({
        error: 'Token invalide',
        debug: {
          tokenRecu: shortToken,
          tokensEnBase: allTokens?.length ?? 0,
          formatsEnBase: formats,
          erreurSupabase: tokenError?.message ?? null
        }
      }, { status: 401 })
    }

    // Uses the user_id found
    const userId = matchedToken.user_id

    const content = artist 
      ? `J'écoute "${titleValue}" — ${artist}` 
      : `J'écoute "${titleValue}"`

    const post = {
      user_id: userId,
      type: 'musique',
      content,
      category: 'Musique',
      likes_count: 0
    }
    let { error } = await supabase.from('posts').insert({
      ...post,
      metadata: { title: titleValue, artist, album, platform: platform || 'apple-music' }
    })
    // Until the posts.metadata column exists, publish without it.
    if (error && /metadata/i.test(error.message)) ({ error } = await supabase.from('posts').insert(post))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ 
      success: true,
      message: `"${titleValue}" partagé sur BoredBoard ! 🎵`
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
