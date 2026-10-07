import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
      } else {
        setUser(user)
      }
      setLoading(false)
    }

    checkUser()

    // Listen for logout
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
            Welcome!
          </h2>
          <p className="text-lg text-gray-300 mb-2">
            You are logged in as:
          </p>
          <p className="text-coral text-xl font-medium mb-8">
            {user?.email}
          </p>
          <p className="text-gray-400">
            This is your temporary dashboard.<br />
            Next we will build the profile page.
          </p>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
