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
      setProfile(profileData)

      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id)
      setPhotoCount(count || 0)

      setLoading(false)
    }
    load()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading...</p>
      </div>
    )
  }

  const profileReady = profile?.display_name && profile?.city && photoCount > 0

  return (
    <div className="min-h-screen bg-navy text-white pb-12">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <button onClick={handleLogout} className="text-sm hover:text-coral">
          Log out
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-semibold mb-2">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
        </h1>
        <p className="text-gray-400 mb-6">{user?.email}</p>

        <div className="bg-navy-light rounded-2xl p-6 mb-8 space-y-2">
          <p>City: {profile?.city || '—'}</p>
          <p>Goal: {profile?.relationship_goal || '—'}</p>
          <p>Photos: {photoCount}</p>
          <p>
            Status:{' '}
            {profileReady ? (
              <span className="text-green-400">Ready to discover people</span>
            ) : (
              <span className="text-yellow-400">Complete profile + add a photo</span>
            )}
          </p>
        </div>

        <div className="grid gap-4">
          <Link to="/profile" className="bg-coral hover:bg-coral-dark text-center py-3 rounded-xl font-medium">
            {profile ? 'Edit Profile' : 'Complete Profile'}
          </Link>
          <Link to="/discover" className="bg-navy-light hover:bg-gray-700 text-center py-3 rounded-xl font-medium">
            Discover People
          </Link>
          <Link to="/matches" className="bg-navy-light hover:bg-gray-700 text-center py-3 rounded-xl font-medium">
            My Matches
          </Link>
          <Link to="/safety" className="bg-navy-light hover:bg-gray-700 text-center py-3 rounded-xl font-medium">
            Safety Center
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
