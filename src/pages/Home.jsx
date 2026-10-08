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

        {/* SHARE BUTTON */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-400">Help grow the community – share Babbel Love Dating</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                const url = 'https://babbel-love-dating.pages.dev'
                const text = 'Join me on Babbel Love Dating – a safe dating community for every age and culture!'
                if (navigator.share) {
                  navigator.share({ title: 'Babbel Love Dating', text, url }).catch(() => {})
                } else {
                  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-6 rounded-full text-sm"
            >
              Share on WhatsApp
            </button>
            <button
              onClick={() => {
                const url = encodeURIComponent('https://babbel-love-dating.pages.dev')
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400')
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-full text-sm"
            >
              Share on Facebook
            </button>
            <button
              onClick={() => {
                const url = encodeURIComponent('https://babbel-love-dating.pages.dev')
                const text = encodeURIComponent('Join me on Babbel Love Dating – safe dating for every age & culture')
                window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400')
              }}
              className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 px-6 rounded-full text-sm"
            >
              Share on X
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://babbel-love-dating.pages.dev')
                alert('Link copied!')
              }}
              className="border border-gray-500 hover:border-coral text-gray-300 hover:text-coral font-medium py-2.5 px-6 rounded-full text-sm"
            >
              Copy link
            </button>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-400">
          Love knows no borders • Built for the world • 18+ only
        </p>
      </section>
