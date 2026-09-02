import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://pcyrqifourjwirwfhiwe.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8Nlj9kEnB-Rj_nsxnv_YQg_poT8S9GH'
export const GOOGLE_WEB_CLIENT_ID = '376420281293-agemocfufrdhc4146oomksnpjf9mkngu.apps.googleusercontent.com'

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

let googleIdentityPromise

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (googleIdentityPromise) return googleIdentityPromise

  googleIdentityPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-usecrm-google-identity]')
    const script = existing || document.createElement('script')

    const onReady = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('Google Sign-In could not be loaded.'))
    }

    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => reject(new Error('Google Sign-In could not be loaded.')), { once: true })

    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.usecrmGoogleIdentity = 'true'
      document.head.appendChild(script)
    }

    setTimeout(() => {
      if (!window.google?.accounts?.id) reject(new Error('Google Sign-In timed out. Please try again.'))
    }, 12000)
  })

  return googleIdentityPromise
}

async function signInWithBrandedGoogle() {
  try {
    const google = await loadGoogleIdentity()

    return await new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', 'Sign in to useCRM')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(2,10,5,.72);backdrop-filter:blur(8px);padding:20px;'

      const card = document.createElement('div')
      card.style.cssText = 'width:min(390px,100%);background:#0b1710;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.5);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'

      const title = document.createElement('div')
      title.textContent = 'Sign in to useCRM'
      title.style.cssText = 'font-size:22px;font-weight:750;margin-bottom:8px;'

      const copy = document.createElement('div')
      copy.textContent = 'Choose your Google account to continue securely.'
      copy.style.cssText = 'font-size:14px;line-height:1.5;color:rgba(255,255,255,.68);margin-bottom:22px;'

      const buttonHost = document.createElement('div')
      buttonHost.style.cssText = 'display:flex;justify-content:center;min-height:44px;'

      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = 'Cancel'
      cancel.style.cssText = 'width:100%;margin-top:14px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(255,255,255,.72);cursor:pointer;font:inherit;'

      card.append(title, copy, buttonHost, cancel)
      overlay.appendChild(card)
      document.body.appendChild(overlay)

      let settled = false
      const finish = (result) => {
        if (settled) return
        settled = true
        overlay.remove()
        resolve(result)
      }

      cancel.addEventListener('click', () => finish({ data: null, error: new Error('Google sign-in cancelled.') }))
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish({ data: null, error: new Error('Google sign-in cancelled.') })
      })

      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        context: 'signin',
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          if (!response?.credential) {
            finish({ data: null, error: new Error('Google did not return a sign-in credential.') })
            return
          }

          const result = await client.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
          })
          finish(result)
        },
      })

      google.accounts.id.renderButton(buttonHost, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320,
      })
    })
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Google sign-in failed.') }
  }
}

const originalSignInWithOAuth = client.auth.signInWithOAuth.bind(client.auth)
client.auth.signInWithOAuth = (credentials) => {
  if (credentials?.provider === 'google') return signInWithBrandedGoogle()
  return originalSignInWithOAuth(credentials)
}

export const supabase = client
