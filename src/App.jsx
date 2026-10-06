function App() {
  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 flex justify-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          <span className="text-coral">Babbel</span> Love Dating
        </h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-xl">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Where real conversations begin
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            A safe, welcoming space for every age, culture and love story.
            Built free. Built safe. Built for everyone.
          </p>

          <div className="inline-block bg-coral hover:bg-coral-dark transition-colors text-white font-medium py-3 px-8 rounded-full text-lg">
            Coming Soon
          </div>

          <p className="mt-10 text-sm text-gray-400">
            Currently in private development • Pilot launching first in Cameroon
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

export default App
