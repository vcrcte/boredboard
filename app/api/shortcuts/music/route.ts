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

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 401 })
    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })

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
      ? `J'écoute "${title}" — ${artist}` 
      : `J'écoute "${title}"`

    const post = {
      user_id: tokenData.user_id,
      type: 'musique',
      content,
      category: 'Musique',
      likes_count: 0
    }
    let { error } = await supabase.from('posts').insert({
      ...post,
      metadata: { title, artist, album, platform: platform || 'apple-music' }
    })
    // Until the posts.metadata column exists, publish without it.
    if (error && /metadata/i.test(error.message)) ({ error } = await supabase.from('posts').insert(post))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ 
      success: true,
      message: `"${title}" partagé sur BoredBoard ! 🎵`
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
