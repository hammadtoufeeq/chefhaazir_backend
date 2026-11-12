import crypto from 'crypto'
import mongoose from 'mongoose'
import { chefListQuerySchema } from '../zod-validator/chef_zod_schema.js'
import { getPaymentBlockedChefIds, isChefPaymentBlocked } from '../utils/payments.js'
import ChefProfile from '../models/ChefProfile.js'
import Booking from '../models/Booking.js'
import bcrypt from 'bcrypt'
import User from '../models/User.js'

export const registerChef = async (req, res) => {
    const { name, email, password, phone, city, address, cuisines, ratePerSlot, bio } = req.body

    const existingUser = await User.findOne({ email })
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
        role: 'chef'
    })

    let profile
    try {
        profile = await ChefProfile.create({
            user: user._id,
            city,
            address,
            cuisines,
            ratePerSlot,
            bio
        })
    } catch (err) {
        await User.findByIdAndDelete(user._id)
        const error = new Error('Could not create chef profile. Please try again')
        error.statusCode = 500
        throw error
    }

    res.status(201).json({
        status: 'success',
        message: 'Chef registered successfully. Your profile is pending approval',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        profile: {
            city: profile.city,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            approvalStatus: profile.approvalStatus
        }
    })
}
export const getMyProfile = async (req, res) => {
    const profile = await ChefProfile.findOne({ user: req.user._id })
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    res.status(200).json({
        status: 'success',
        profile: {
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            city: profile.city,
            address: profile.address,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio,
            phoneVerified: profile.phoneVerified,
            contractAccepted: !!profile.contractAcceptedAt,
            approvalStatus: profile.approvalStatus
        }
    })
}
export const updateMyProfile = async (req, res) => {
    const profile = await ChefProfile.findOne({ user: req.user._id })
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    // A chef cannot move city while a confirmed booking is still ahead in the old city
    if (req.body.city && req.body.city !== profile.city) {
        const upcoming = await Booking.exists({ chef: req.user._id, status: 'confirmed', slotEnd: { $gt: new Date() } })
        if (upcoming) {
            const error = new Error('You have upcoming confirmed bookings. Complete or cancel them before changing your city')
            error.statusCode = 409
            throw error
        }
    }

    Object.assign(profile, req.body)
    await profile.save()

    res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        profile: {
            city: profile.city,
            address: profile.address,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio
        }
    })
}
export const acceptContract = async (req, res) => {
    const profile = await ChefProfile.findOne({ user: req.user._id })
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    if (profile.contractAcceptedAt && profile.declarationAcceptedAt) {
        const error = new Error('You have already accepted the contract')
        error.statusCode = 400
        throw error
    }

    const now = new Date()
    profile.contractAcceptedAt = now
    profile.declarationAcceptedAt = now
    await profile.save()

    res.status(200).json({
        status: 'success',
        message: 'Contract and declaration accepted',
        acceptedAt: now
    })
}

export const verifyOtp = async (req, res) => {
    const profile = await ChefProfile.findOne({ user: req.user._id }).select('+otpHash +otpExpiresAt')
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    if (profile.phoneVerified) {
        const error = new Error('Your phone is already verified')
        error.statusCode = 400
        throw error
    }

    if (!profile.otpHash || !profile.otpExpiresAt) {
        const error = new Error('No OTP found. Please ask the admin to send you an OTP')
        error.statusCode = 400
        throw error
    }

    if (profile.otpExpiresAt < new Date()) {
        const error = new Error('OTP has expired. Please ask the admin for a new one')
        error.statusCode = 400
        throw error
    }

    const hashedOtp = crypto.createHash('sha256').update(req.body.otp).digest('hex')
    if (hashedOtp !== profile.otpHash) {
        const error = new Error('Invalid OTP')
        error.statusCode = 400
        throw error
    }

    profile.phoneVerified = true
    profile.otpHash = undefined
    profile.otpExpiresAt = undefined
    await profile.save()

    res.status(200).json({ status: 'success', message: 'Phone verified successfully' })
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getChefs = async (req, res) => {
    const result = chefListQuerySchema.safeParse(req.query)
    if (!result.success) {
        const error = new Error(result.error.issues[0].message)
        error.statusCode = 400
        throw error
    }
    const { search, city, cuisine, minPrice, maxPrice, page, limit } = result.data

    // Step 1: chef accounts that are active (and match the name search)
    // Payment-blocked chefs are hidden until they submit a payment
    const blockedIds = await getPaymentBlockedChefIds()
    const userFilter = { role: 'chef', status: 'active', _id: { $nin: blockedIds } }
    if (search) {
        userFilter.name = { $regex: escapeRegex(search), $options: 'i' }
    }
    const users = await User.find(userFilter).select('_id')
    const userIds = users.map((user) => user._id)

    // Step 2: only approved, verified chef profiles of those accounts
    const profileFilter = {
        user: { $in: userIds },
        approvalStatus: 'approved',
        phoneVerified: true
    }
    if (city) profileFilter.city = city
    if (cuisine) profileFilter.cuisines = cuisine
    if (minPrice !== undefined || maxPrice !== undefined) {
        profileFilter.ratePerSlot = {}
        if (minPrice !== undefined) profileFilter.ratePerSlot.$gte = minPrice
        if (maxPrice !== undefined) profileFilter.ratePerSlot.$lte = maxPrice
    }

    // Step 3: count all matches, then fetch only this page
    const total = await ChefProfile.countDocuments(profileFilter)
    const profiles = await ChefProfile.find(profileFilter)
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        chefs: profiles.map((profile) => ({
            id: profile._id,
            name: profile.user.name,
            city: profile.city,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    })
}

export const getChefById = async (req, res) => {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error('Invalid chef id')
        error.statusCode = 400
        throw error
    }

    const profile = await ChefProfile.findOne({ _id: id, approvalStatus: 'approved', phoneVerified: true })
        .populate('user', 'name status')
    if (!profile || profile.user.status !== 'active' || await isChefPaymentBlocked(profile.user._id)) {
        const error = new Error('Chef not found')
        error.statusCode = 404
        throw error
    }

    res.status(200).json({
        status: 'success',
        chef: {
            id: profile._id,
            name: profile.user.name,
            city: profile.city,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio
        }
    })
}
