import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLastSeen } from '../lib/status'

function ageFromDob(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function Matches() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(null)

  useEffect(() => {
    let heartbeat

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      // Keep last_seen fresh
      await supabase.from('profiles').upsert({
        id: user.id,
        last_seen: new Date().toISOString()
      }, { onConflict: 'id' })

      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)

      const enriched = []
      let totalUnread = 0

      for (const m of data || []) {
        const otherId = m.profile_a === user.id ? m.profile_b : m.profile_a

        const { data: p } = await supabase
          .from('profiles')
          .select('display_name, city, date_of_birth, last_seen')
          .eq('id', otherId)
          .maybeSingle()

        const { data: photoRows } = await supabase
          .from('photos')
          .select('storage_path')
          .eq('profile_id', otherId)
          .order('sort_order')
          .limit(1)

        const photo = photoRows?.[0]?.storage_path
          ? supabase.storage.from('profile-photos').getPublicUrl(photoRows[0].storage_path).data.publicUrl
          : null

        // Last message
        const { data: lastMsgs } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('match_id', m.id)
          .order('created_at', { ascending: false })
          .limit(1)

        // Unread count for this match
        const { count: unread } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .neq('sender_id', user.id)
          .eq('is_read', false)

        totalUnread += (unread || 0)

        enriched.push({
          ...m,
          other: p,
          otherId,
          photo,
          lastMessage: lastMsgs?.[0] || null,
          unread: unread || 0
        })
      }

      // Sort by most recent message
      enriched.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0
        return tb - ta
      })

      setMatches(enriched)
      setUnreadTotal(totalUnread)
      setLoading(false)

      heartbeat = setInterval(() => {
        supabase.from('profiles').upsert({
          id: user.id,
          last_seen: new Date().toISOString()
        }, { onConflict: 'id' })
      }, 45000)
    }

    load()
    return () => {
      if (heartbeat) clearInterval(heartbeat)
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading messages...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <div className="flex items-center gap-4">
          {/* Envelope with total unread */}
          <div className="relative p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 bg-coral text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadTotal > 9 ? '9+' : unreadTotal}
              </span>
            )}
          </div>
          <Link to="/dashboard" className="text-sm hover:text-coral">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-6 text-center">Messages</h1>

        {matches.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p>No matches yet.</p>
            <Link to="/discover" className="inline-block mt-4 text-coral underline">Go Discover people</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => {
              const statusText = formatLastSeen(m.other?.last_seen)
              const isOnline = statusText === 'Online now'
              return (
                <Link
                  key={m.id}
                  to={`/chat/${m.id}`}
                  className="flex items-center gap-4 bg-navy-light p-4 rounded-xl hover:bg-navy transition relative"
                >
                  {m.photo ? (
                    <img src={m.photo} alt={m.other?.display_name} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center text-gray-500 text-xl">
                      ?
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-lg truncate">
                        {m.other?.display_name || 'Someone'}
                        {ageFromDob(m.other?.date_of_birth) ? `, ${ageFromDob(m.other.date_of_birth)}` : ''}
                      </p>
                      {m.unread > 0 && (
                        <span className="bg-coral text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                          {m.unread}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                      {statusText}
                    </p>
                    {m.lastMessage && (
                      <p className="text-sm text-gray-400 truncate mt-0.5">
                        {m.lastMessage.sender_id === me?.id ? 'You: ' : ''}
                        {m.lastMessage.content}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default Matches
