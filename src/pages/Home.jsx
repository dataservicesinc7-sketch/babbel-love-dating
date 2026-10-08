import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const slides = [
  {
    url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1400&q=80',
    caption: 'Real connections for every age and culture'
  },
  {
    url: 'https://images.unsplash.com/photo-1516589178581-6e17779a4003?auto=format&fit=crop&w=1400&q=80',
    caption: 'Happy people finding love across the world'
  },
  {
    url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1400&q=80',
    caption: 'Beautiful smiles from every background'
  },
  {
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1400&q=80',
    caption: 'Women and men who value honesty'
  },
  {
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1400&q=80',
    caption: 'Genuine people looking for real conversations'
  },
  {
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=80',
    caption: 'Love has no age, colour or border'
  }
]

function Home() {
  const [current, setCurrent] = useState(0)
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // Keep the beautiful auto-slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Check if user is still logged in (never logs anyone out)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setChecking(false)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      {/* FRIENDLY NAVIGATION – now auth-aware */}
      <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur border-b border-navy-light">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl md:text-3xl font-bold">
            <span className="text-coral">Babbel</span> Love Dating
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#how-it-works" className="hover:text-coral transition">How it works</a>
            <a href="#why-us" className="hover:text-coral transition">Why us</a>
            <Link to="/safety" className="hover:text-coral transition">Safety</Link>

            {checking ? null : user ? (
              <Link to="/dashboard" className="bg-coral hover:bg-coral-dark px-5 py-2 rounded-full transition">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hover:text-coral transition">Log in</Link>
                <Link to="/signup" className="bg-coral hover:bg-coral-dark px-5 py-2 rounded-full transition">
                  Sign up free
                </Link>
              </>
            )}
          </nav>

          {/* Mobile */}
          <div className="flex md:hidden gap-2">
            {checking ? null : user ? (
              <Link to="/dashboard" className="bg-coral px-4 py-1.5 rounded-full text-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-3 py-1.5 text-sm">Log in</Link>
                <Link to="/signup" className="bg-coral px-4 py-1.5 rounded-full text-sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SLIDER – fully restored */}
      <section className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === current ? 'opacity-100' : 'opacity-0'}`}
          >
            <img src={slide.url} alt={slide.caption} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-transparent" />
          </div>
        ))}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            Where real conversations begin
          </h1>
          <p className="text-lg md:text-2xl text-gray-200 max-w-2xl mb-8">
            A safe, welcoming dating community for every age, culture and love story.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <Link to="/dashboard" className="bg-coral hover:bg-coral-dark text-white font-semibold py-3 px-10 rounded-full text-lg transition shadow-lg">
                Go to your Dashboard
              </Link>
            ) : (
              <Link to="/signup" className="bg-coral hover:bg-coral-dark text-white font-semibold py-3 px-10 rounded-full text-lg transition shadow-lg">
                Join free today
              </Link>
            )}
            <a href="#how-it-works" className="border-2 border-white hover:bg-white hover:text-navy font-semibold py-3 px-10 rounded-full text-lg transition">
              See how it works
            </a>
          </div>
        </div>

        <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-20 text-2xl">‹</button>
        <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-20 text-2xl">›</button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`w-3 h-3 rounded-full ${i === current ? 'bg-coral' : 'bg-white/50'}`} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How <span className="text-coral">Babbel Love Dating</span> works</h2>
          <p className="text-gray-300 text-lg mb-12 max-w-2xl mx-auto">Simple, honest and respectful – designed so anyone can feel at home.</p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-navy-light rounded-2xl p-8">
              <div className="text-4xl font-bold text-coral mb-4">1</div>
              <h3 className="text-xl font-semibold mb-3">Create your profile</h3>
              <p className="text-gray-300">Tell us who you are, add photos and interests. It takes less than 5 minutes.</p>
            </div>
            <div className="bg-navy-light rounded-2xl p-8">
              <div className="text-4xl font-bold text-coral mb-4">2</div>
              <h3 className="text-xl font-semibold mb-3">Discover & match</h3>
              <p className="text-gray-300">Browse people. Like someone. When they like you back – it’s a match!</p>
            </div>
            <div className="bg-navy-light rounded-2xl p-8">
              <div className="text-4xl font-bold text-coral mb-4">3</div>
              <h3 className="text-xl font-semibold mb-3">Chat safely</h3>
              <p className="text-gray-300">Start a private conversation. Report or block anytime. Safety first.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="why-us" className="py-16 md:py-24 px-4 bg-navy-light">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Why Babbel Love Dating is different</h2>
          <p className="text-center text-gray-300 text-lg mb-12 max-w-2xl mx-auto">Built for real people who want genuine connection.</p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'For every age', text: 'From 18 to 99+. Young adults, midlife, seniors – everyone is welcome.' },
              { title: 'All races & cultures', text: 'Designed for African, European, Asian, diaspora and mixed communities.' },
              { title: 'Safety first', text: 'Report, block, scam warnings and a full Safety Center. Never locked behind payment.' },
              { title: 'Honest & simple', text: 'No fake tricks. Clear profiles, clear goals, real conversations.' },
              { title: 'Works on any phone', text: 'Lightweight design that works even on slow connections.' },
              { title: 'Free to start', text: 'Create profile, discover and chat completely free while we grow.' }
            ].map((item, i) => (
              <div key={i} className="bg-navy rounded-2xl p-6 flex gap-4">
                <div className="text-coral text-2xl font-bold">✓</div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                  <p className="text-gray-300 text-sm">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to meet someone real?</h2>
        <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">Join people who want genuine connection. It only takes a few minutes.</p>
        {user ? (
          <Link to="/dashboard" className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold py-4 px-12 rounded-full text-lg transition shadow-lg">
            Go to your Dashboard
          </Link>
        ) : (
          <Link to="/signup" className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold py-4 px-12 rounded-full text-lg transition shadow-lg">
            Create your free account
          </Link>
        )}
        <p className="mt-6 text-sm text-gray-400">18+ only · Pilot in Cameroon · Global vision</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-navy-light py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <div>© 2026 Babbel Love Dating. Built free. Built safe. Built for everyone.</div>
          <div className="flex gap-6">
            <Link to="/safety" className="hover:text-coral">Safety Center</Link>
            {user ? (
              <Link to="/dashboard" className="hover:text-coral">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="hover:text-coral">Log in</Link>
                <Link to="/signup" className="hover:text-coral">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
