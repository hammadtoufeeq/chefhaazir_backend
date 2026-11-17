import crypto from 'crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import ChefProfile from '../models/ChefProfile.js'
import GroceryStore from '../models/GroceryStore.js'
import Booking from '../models/Booking.js'
import Settlement from '../models/Settlement.js'
import User from '../models/User.js'
import Issue from '../models/Issue.js'
import GroceryItem from '../models/GroceryItem.js'
import { userListQuerySchema } from '../zod-validator/issue_zod_schema.js'
import { payableFilter, getPaymentBlockedChefIds } from '../utils/payments.js'

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
    profile.otpRequestedAt = undefined
    profile.otpGeneratedAt = new Date()
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

export const verifyChefOtpAsAdmin = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid chef id'), { statusCode: 400 })
    const profile = await ChefProfile.findById(id).select('+otpHash +otpExpiresAt').populate('user', 'name')
    if (!profile) throw Object.assign(new Error('Chef profile not found'), { statusCode: 404 })
    if (profile.phoneVerified) throw Object.assign(new Error('This chef is already verified'), { statusCode: 409 })
    if (!profile.otpHash || !profile.otpExpiresAt || profile.otpExpiresAt.getTime() <= Date.now()) {
        throw Object.assign(new Error('Generate a new OTP first; the previous code has expired'), { statusCode: 400 })
    }
    const submitted = crypto.createHash('sha256').update(req.body.otp).digest()
    const expected = Buffer.from(profile.otpHash, 'hex')
    if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
        throw Object.assign(new Error('That OTP is incorrect'), { statusCode: 400 })
    }
    profile.phoneVerified = true
    profile.otpHash = undefined
    profile.otpExpiresAt = undefined
    await profile.save()
    res.status(200).json({ status: 'success', message: `Phone verified for ${profile.user.name}`, phoneVerified: true })
}

export const deleteChefProfile = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid chef id'), { statusCode: 400 })
    const profile = await ChefProfile.findById(id)
    if (!profile) throw Object.assign(new Error('Chef profile not found'), { statusCode: 404 })
    const userId = profile.user
    const [hasBookings, hasSettlements, hasIssues] = await Promise.all([
        Booking.exists({ chef: userId }),
        Settlement.exists({ chef: userId }),
        Issue.exists({ $or: [{ reportedBy: userId }, { against: userId }] })
    ])
    if (hasBookings || hasSettlements || hasIssues) {
        throw Object.assign(new Error('This chef has booking or payment history. Suspend the account instead to preserve records.'), { statusCode: 409 })
    }
    await Promise.all([ChefProfile.deleteOne({ _id: profile._id }), User.deleteOne({ _id: userId })])
    res.status(200).json({ status: 'success', message: 'Chef profile and account deleted' })
}

export const deleteGroceryStore = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid store id'), { statusCode: 400 })
    const store = await GroceryStore.findById(id)
    if (!store) throw Object.assign(new Error('Store not found'), { statusCode: 404 })
    const hasBookings = await Booking.exists({ groceryStore: store._id })
    if (hasBookings) throw Object.assign(new Error('This store has booking history. Suspend its owner instead to preserve records.'), { statusCode: 409 })
    await Promise.all([GroceryItem.deleteMany({ store: store._id }), GroceryStore.deleteOne({ _id: store._id })])
    res.status(200).json({ status: 'success', message: `${store.name} and its catalog were deleted` })
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

export const getGroceryOwners = async (req, res) => {
    const stores = await GroceryStore.find().populate('owner', 'name email phone city status suspendedReason createdAt').sort({ city: 1 })
    res.status(200).json({ status: 'success', count: stores.length, stores })
}

export const createGroceryOwner = async (req, res) => {
    const { name, email, password, phone, storeName, city, address } = req.body
    if (await User.exists({ email })) throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 })
    if (await GroceryStore.exists({ city })) throw Object.assign(new Error(`A grocery owner is already assigned to ${city}`), { statusCode: 409 })
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hashedPassword, phone, role: 'grocery_owner', city })
    try {
        const store = await GroceryStore.create({ owner: user._id, name: storeName, city, address, approvalStatus: 'approved' })
        return res.status(201).json({ status: 'success', message: `Grocery owner for ${city} created and store activated`, store: { ...store.toObject(), owner: { _id: user._id, name, email, phone, city, status: user.status } } })
    } catch (error) {
        await User.deleteOne({ _id: user._id })
        if (error.code === 11000) throw Object.assign(new Error(`A grocery owner or store is already assigned to ${city}`), { statusCode: 409 })
        throw error
    }
}

