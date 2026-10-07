import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Matches() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)

      const enriched = []
      for (const m of data || []) {
        const otherId = m.profile_a === user.id ? m.profile_b : m.profile_a
        const { data: p } = await supabase
          .from('profiles')
          .select('display_name, city')
          .eq('id', otherId)
          .maybeSingle()
        enriched.push({ ...m, other: p, otherId })
      }
      setMatches(enriched)
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-navy text-white"><p>Loading matches...</p></div>
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
          <p className="text-center text-gray-400">No matches yet. Go Discover and like people!</p>
        ) : (
          <div className="space-y-4">
            {matches.map(m => (
              <Link key={m.id} to={`/chat/${m.id}`}
                className="block bg-navy-light p-4 rounded-xl hover:bg-navy transition">
                <p className="font-medium text-lg">{m.other?.display_name || 'Someone'}</p>
                <p className="text-sm text-gray-400">{m.other?.city || ''}</p>
                <p className="text-coral text-sm mt-1">Open chat →</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Matches
