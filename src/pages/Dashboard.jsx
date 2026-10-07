import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [photoCount, setPhotoCount] = useState(0)
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

      setProfile(profileData)
      setPhotoCount(count || 0)
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
            <Link
              to="/matches"
              className="border border-gray-500 hover:border-coral transition font-medium py-3 px-8 rounded-full"
            >
              My Matches
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