export const updateGroceryOwner = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid grocery owner id'), { statusCode: 400 })
    const store = await GroceryStore.findById(id).populate('owner')
    if (!store || !store.owner || store.owner.role !== 'grocery_owner') throw Object.assign(new Error('Grocery owner not found'), { statusCode: 404 })
    const { name, email, password, phone, storeName, city, address } = req.body
    if (email && email !== store.owner.email && await User.exists({ email, _id: { $ne: store.owner._id } })) throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 })
    if (city && city !== store.city && await GroceryStore.exists({ city, _id: { $ne: store._id } })) throw Object.assign(new Error(`A grocery owner is already assigned to ${city}`), { statusCode: 409 })
    if (name !== undefined) store.owner.name = name
    if (email !== undefined) store.owner.email = email
    if (phone !== undefined) store.owner.phone = phone
    if (city !== undefined) { store.owner.city = city; store.city = city }
    if (password) store.owner.password = await bcrypt.hash(password, 12)
    if (storeName !== undefined) store.name = storeName
    if (address !== undefined) store.address = address
    await Promise.all([store.owner.save(), store.save()])
    res.status(200).json({ status: 'success', message: 'Grocery owner and store updated', store: await GroceryStore.findById(store._id).populate('owner', 'name email phone city status suspendedReason createdAt') })
}

export const deleteGroceryOwner = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid grocery owner id'), { statusCode: 400 })
    const store = await GroceryStore.findById(id)
    if (!store) throw Object.assign(new Error('Grocery owner not found'), { statusCode: 404 })
    if (await Booking.exists({ groceryStore: store._id })) throw Object.assign(new Error('This store has order history. Suspend the owner instead to preserve records.'), { statusCode: 409 })
    await Promise.all([GroceryItem.deleteMany({ store: store._id }), GroceryStore.deleteOne({ _id: store._id }), User.deleteOne({ _id: store.owner })])
    res.status(200).json({ status: 'success', message: 'Grocery owner account and store deleted' })
}

