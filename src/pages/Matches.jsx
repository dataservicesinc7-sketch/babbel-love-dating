import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function ageFromDob(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function Matches() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)

      const enriched = []
      for (const m of data || []) {
        const otherId = m.profile_a === user.id ? m.profile_b : m.profile_a

        const { data: p } = await supabase
          .from('profiles')
          .select('display_name, city, date_of_birth')
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

        // Count unread messages from the other person
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('sender_id', otherId)
          .eq('is_read', false)

        enriched.push({
          ...m,
          other: p,
          otherId,
          photo,
          unread: unreadCount || 0
        })
      }
      setMatches(enriched)
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading matches...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">Dashboard</Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-6 text-center">Your Matches</h1>

        {matches.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p>No matches yet.</p>
            <Link to="/discover" className="inline-block mt-4 text-coral underline">Go Discover people</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <Link
                key={m.id}
                to={`/chat/${m.id}`}
                className="flex items-center gap-4 bg-navy-light p-4 rounded-xl hover:bg-navy transition relative"
              >
                {m.photo ? (
                  <img src={m.photo} alt={m.other?.display_name} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center text-gray-500 text-xl">
                    ?
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="font-medium text-lg">
                    {m.other?.display_name || 'Someone'}
                    {ageFromDob(m.other?.date_of_birth) ? `, ${ageFromDob(m.other.date_of_birth)}` : ''}
                  </p>
                  <p className="text-sm text-gray-400">{m.other?.city || ''}</p>
                </div>

                {/* Unread badge */}
                {m.unread > 0 && (
                  <span className="absolute top-3 right-3 bg-coral text-white text-xs font-bold rounded-full min-w-[22px] h-5.5 px-1.5 flex items-center justify-center">
                    {m.unread > 99 ? '99+' : m.unread}
                  </span>
                )}

                <span className="text-coral text-sm">Chat →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Matches
