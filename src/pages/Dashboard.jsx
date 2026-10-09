import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      // Update last_seen so others can see we are online
      await supabase.from('profiles').upsert({
        id: user.id,
        last_seen: new Date().toISOString()
      }, { onConflict: 'id' })

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id)

      // Calculate total unread messages across all matches
      const { data: myMatches } = await supabase
        .from('matches')
        .select('id, profile_a, profile_b')
        .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)

      let total = 0
      for (const m of myMatches || []) {
        const otherId = m.profile_a === user.id ? m.profile_b : m.profile_a
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('sender_id', otherId)
          .eq('is_read', false)
        total += (c || 0)
      }

      setProfile(profileData)
      setPhotoCount(count || 0)
      setUnreadTotal(total)
      setLoading(false)
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) navigate('/login')
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p className="text-xl">Loading...</p>
      </div>
    )
  }

  const profileReady = profile?.display_name && profile?.city && photoCount > 0

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/" className="text-2xl md:text-3xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <button
          onClick={handleLogout}
          className="px-5 py-2 bg-coral hover:bg-coral-dark rounded-full text-sm font-medium transition"
        >
          Log out
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center pb-12">
        <div className="max-w-xl w-full">
          <h2 className="text-3xl md:text-4xl font-semibold mb-2">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h2>
          <p className="text-gray-300 mb-6">{user?.email}</p>

          <div className="bg-navy-light rounded-2xl p-6 text-left mb-8 space-y-2">
            <p><span className="text-gray-400">City:</span> {profile?.city || '—'}</p>
            <p><span className="text-gray-400">Goal:</span> {profile?.relationship_goal || '—'}</p>
            <p><span className="text-gray-400">Photos:</span> {photoCount}</p>
            <p>
              <span className="text-gray-400">Status:</span>{' '}
              {profileReady ? (
                <span className="text-green-400">Ready to discover people</span>
              ) : (
                <span className="text-yellow-400">Complete profile + add a photo</span>
              )}
            </p>
          </div>

          <div className="grid gap-3">
            <Link
              to="/profile"
              className="bg-coral hover:bg-coral-dark transition text-white font-medium py-3 px-8 rounded-full"
            >
              {profile ? 'Edit Profile' : 'Complete Profile'}
            </Link>
            <Link
              to="/discover"
              className="border border-coral text-coral hover:bg-coral hover:text-white transition font-medium py-3 px-8 rounded-full"
            >
              Discover People
            </Link>

            {/* MY MATCHES with clear notification icon + badge */}
            <Link
              to="/matches"
              className="relative border border-gray-500 hover:border-coral transition font-medium py-3 px-8 rounded-full flex items-center justify-center gap-3"
            >
              {/* Envelope icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              My Matches / Messages
              {unreadTotal > 0 && (
                <span className="absolute -top-2 -right-2 bg-coral text-white text-xs font-bold rounded-full min-w-[22px] h-5 px-1.5 flex items-center justify-center shadow">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </Link>

            <Link
              to="/safety"
              className="border border-gray-500 hover:border-coral transition font-medium py-3 px-8 rounded-full"
            >
              Safety Center
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
