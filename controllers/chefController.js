import crypto from 'crypto'
import mongoose from 'mongoose'
import { chefListQuerySchema, chefFiltersQuerySchema } from '../zod-validator/chef_zod_schema.js'
import { getPaymentBlockedChefIds, isChefPaymentBlocked, payableFilter } from '../utils/payments.js'
import ChefProfile from '../models/ChefProfile.js'
import Booking, { refreshBookingStatuses } from '../models/Booking.js'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { todayInPakistan, addDays, getSlotTimes, isValidDate, HOUR } from '../utils/time.js'

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
    const profile = await ChefProfile.findOne({ user: req.user._id }).select('+otpExpiresAt')
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    res.status(200).json({
        status: 'success',
        profile: {
            id: profile._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            city: profile.city,
            address: profile.address,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio,
            phoneVerified: profile.phoneVerified,
            otpRequestedAt: profile.otpRequestedAt,
            otpGeneratedAt: profile.otpGeneratedAt,
            otpExpiresAt: profile.otpExpiresAt,
            contractAccepted: !!profile.contractAcceptedAt,
            approvalStatus: profile.approvalStatus
        }
    })
}

export const getMyDashboardAnalytics = async (req, res) => {
    const chefId = req.user._id
    await refreshBookingStatuses({ chef: chefId })
    const today = todayInPakistan()
    const weekEnd = addDays(today, 7)
    const now = new Date()
    const [facets, paymentBlocked] = await Promise.all([
        Booking.aggregate([
            { $match: { chef: chefId } },
            { $facet: {
                statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                schedule: [
                    { $match: { status: { $in: ['pending', 'confirmed'] }, date: { $gte: today, $lte: weekEnd } } },
                    { $group: { _id: '$date', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ],
                upcomingBookings: [
                    { $match: { status: 'confirmed', slotStart: { $gt: now } } },
                    { $sort: { slotStart: 1 } },
                    { $limit: 3 },
                    { $lookup: { from: 'users', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
                    { $project: { date: 1, slot: 1, status: 1, note: 1, groceryStatus: 1, city: '$address.city', customerName: { $arrayElemAt: ['$customerInfo.name', 0] } } }
                ],
                payable: [
                    { $match: payableFilter() },
                    { $match: { chef: chefId } },
                    { $group: { _id: null, payableBookings: { $sum: 1 }, totalDue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$payableToPlatform', { $add: ['$grocerySubtotal', '$deliveryFee'] }] } } } }
                ]
            } }
        ]),
        isChefPaymentBlocked(chefId)
    ])
    const result = facets[0] || { statusCounts: [], schedule: [], upcomingBookings: [], payable: [] }
    const statusCounts = Object.fromEntries(result.statusCounts.map(({ _id, count }) => [_id, count]))
    res.status(200).json({
        status: 'success',
        analytics: {
            statusCounts,
            totalBookings: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
            schedule: result.schedule,
            upcomingBookings: result.upcomingBookings
        },
        earnings: {
            totalDue: result.payable[0]?.totalDue || 0,
            payableBookings: result.payable[0]?.payableBookings || 0,
            paymentBlocked
        }
    })
}

export const requestChefOtp = async (req, res) => {
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

    const now = new Date()
    if (profile.otpExpiresAt && profile.otpExpiresAt > now) {
        const error = new Error('A verification code is already active. Enter the code sent to your phone')
        error.statusCode = 409
        throw error
    }
    if (profile.otpRequestedAt && now.getTime() - profile.otpRequestedAt.getTime() < 5 * 60 * 1000) {
        const error = new Error('Your OTP request is already with the admin team')
        error.statusCode = 409
        throw error
    }

    profile.otpRequestedAt = now
    profile.otpGeneratedAt = undefined
    profile.otpHash = undefined
    profile.otpExpiresAt = undefined
    await profile.save()

    res.status(200).json({ status: 'success', message: 'OTP request sent to the admin team', requestedAt: now })
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

export const updateMyAvailability = async (req, res) => {
    const { date, unavailableSlots } = req.body
    if (date < todayInPakistan() || date > addDays(todayInPakistan(), 7)) {
        const error = new Error('Availability can be changed for today and the next 7 days')
        error.statusCode = 400
        throw error
    }
    const existingBooking = await Booking.findOne({
        chef: req.user._id,
        date,
        slot: { $in: unavailableSlots },
        $or: [
            { status: 'confirmed' },
            { status: 'pending', expiresAt: { $gt: new Date() } }
        ]
    }).select('slot status')
    if (existingBooking) {
        const error = new Error(`You already have a ${existingBooking.status} booking for ${existingBooking.slot}. Resolve it before marking that slot unavailable.`)
        error.statusCode = 409
        throw error
    }

    const profile = await ChefProfile.findOne({ user: req.user._id })
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }
    profile.unavailableSlots = profile.unavailableSlots.filter((entry) => entry.date !== date)
    profile.unavailableSlots.push(...unavailableSlots.map((slot) => ({ date, slot })))
    await profile.save()
    res.status(200).json({ status: 'success', message: 'Availability saved', date, unavailableSlots })
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
    profile.otpRequestedAt = undefined
    profile.otpGeneratedAt = undefined
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
    const { search, city, cuisine, minPrice, maxPrice, date, slot, sort, page, limit } = result.data

    // Availability filter: the slot must be bookable (2 hours to 7 days ahead)
    if (date) {
        const today = todayInPakistan()
        if (!isValidDate(date) || date < today || date > addDays(today, 7)) {
            const error = new Error('Date must be between today and 7 days ahead')
            error.statusCode = 400
            throw error
        }
        if (getSlotTimes(date, slot).slotStart.getTime() - Date.now() < 2 * HOUR) {
            const error = new Error('This slot starts too soon. Book at least 2 hours ahead')
            error.statusCode = 400
            throw error
        }
    }

    // Step 1: chef accounts that are active
    // Payment-blocked chefs are hidden until they submit a payment
    const blockedIds = await getPaymentBlockedChefIds()
    let excludedIds = blockedIds
    if (date) {
        // Chefs already holding this slot with a confirmed booking
        const busy = await Booking.find({ date, slot, slotLocked: true }).distinct('chef')
        excludedIds = [...blockedIds, ...busy]
    }
    const users = await User.find({ role: 'chef', status: 'active', _id: { $nin: excludedIds } }).select('_id name')
    const userIds = users.map((user) => user._id)

    // Step 2: only approved, verified chef profiles of those accounts
    const profileFilter = {
        user: { $in: userIds },
        approvalStatus: 'approved',
        phoneVerified: true
    }
    if (city) profileFilter.city = city
    // Cuisines are free text, so match them without caring about capital letters
    if (cuisine) profileFilter.cuisines = { $regex: `^${escapeRegex(cuisine)}$`, $options: 'i' }
    // Search matches the chef's name or any of their cuisines
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i')
        const nameMatches = users.filter((user) => pattern.test(user.name)).map((user) => user._id)
        profileFilter.$or = [{ user: { $in: nameMatches } }, { cuisines: { $regex: escapeRegex(search), $options: 'i' } }]
    }
    // Chefs who marked themselves unavailable for this slot
    if (date) profileFilter.unavailableSlots = { $not: { $elemMatch: { date, slot } } }
    if (minPrice !== undefined || maxPrice !== undefined) {
        profileFilter.ratePerSlot = {}
        if (minPrice !== undefined) profileFilter.ratePerSlot.$gte = minPrice
        if (maxPrice !== undefined) profileFilter.ratePerSlot.$lte = maxPrice
    }

    // Step 3: count all matches, then fetch only this page
    const total = await ChefProfile.countDocuments(profileFilter)
    const profiles = await ChefProfile.find(profileFilter)
        .populate('user', 'name')
        .sort(sort === 'price_asc' ? { ratePerSlot: 1, _id: 1 } : sort === 'price_desc' ? { ratePerSlot: -1, _id: 1 } : { createdAt: -1, _id: 1 })
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

// Real filter options for the Find Chefs page: the cuisines chefs offer (with counts)
// and the lowest and highest price, for listed chefs in a city (or everywhere)
export const getChefFilters = async (req, res) => {
    const result = chefFiltersQuerySchema.safeParse(req.query)
    if (!result.success) {
        const error = new Error(result.error.issues[0].message)
        error.statusCode = 400
        throw error
    }
    const { city } = result.data
    const blockedIds = await getPaymentBlockedChefIds()
    const users = await User.find({ role: 'chef', status: 'active', _id: { $nin: blockedIds } }).select('_id')
    const match = { user: { $in: users.map((user) => user._id) }, approvalStatus: 'approved', phoneVerified: true }
    if (city) match.city = city

    const [cuisineRows, priceRows] = await Promise.all([
        ChefProfile.aggregate([
            { $match: match },
            { $unwind: '$cuisines' },
            { $group: { _id: { $toLower: '$cuisines' }, name: { $first: '$cuisines' }, count: { $sum: 1 } } },
            { $sort: { count: -1, name: 1 } },
            { $limit: 30 }
        ]),
        ChefProfile.aggregate([
            { $match: match },
            { $group: { _id: null, min: { $min: '$ratePerSlot' }, max: { $max: '$ratePerSlot' }, chefs: { $sum: 1 } } }
        ])
    ])

    res.status(200).json({
        status: 'success',
        cuisines: cuisineRows.map((row) => ({ name: row.name, count: row.count })),
        price: priceRows[0] ? { min: priceRows[0].min, max: priceRows[0].max } : { min: 0, max: 0 },
        totalChefs: priceRows[0]?.chefs || 0
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
