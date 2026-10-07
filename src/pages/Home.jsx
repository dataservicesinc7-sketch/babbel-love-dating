import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </h1>
        <div className="flex gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium hover:text-coral transition"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2 bg-coral hover:bg-coral-dark rounded-full text-sm font-medium transition"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Where real conversations begin
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            A safe, welcoming space for every age, culture and love story.
            Built free. Built safe. Built for everyone.
          </p>

          <Link
            to="/signup"
            className="inline-block bg-coral hover:bg-coral-dark transition-colors text-white font-medium py-3 px-8 rounded-full text-lg"
          >
            Get Started
          </Link>

          <p className="mt-10 text-sm text-gray-400">
            Pilot launching first in Cameroon • 18+ only
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        © 2026 Babbel Love Dating
      </footer>
    </div>
  )
}

export default Home
