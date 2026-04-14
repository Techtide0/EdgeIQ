import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const LOGO_SLIDES = ['/edge-removebg-preview.png', '/edge.png']

function LogoSlider() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % LOGO_SLIDES.length), 3200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative mx-auto mb-2" style={{ width: 148, height: 148 }}>
      <AnimatePresence mode="wait">
        <motion.img
          key={index}
          src={LOGO_SLIDES[index]}
          alt="EdgeIQ logo"
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{    opacity: 0, scale: 1.06,  y: -10 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain', borderRadius: 20,
          }}
        />
      </AnimatePresence>

      {/* Dot indicators */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {LOGO_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Logo slide ${i + 1}`}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: i === index ? 'var(--accent)' : 'var(--border)',
              transition: 'width 0.3s ease, background 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Auth() {
  const { register, login, loginWithGoogle } = useAuth()
  const [mode, setMode]     = useState('login')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      if (mode === 'register') await register(email, pass)
      else                     await login(email, pass)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleGoogle() {
    setError(null); setLoading(true)
    try { await loginWithGoogle() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}>

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card w-full max-w-sm overflow-hidden">

        {/* Brand strip */}
        <div className="px-7 pt-8 pb-7 text-center">
          <LogoSlider />
          <p className="text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex mx-6 mb-5 p-1 rounded-xl" style={{ background: 'var(--surface2)' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null) }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative"
              style={{ border: 'none', cursor: 'pointer', color: mode === m ? 'var(--text)' : 'var(--text-muted)', background: 'transparent' }}>
              {mode === m && (
                <motion.div layoutId="auth-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--surface)', zIndex: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{m === 'login' ? 'Log in' : 'Register'}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-3">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type={show ? 'text' : 'password'} placeholder="Password" value={pass}
              onChange={e => setPass(e.target.value)} required
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button type="submit" disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="btn-primary justify-center py-2.5 mt-1 text-sm rounded-xl"
            style={{ width: '100%' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <motion.button type="button" onClick={handleGoogle} disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="btn-ghost justify-center py-2.5 text-sm rounded-xl"
            style={{ width: '100%' }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
