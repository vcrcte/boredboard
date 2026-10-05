import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const { title, artist, album, platform, token } = body

    // Debug: the token is cut short so the server logs never hold a usable one.
    console.log('SERVICE_ROLE exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('Token reçu:', token ? `${String(token).slice(0, 8)}… (${String(token).length} caractères)` : token)

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 401 })
    // A Shortcut run while nothing plays sends an empty (or non-text) title: share anyway.
    const titleValue = (typeof title === 'string' && title.trim()) || 'Titre inconnu'

    // Tokens from /raccourci (and the downloaded Shortcut) are stored as their
    // SHA-256; one typed into the table by hand is stored as is.
    const hash = createHash('sha256').update(String(token)).digest('hex')
    const { data: tokenData, error: tokenError } = await supabase
      .from('shortcut_tokens')
      .select('user_id')
      .in('token', [hash, token])
      .limit(1)
      .maybeSingle()

    if (tokenError || !tokenData) {
      return NextResponse.json({ 
        error: `Token invalide`,
        debug: tokenError?.message
      }, { status: 401 })
    }

    const content = artist 
      ? `J'écoute "${titleValue}" — ${artist}` 
      : `J'écoute "${titleValue}"`

    const post = {
      user_id: tokenData.user_id,
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