export const updateStoreApproval = async (req, res) => {
    const { id } = req.params
    const { status, override = false } = req.body

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
        if (otherApproved && !override) {
            const error = new Error(`${store.city} already has an approved store (${otherApproved.name})`)
            error.statusCode = 409
            throw error
        }
        // The unique one-store-per-city index stays intact: move the existing
        // hub out of approved before activating its replacement.
        if (otherApproved && override) {
            otherApproved.approvalStatus = 'rejected'
            await otherApproved.save()
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

// One card per chef: amount due, payment waiting for verification, last verified payment
export const getChefPayments = async (req, res) => {
    // These are the two finance figures shown to admins. A submitted payment
    // moves from pending to earned only after an admin verifies it.
    const [settlementTotals, due] = await Promise.all([
        Settlement.aggregate([
            { $match: { status: { $in: ['submitted', 'verified'] } } },
            { $group: { _id: '$status', amount: { $sum: '$amount' }, payments: { $sum: 1 } } }
        ]),
    // Aggregation: group every unpaid payable booking by chef and add up what is owed
    Booking.aggregate([
        { $match: payableFilter() },
        {
            $group: {
                _id: '$chef',
                bookings: { $sum: 1 },
                commission: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$commissionAmount', 0] } },
                groceries: { $sum: '$grocerySubtotal' },
                delivery: { $sum: '$deliveryFee' }
            }
        },
        { $addFields: { totalDue: { $add: ['$commission', '$groceries', '$delivery'] } } }
    ])
    ])

    const awaiting = await Settlement.find({ status: 'submitted' }).select('chef amount method transactionId submittedAt')

    const lastVerified = await Settlement.aggregate([
        { $match: { status: 'verified' } },
        { $sort: { verifiedAt: -1 } },
        { $group: { _id: '$chef', amount: { $first: '$amount' }, verifiedAt: { $first: '$verifiedAt' } } }
    ])

    const blockedIds = (await getPaymentBlockedChefIds()).map(String)

    // Every chef who owes money or has a payment waiting gets a card
    const chefIds = [...new Set([...due.map((d) => String(d._id)), ...awaiting.map((a) => String(a.chef))])]
    const chefs = await User.find({ _id: { $in: chefIds } }).select('name phone')

    const cards = chefs.map((chef) => {
        const id = String(chef._id)
        const dueRow = due.find((d) => String(d._id) === id)
        const waiting = awaiting.find((a) => String(a.chef) === id)
        const last = lastVerified.find((l) => String(l._id) === id)
        return {
            chefId: chef._id,
            name: chef.name,
            phone: chef.phone,
            totalDue: dueRow ? dueRow.totalDue : 0,
            breakdown: dueRow
                ? { bookings: dueRow.bookings, commission: dueRow.commission, groceries: dueRow.groceries, delivery: dueRow.delivery }
                : { bookings: 0, commission: 0, groceries: 0, delivery: 0 },
            awaitingVerification: waiting || null,
            lastVerifiedPayment: last ? { amount: last.amount, verifiedAt: last.verifiedAt } : null,
            paymentBlocked: blockedIds.includes(id)
        }
    })
    cards.sort((a, b) => b.totalDue - a.totalDue)

    const totals = {
        earned: settlementTotals.find((row) => row._id === 'verified')?.amount || 0,
        pendingVerification: settlementTotals.find((row) => row._id === 'submitted')?.amount || 0,
        verifiedPayments: settlementTotals.find((row) => row._id === 'verified')?.payments || 0,
        pendingPayments: settlementTotals.find((row) => row._id === 'submitted')?.payments || 0
    }
    res.status(200).json({ status: 'success', count: cards.length, totals, chefs: cards })
}

// Accounts with their total and genuine issue counts (aggregation)
export const getUsers = async (req, res) => {
    const result = userListQuerySchema.safeParse(req.query)
    if (!result.success) {
        const error = new Error(result.error.issues[0].message)
        error.statusCode = 400
        throw error
    }
    const { role, status, search, page, limit } = result.data

    const filter = {}
    if (role) filter.role = role
    if (status) filter.status = status
    if (search) {
        const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        filter.$or = [{ name: { $regex: pattern, $options: 'i' } }, { email: { $regex: pattern, $options: 'i' } }]
    }

    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
        .select('name email phone role status suspendedReason createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

    const counts = await Issue.aggregate([
        { $match: { against: { $in: users.map((u) => u._id) } } },
        {
            $group: {
                _id: '$against',
                totalReports: { $sum: 1 },
                genuineReports: { $sum: { $cond: [{ $eq: ['$status', 'genuine'] }, 1, 0] } }
            }
        }
    ])

    res.status(200).json({
        status: 'success',
        users: users.map((u) => {
            const c = counts.find((x) => x._id.equals(u._id))
            return { ...u.toObject(), totalReports: c ? c.totalReports : 0, genuineReports: c ? c.genuineReports : 0 }
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

// Paginated booking ledger for the admin operations portal.
export const getAdminBookings = async (req, res) => {
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired', 'disputed']
    const status = req.query.status
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
    if (status && !allowedStatuses.includes(status)) {
        const error = new Error('Invalid booking status')
        error.statusCode = 400
        throw error
    }
    const filter = status ? { status } : {}
    const total = await Booking.countDocuments(filter)
    const [bookings, completedRows, totalBookings] = await Promise.all([
        Booking.find(filter)
            .populate('customer', 'name email phone')
            .populate('chef', 'name email phone')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, completedOrderValue: { $sum: '$totalFromCustomer' }, platformEarned: { $sum: { $add: ['$commissionAmount', '$grocerySubtotal'] } } } }
        ]),
        Booking.countDocuments({})
    ])

    res.status(200).json({
        status: 'success',
        bookings,
        bookingStats: { totalBookings, ...(completedRows[0] || { completedOrderValue: 0, platformEarned: 0 }) },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

// Suspend or reactivate an account
export const updateUserStatus = async (req, res) => {
    const { id } = req.params
    const { status, reason } = req.body

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error('Invalid user id')
        error.statusCode = 400
        throw error
    }
    const user = await User.findById(id)
    if (!user) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
    }
    if (user.role === 'admin') {
        const error = new Error('Admin accounts cannot be suspended')
        error.statusCode = 400
        throw error
    }
    if (user.status === status) {
        const error = new Error(`This account is already ${status}`)
        error.statusCode = 409
        throw error
    }

    let cancelledBookings = 0
    if (status === 'suspended') {
        user.status = 'suspended'
        user.suspendedReason = reason
        user.refreshToken = undefined     // ends every session immediately
        await user.save()

        // Grocery owners do not book chef sessions, so suspension only revokes
        // their store portal access and preserves their store/order history.
        if (user.role !== 'grocery_owner') {
            const who = user.role === 'chef' ? 'Chef' : 'Customer'
            const upcoming = { status: { $in: ['pending', 'confirmed'] }, slotEnd: { $gt: new Date() } }
            const field = user.role === 'chef' ? 'chef' : 'customer'
            await Booking.updateMany(
                { ...upcoming, [field]: user._id, groceryStatus: { $in: ['ordered', 'packed', 'out_for_delivery'] } },
                { groceryStatus: 'cancelled' }
            )
            const result = await Booking.updateMany(
                { ...upcoming, [field]: user._id },
                { status: 'cancelled', slotLocked: false, cancelledBy: 'system', cancelReason: `${who} not available, booking cancelled` }
            )
            cancelledBookings = result.modifiedCount
        }
    } else {
        user.status = 'active'
        user.suspendedReason = undefined
        await user.save()
    }

    res.status(200).json({
        status: 'success',
        message: `Account is now ${user.status}`,
        cancelledBookings
    })
}
