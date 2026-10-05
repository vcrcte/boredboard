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

    const { data: tokenData, error: tokenError } = await supabase
      .from('shortcut_tokens')
      .select('user_id')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ 
        error: `Token invalide`,
        debug: tokenError?.message
      }, { status: 401 })
    }

    const content = artist 
      ? `J'écoute "${title}" — ${artist}` 
      : `J'écoute "${title}"`

    const { error } = await supabase.from('posts').insert({
      user_id: tokenData.user_id,
      type: 'musique',
      content,
      category: 'Musique',
      metadata: { title, artist, album, platform: platform || 'apple-music' },
      likes_count: 0
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ 
      success: true,
      message: `"${title}" partagé sur BoredBoard ! 🎵`
    })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
