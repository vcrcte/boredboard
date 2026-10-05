import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, artist, album, platform, token } = body

    const titleValue = title || 'Titre inconnu'

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 401 })

    // Mapping direct token → user_id
    const TOKEN_MAP: Record<string, string> = {
      'boredboard-victor-2026': 'bfd2c43a-f905-4abc-ba26-66379e25a342'
    }

    const userId = TOKEN_MAP[token]
    console.log('Token reçu:', token, 'userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
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

    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      type: 'musique',
      content: artist ? `J'écoute "${titleValue}" — ${artist}` : `J'écoute "${titleValue}"`,
      category: 'Musique',
      metadata: { title: titleValue, artist, album, platform: platform || 'apple-music' },
      likes_count: 0
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      message: `"${titleValue}" partagé sur BoredBoard ! 🎵`
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
