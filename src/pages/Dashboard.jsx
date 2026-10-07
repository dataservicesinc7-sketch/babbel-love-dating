import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      const { data } = await supabase
        .from('profiles')
        .select('display_name, city, relationship_goal')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(data)
      setLoading(false)
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login')
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
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </h1>
        <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium hover:text-coral transition">
          Log out
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-10 text-center">
        <h2 className="text-3xl font-semibold mb-2">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
        </h2>
        <p className="text-gray-300 mb-1">{user?.email}</p>
        {profile?.city && (
          <p className="text-gray-400 text-sm mb-8">
            {profile.city} · {profile.relationship_goal || 'Goal not set'}
          </p>
        )}

        <div className="grid gap-4 mt-8">
          <Link to="/profile" className="bg-coral hover:bg-coral-dark py-3 rounded-full font-medium">
            Edit Profile
          </Link>
          <Link to="/discover" className="border border-coral text-coral hover:bg-coral hover:text-white py-3 rounded-full font-medium transition">
            Discover People
          </Link>
          <Link to="/matches" className="border border-gray-500 hover:border-coral py-3 rounded-full font-medium transition">
            My Matches
          </Link>
          <Link to="/safety" className="border border-gray-500 hover:border-coral py-3 rounded-full font-medium transition">
            Safety Center
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
