import { Link } from 'react-router-dom'

function Safety() {
  return (
    <div className="min-h-screen bg-navy text-white pb-12">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">Dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-6 text-center">Safety Center</h1>

        <section className="bg-navy-light p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-medium mb-3 text-coral">Dating Safety Tips</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            <li>Never send money, gift cards, or crypto to someone you meet online.</li>
            <li>Keep conversations on Babbel until you feel comfortable.</li>
            <li>Meet in public places for the first few dates.</li>
            <li>Tell a friend or family member where you are going.</li>
            <li>Trust your instincts – if something feels wrong, leave.</li>
          </ul>
        </section>

        <section className="bg-navy-light p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-medium mb-3 text-coral">How to Spot a Romance Scam</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            <li>They move the conversation to WhatsApp or email very quickly.</li>
            <li>They claim to be overseas, in the military, or working on an oil rig.</li>
            <li>They ask for money for an emergency, travel, or investment.</li>
            <li>Their photos look too perfect or you find the same photos online.</li>
            <li>They avoid video calls.</li>
          </ul>
        </section>

        <section className="bg-navy-light p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-medium mb-3 text-coral">Report & Block</h2>
          <p className="text-gray-200">
            On every profile you can Report or Block with one tap.
            Reports of minors, threats or scams are reviewed first.
          </p>
        </section>

        <section className="bg-navy-light p-6 rounded-2xl">
          <h2 className="text-xl font-medium mb-3 text-coral">Emergency Numbers (Cameroon)</h2>
          <p className="text-gray-200">
            Police: 117<br />
            Emergency services: 112 or 118
          </p>
          <p className="text-sm text-gray-400 mt-3">
            Always check local emergency numbers for your country.
          </p>
        </section>

        <div className="text-center mt-8">
          <Link to="/dashboard" className="text-coral underline">
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Safety
