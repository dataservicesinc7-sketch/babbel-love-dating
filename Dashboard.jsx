import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/login')
      } else {
        setUser(user)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login')
      } else {
        setUser(session.user)
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
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white">
      {/* Header */}
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium hover:text-coral transition"
        >
          Log out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center pt-20">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Welcome!
          </h2>
          <p className="text-lg text-gray-300 mb-2">
            You are logged in as:
          </p>
          <p className="text-coral font-medium mb-8">
            {user?.email}
          </p>
          <p className="text-gray-400 text-sm">
            This is your temporary dashboard. Next we will build your profile page.
          </p>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
