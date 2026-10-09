import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [primaryPhoto, setPrimaryPhoto] = useState(null)
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id)

      // Primary photo (lowest sort_order)
      const { data: photoRows } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('profile_id', user.id)
        .order('sort_order')
        .limit(1)

      if (photoRows && photoRows.length > 0) {
        setPrimaryPhoto(
          supabase.storage.from('profile-photos').getPublicUrl(photoRows[0].storage_path).data.publicUrl
        )
      }

      const { data: myMatches } = await supabase
        .from('matches')
        .select('id, profile_a, profile_b')
        .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)

      let totalUnread = 0
      for (const m of myMatches || []) {
        const otherId = m.profile_a === user.id ? m.profile_b : m.profile_a
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('sender_id', otherId)
          .eq('is_read', false)
        totalUnread += c || 0
      }

      setProfile(profileData)
      setPhotoCount(count || 0)
      setUnreadTotal(totalUnread)
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
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </h1>
        <button
          onClick={handleLogout}
          className="px-5 py-2 bg-coral hover:bg-coral-dark rounded-full text-sm font-medium transition"
        >
          Log out
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center pb-12">
        <div className="max-w-xl w-full">
          {primaryPhoto && (
            <img
              src={primaryPhoto}
              alt="Your profile"
              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-coral"
            />
          )}
          <h2 className="text-3xl md:text-4xl font-semibold mb-2">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h2>
          <p className="text-gray-300 mb-6">{user?.email}</p>

          <div className="bg-navy-light rounded-2xl p-6 text-left mb-8 space-y-2">
            <p><span className="text-gray-400">City:</span> {profile?.city || '—'}</p>
            <p><span className="text-gray-400">Gender:</span> <span className="capitalize">{profile?.gender || '—'}</span></p>
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
            <Link
              to="/matches"
              className="relative border border-gray-500 hover:border-coral transition font-medium py-3 px-8 rounded-full"
            >
              My Matches
              {unreadTotal > 0 && (
                <span className="absolute -top-2 -right-2 bg-coral text-white text-xs font-bold rounded-full min-w-[22px] h-5 px-1.5 flex items-center justify-center">
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
