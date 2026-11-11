import bcrypt from 'bcrypt'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import crypto from 'crypto'
dotenv.config()

export const registerUser = async (req, res) => {
    const { name, email, password, phone, city, address} = req.body
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() })
    if (existingUser) {
        const error = new Error('User already exists')
        error.statusCode = 409
        throw error
    }
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
        city,
        address,
        role : 'user'
    })
    res.status(201).json({ status: 'success', message: 'User registered successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role, city: user.city } })
}
export const login = async (req, res) => {
    const { email, password } = req.body
    
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
    if (!user) {
        const error = new Error('Invalid email or password')
        error.statusCode = 401
        throw error
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
        const error = new Error('Invalid email or password')
        error.statusCode = 401
        throw error
    }
    if (user.status === 'suspended') {
        const error = new Error(`Your account has been suspended.`)
        error.statusCode = 403
        throw error
    }
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })
    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await user.save()

    const isProduction = process.env.NODE_ENV === 'production'

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    })

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    })


    res.status(200).json({ status: 'success', message: 'Login successful', user: { id: user._id, name: user.name, email: user.email, role: user.role, city: user.city } })
}
export const refresh = async (req, res) => {
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) {
        const error = new Error('Please log in again')
        error.statusCode = 401
        throw error
    }
    let decoded
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)
    } catch (err) {
        const error = new Error("Session expired. Please log in again")
        error.statusCode = 401
        throw error
    }
    const user = await User.findById(decoded.id).select('+refreshToken')
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex')
    if (!user || user.refreshToken !== hashedToken) {
        const error = new Error('Session expired. Please log in again')
        error.statusCode = 401
        throw error
    }
    if (user.status === 'suspended') {
        const error = new Error(`Your account has been suspended.`)
        error.statusCode = 403
        throw error
    }
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' })
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    })
    res.status(200).json({ status: 'success', message: 'Access token refreshed successfully' })
}
export const logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken
    if (refreshToken) {
        const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex')
        await User.findOneAndUpdate({ refreshToken: hashedToken }, { refreshToken: null })
    }
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    }
    res.clearCookie('accessToken', cookieOptions)
    res.clearCookie('refreshToken', cookieOptions)
    res.status(200).json({ status: 'success', message: 'Logged out successfully' })
}
export const getMe = async (req, res) => {
    res.status(200).json({ status: 'success', user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role, city: req.user.city, address: req.user.address, phone: req.user.phone } })
}
