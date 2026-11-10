import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
    const accessToken = req.cookies.accessToken
    if (!accessToken) {
        const error = new Error('Access token is missing')
        error.statusCode = 401
        throw error
    }
    let decoded
    try{
        decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET)
    }catch(err) {
        const error = new Error('Session expired. Please log in again')
        error.statusCode = 401
        throw error
    }
    const user = await User.findById(decoded.id)
    if (!user) {
        const error = new Error('User no longer exists')
        error.statusCode = 401
        throw error
    }
    if (user.status === 'suspended') {
        const error = new Error(`Your account has been suspended.`)
        error.statusCode = 403
        throw error
    }
    req.user = user
    next()
}

export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            const error = new Error('You do not have permission to perform this action')
            error.statusCode = 403
            throw error
        }
        next()
    }
}
