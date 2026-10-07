import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: 'https://babbel-love-dating.pages.dev/login'
      }
    })

    if (error) {
      setIsError(true)
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (data?.user?.identities?.length === 0) {
      setIsError(true)
      setMessage('This email is already registered. Please log in or use a different email.')
    } else {
      setIsError(false)
      setMessage('Account created! Please check your email (and spam folder) and click the confirmation link. After confirming, come back here and log in.')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    if (!email) {
      setMessage('Please enter your email first')
      setIsError(true)
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: 'https://babbel-love-dating.pages.dev/login'
      }
    })
    if (error) {
      setIsError(true)
      setMessage(error.message)
    } else {
      setIsError(false)
      setMessage('Confirmation email resent. Check your inbox and spam folder.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold">
            <span className="text-coral">Babbel</span> Love Dating
          </Link>
        </div>

        <div className="bg-navy-light p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 text-center">Create your account</h2>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
                placeholder="At least 6 characters"
              />
            </div>

            {message && (
              <p className={`text-sm ${isError ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coral hover:bg-coral-dark py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full mt-3 text-sm text-gray-400 hover:text-coral underline"
          >
            Resend confirmation email
          </button>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-coral hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUp
