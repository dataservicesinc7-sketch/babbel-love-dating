import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      // Load profile if it exists
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    loadData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login')
      }
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

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      {/* Header */}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h2>

          <p className="text-lg text-gray-300 mb-2">Logged in as:</p>
          <p className="text-coral text-xl font-medium mb-8">{user?.email}</p>

          {profile ? (
            <div className="bg-navy-light p-6 rounded-2xl text-left mb-8">
              <p><span className="text-gray-400">City:</span> {profile.city || '—'}</p>
              <p><span className="text-gray-400">Looking for:</span> {profile.looking_for || '—'}</p>
              <p><span className="text-gray-400">Goal:</span> {profile.relationship_goal || '—'}</p>
            </div>
          ) : (
            <p className="text-gray-400 mb-8">
              You have not completed your profile yet.
            </p>
          )}

          <Link
            to="/profile"
            className="inline-block bg-coral hover:bg-coral-dark transition-colors text-white font-medium py-3 px-8 rounded-full text-lg"
          >
            {profile ? 'Edit Profile' : 'Complete Your Profile'}
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
