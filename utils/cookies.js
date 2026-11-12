const isProduction = () => process.env.NODE_ENV === 'production'

// In production the frontend and backend are on different domains, so cookies
// must be SameSite=None and Secure to be sent at all. Locally, Lax over http.
export const cookieOptions = () => ({
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax'
})

export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000
