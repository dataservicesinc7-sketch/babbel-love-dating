import { Link } from 'react-router-dom'
import { useEffect } from 'react'

const faqs = [
  {
    q: 'Is Babbel Love Dating free?',
    a: 'Yes. Creating a profile, discovering people, matching and chatting is completely free while we grow. Safety tools (report & block) are also free and never locked behind payment.'
  },
  {
    q: 'Who can join?',
    a: 'Adults 18 and older from every age group, race, culture and background. We especially welcome African, diaspora, senior and intercultural users who want genuine connections.'
  },
  {
    q: 'Is the platform safe?',
    a: 'Safety is our top priority. You can report or block any profile with one tap. We have a full Safety Center with scam warnings and practical tips. Never send money to someone you meet online.'
  },
  {
    q: 'How does matching work?',
    a: 'Browse people in Discover, like someone you like. If they like you back, it becomes a match and you can start a private chat. Simple and respectful.'
  },
  {
    q: 'Do I need to pay to message or see who likes me?',
    a: 'No. Core features stay free. We believe safety and basic connection should never be paywalled.'
  },
  {
    q: 'Is it only for Cameroon or Africa?',
    a: 'No. The platform is global and designed for every culture. Many early members are from Cameroon and the African diaspora, but people from all countries are welcome.'
  },
  {
    q: 'What if someone is rude or tries to scam me?',
    a: 'Use the Report or Block buttons immediately. Reports of scams, threats or minors are reviewed first. You can also read our Safety Center for common red flags.'
  },
  {
    q: 'Can seniors and people over 50 join?',
    a: 'Absolutely. We built Babbel Love Dating for every age – from young adults to seniors. Everyone is welcome.'
  },
  {
    q: 'Do you sell my data?',
    a: 'No. We do not sell personal data. Your profile and messages stay private between you and the people you choose to connect with.'
  },
  {
    q: 'How do I delete my account?',
    a: 'You can contact support or use the options in your profile settings. We respect your right to leave whenever you want.'
  }
]

function Faq() {
  useEffect(() => {
    // Add FAQ structured data for Google
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a
        }
      }))
    })
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-navy text-white pb-16">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/safety" className="hover:text-coral">Safety</Link>
          <Link to="/dashboard" className="hover:text-coral">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-center text-gray-300 mb-10">
          Clear answers about safety, how the platform works, and who can join.
        </p>

        <div className="space-y-4">
          {faqs.map((item, index) => (
            <div key={index} className="bg-navy-light rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-coral mb-2">{item.q}</h2>
              <p className="text-gray-200 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 space-y-4">
          <p className="text-gray-300">Still have questions?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/safety"
              className="bg-navy-light hover:bg-coral/20 border border-coral text-coral font-medium py-2.5 px-6 rounded-full transition"
            >
              Visit Safety Center
            </Link>
            <Link
              to="/signup"
              className="bg-coral hover:bg-coral-dark text-white font-medium py-2.5 px-6 rounded-full transition"
            >
              Join free today
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Faq
