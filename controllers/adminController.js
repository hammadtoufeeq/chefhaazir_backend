import crypto from 'crypto'
import mongoose from 'mongoose'
import ChefProfile from '../models/ChefProfile.js'
import GroceryStore from '../models/GroceryStore.js'

export const getChefs = async (req, res) => {
    const { approvalStatus } = req.query

    const filter = {}
    if (approvalStatus) {
        if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
            const error = new Error('approvalStatus must be pending, approved or rejected')
            error.statusCode = 400
            throw error
        }
        filter.approvalStatus = approvalStatus
    }

    const chefs = await ChefProfile.find(filter)
        .populate('user', 'name email phone status')
        .sort({ createdAt: -1 })

    res.status(200).json({
        status: 'success',
        count: chefs.length,
        chefs
    })
}

export const generateChefOtp = async (req, res) => {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error('Invalid chef id')
        error.statusCode = 400
        throw error
    }

    const profile = await ChefProfile.findById(id).populate('user', 'name phone')
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    if (profile.phoneVerified) {
        const error = new Error('This chef\'s phone is already verified')
        error.statusCode = 400
        throw error
    }

    const otp = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    profile.otpHash = crypto.createHash('sha256').update(otp).digest('hex')
    profile.otpExpiresAt = expiresAt
    await profile.save()

    res.status(200).json({
        status: 'success',
        message: 'Send this OTP to the chef on WhatsApp or SMS',
        otp,
        chefName: profile.user.name,
        phone: profile.user.phone,
        expiresAt
    })
}

export const updateChefApproval = async (req, res) => {
    const { id } = req.params
    const { status } = req.body

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error('Invalid chef id')
        error.statusCode = 400
        throw error
    }

    const profile = await ChefProfile.findById(id).populate('user', 'name email')
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    if (status === 'approved') {
        if (!profile.phoneVerified) {
            const error = new Error('Cannot approve: chef has not verified their phone')
            error.statusCode = 400
            throw error
        }
        if (!profile.contractAcceptedAt || !profile.declarationAcceptedAt) {
            const error = new Error('Cannot approve: chef has not accepted the contract and declaration')
            error.statusCode = 400
            throw error
        }
    }

    profile.approvalStatus = status
    await profile.save()

    res.status(200).json({
        status: 'success',
        message: `Chef ${profile.user.name} is now ${status}`,
        approvalStatus: profile.approvalStatus
    })
}

export const getStores = async (req, res) => {
    const { approvalStatus } = req.query

    const filter = {}
    if (approvalStatus) {
        if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
            const error = new Error('approvalStatus must be pending, approved or rejected')
            error.statusCode = 400
            throw error
        }
        filter.approvalStatus = approvalStatus
    }

    const stores = await GroceryStore.find(filter)
        .populate('owner', 'name email phone status')
        .sort({ createdAt: -1 })

    res.status(200).json({ status: 'success', count: stores.length, stores })
}

export const updateStoreApproval = async (req, res) => {
    const { id } = req.params
    const { status } = req.body

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error('Invalid store id')
        error.statusCode = 400
        throw error
    }

    const store = await GroceryStore.findById(id)
    if (!store) {
        const error = new Error('Store not found')
        error.statusCode = 404
        throw error
    }

    if (status === 'approved') {
        const otherApproved = await GroceryStore.findOne({
            city: store.city,
            approvalStatus: 'approved',
            _id: { $ne: store._id }
        })
        if (otherApproved) {
            const error = new Error(`${store.city} already has an approved store (${otherApproved.name})`)
            error.statusCode = 409
            throw error
        }
    }

    store.approvalStatus = status
    await store.save()

    res.status(200).json({
        status: 'success',
        message: `Store ${store.name} is now ${status}`,
        approvalStatus: store.approvalStatus
    })
}
