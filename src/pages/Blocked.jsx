import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Blocked() {
  const navigate = useNavigate()
  const [blockedList, setBlockedList] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [me, setMe] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false })

      const enriched = []
      for (const b of blocks || []) {
        const { data: p } = await supabase
          .from('profiles')
          .select('display_name, city, gender, date_of_birth')
          .eq('id', b.blocked_id)
          .maybeSingle()

        const { data: photoRows } = await supabase
          .from('photos')
          .select('storage_path')
          .eq('profile_id', b.blocked_id)
          .order('sort_order')
          .limit(1)

        const photo = photoRows?.[0]?.storage_path
          ? supabase.storage.from('profile-photos').getPublicUrl(photoRows[0].storage_path).data.publicUrl
          : null

        enriched.push({
          ...b,
          profile: p,
          photo
        })
      }
      setBlockedList(enriched)
      setLoading(false)
    }
    load()
  }, [navigate])

  const unblock = async (blockId, name) => {
    if (!confirm(`Unblock ${name || 'this person'}? They will be able to see and message you again if you match.`)) return

    const { error } = await supabase.from('blocks').delete().eq('id', blockId)
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }
    setBlockedList(prev => prev.filter(b => b.id !== blockId))
    setMessage(`${name || 'User'} has been unblocked.`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading blocked list...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-10">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">Dashboard</Link>
      </header>

      <main className="max-w-xl mx-auto px-4">
        <h1 className="text-3xl font-semibold mb-2 text-center">Blocked People</h1>
        <p className="text-center text-gray-400 text-sm mb-6">
          People you blocked cannot see your profile or message you. Unblock anytime.
        </p>

        {message && (
          <p className="text-center text-sm text-green-400 mb-4">{message}</p>
        )}

        {blockedList.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p>You have not blocked anyone.</p>
            <Link to="/discover" className="inline-block mt-4 text-coral underline">Go to Discover</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {blockedList.map((b) => (
              <div key={b.id} className="flex items-center gap-4 bg-navy-light p-4 rounded-xl">
                {b.photo ? (
                  <img src={b.photo} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center text-gray-500">
                    ?
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {b.profile?.display_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-400 capitalize">
                    {b.profile?.gender || '—'} · {b.profile?.city || ''}
                  </p>
                </div>
                <button
                  onClick={() => unblock(b.id, b.profile?.display_name)}
                  className="px-4 py-2 border border-coral text-coral rounded-full text-sm hover:bg-coral hover:text-white transition"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Blocked
