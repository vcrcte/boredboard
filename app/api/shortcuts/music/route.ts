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

    // TEMPORAIRE : mapping direct token → user_id, sans requête Supabase.
    // Keyed by the token's SHA-256: the repository is public, and the plain
    // token would let anyone post as this user.
    const TOKEN_MAP: Record<string, string> = {
      '02e92dbd34e9ee288708fb0b88f80452c725f26a01f6737decb4d96e0fe77df7': 'bfd2c43a-f905-4abc-ba26-66379e25a342'
    }

    const hash = createHash('sha256').update(String(token)).digest('hex')
    const userId = TOKEN_MAP[hash]
    console.log('Match trouvé:', userId ? 'oui' : 'non')

    if (!userId) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

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
