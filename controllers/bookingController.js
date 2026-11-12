import mongoose from 'mongoose'
import Booking, { refreshBookingStatuses } from '../models/Booking.js'
import ChefProfile from '../models/ChefProfile.js'
import GroceryStore from '../models/GroceryStore.js'
import GroceryItem from '../models/GroceryItem.js'
import { getSettings } from '../models/Setting.js'
import { getSlotTimes, todayInPakistan, addDays, SLOTS, HOUR, MINUTE } from '../utils/time.js'
import { bookingListQuerySchema, availabilityQuerySchema } from '../zod-validator/booking_zod_schema.js'
import { isChefPaymentBlocked } from '../utils/payments.js'

const BOOKING_WINDOW_HOURS = 2      // request at least 2 hours before the slot
const MAX_DAYS_AHEAD = 7            // book at most 7 days ahead
const RESPONSE_MINUTES = 15         // chef must answer within 15 minutes

const httpError = (message, statusCode) => {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
}

// A chef is bookable only if approved, phone-verified and the account is active
const findBookableChef = async (chefProfileId) => {
    const profile = await ChefProfile.findOne({ _id: chefProfileId, approvalStatus: 'approved', phoneVerified: true })
        .populate('user', 'name status')
    if (!profile || profile.user.status !== 'active' || await isChefPaymentBlocked(profile.user._id)) {
        throw httpError('Chef not found or not available for booking', 404)
    }
    return profile
}

// ---------- Customer: create a booking request ----------

export const createBooking = async (req, res) => {
    const { chefId, date, slot, note, street, groceryItems = [] } = req.body
    const customer = req.user

    const chefProfile = await findBookableChef(chefId)
    const chefUserId = chefProfile.user._id

    // Time rules (all in Pakistan time)
    const { slotStart, slotEnd } = getSlotTimes(date, slot)
    if (slotStart.getTime() - Date.now() < BOOKING_WINDOW_HOURS * HOUR) {
        throw httpError(`Please book at least ${BOOKING_WINDOW_HOURS} hours before the slot starts`, 400)
    }
    if (date > addDays(todayInPakistan(), MAX_DAYS_AHEAD)) {
        throw httpError(`You can book at most ${MAX_DAYS_AHEAD} days ahead`, 400)
    }

    // Slot already taken by a confirmed booking?
    const locked = await Booking.findOne({ chef: chefUserId, date, slot, slotLocked: true })
    if (locked) {
        throw httpError('This slot is already booked. Please choose another slot', 409)
    }

    // Same customer already waiting for this chef and slot?
    await refreshBookingStatuses({ customer: customer._id, chef: chefUserId, date, slot })
    const duplicate = await Booking.findOne({ customer: customer._id, chef: chefUserId, date, slot, status: 'pending' })
    if (duplicate) {
        throw httpError('You already have a pending request for this chef and slot', 409)
    }

    // Address: the booking city is always the chef's city
    let bookingStreet = street
    if (!bookingStreet) {
        if (customer.city !== chefProfile.city) {
            throw httpError(`This chef works in ${chefProfile.city}. Please provide an address in ${chefProfile.city}`, 400)
        }
        bookingStreet = customer.address
    }

    // Groceries from the approved store in the chef's city (prices from the server)
    let groceryStore = null
    let bookingItems = []
    let grocerySubtotal = 0
    if (groceryItems.length > 0) {
        groceryStore = await GroceryStore.findOne({ city: chefProfile.city, approvalStatus: 'approved' })
        if (!groceryStore) {
            throw httpError(`Grocery is not available in ${chefProfile.city} yet`, 400)
        }

        const ids = groceryItems.map((g) => g.itemId)
        if (new Set(ids).size !== ids.length) {
            throw httpError('Each grocery item can be added only once. Change its quantity instead', 400)
        }

        const storeItems = await GroceryItem.find({ _id: { $in: ids }, store: groceryStore._id })
        for (const { itemId, quantity } of groceryItems) {
            const storeItem = storeItems.find((i) => i._id.equals(itemId))
            if (!storeItem) {
                throw httpError('One of the grocery items is not available in this store', 400)
            }
            if (!storeItem.inStock) {
                throw httpError(`${storeItem.name} is out of stock`, 400)
            }
            const lineTotal = storeItem.price * quantity
            bookingItems.push({
                item: storeItem._id,
                name: storeItem.name,
                unit: storeItem.unit,
                price: storeItem.price,
                quantity,
                lineTotal
            })
            grocerySubtotal += lineTotal
        }
    }

    // Money
    const settings = await getSettings()
    const deliveryFee = grocerySubtotal > 0 && grocerySubtotal < settings.freeDeliveryMin ? settings.deliveryFee : 0
    const commissionAmount = Math.round(chefProfile.ratePerSlot * settings.commissionRate / 100)
    const totalFromCustomer = chefProfile.ratePerSlot + grocerySubtotal + deliveryFee
    const payableToPlatform = commissionAmount + grocerySubtotal + deliveryFee

    const booking = await Booking.create({
        customer: customer._id,
        chef: chefUserId,
        chefProfile: chefProfile._id,
        date,
        slot,
        slotStart,
        slotEnd,
        note,
        address: { city: chefProfile.city, street: bookingStreet },
        chefRate: chefProfile.ratePerSlot,
        commissionRate: settings.commissionRate,
        commissionAmount,
        groceryStore: groceryStore ? groceryStore._id : undefined,
        groceryItems: bookingItems,
        grocerySubtotal,
        deliveryFee,
        totalFromCustomer,
        payableToPlatform,
        expiresAt: new Date(Date.now() + RESPONSE_MINUTES * MINUTE)
    })

    res.status(201).json({
        status: 'success',
        message: `Request sent to ${chefProfile.user.name}. The chef has ${RESPONSE_MINUTES} minutes to respond`,
        booking: {
            id: booking._id,
            chefName: chefProfile.user.name,
            date: booking.date,
            slot: booking.slot,
            status: booking.status,
            expiresAt: booking.expiresAt,
            chefRate: booking.chefRate,
            grocerySubtotal: booking.grocerySubtotal,
            deliveryFee: booking.deliveryFee,
            totalFromCustomer: booking.totalFromCustomer
        }
    })
}

// ---------- Lists ----------

const parseListQuery = (query) => {
    const result = bookingListQuerySchema.safeParse(query)
    if (!result.success) {
        throw httpError(result.error.issues[0].message, 400)
    }
    return result.data
}

export const getMyBookings = async (req, res) => {
    const { status, page, limit } = parseListQuery(req.query)
    await refreshBookingStatuses({ customer: req.user._id })

    const filter = { customer: req.user._id }
    if (status) filter.status = status

    const total = await Booking.countDocuments(filter)
    const bookings = await Booking.find(filter)
        .populate('chef', 'name')
        .select('-payableToPlatform -commissionAmount -commissionRate')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        bookings,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

export const getChefBookings = async (req, res) => {
    const { status, page, limit } = parseListQuery(req.query)
    await refreshBookingStatuses({ chef: req.user._id })

    const filter = { chef: req.user._id }
    if (status) filter.status = status

    const total = await Booking.countDocuments(filter)
    const bookings = await Booking.find(filter)
        .populate('customer', 'name')
        .sort({ slotStart: 1 })
        .skip((page - 1) * limit)
        .limit(limit)

    // The customer's street address is shared with the chef only after acceptance
    const safeBookings = bookings.map((b) => {
        const booking = b.toObject()
        if (!['confirmed', 'completed', 'disputed'].includes(booking.status)) {
            booking.address = { city: booking.address.city }
        }
        return booking
    })

    res.status(200).json({
        status: 'success',
        bookings: safeBookings,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

// ---------- One booking (customer, chef or admin) ----------

export const getBookingById = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid booking id', 400)
    }

    await refreshBookingStatuses({ _id: id })
    const booking = await Booking.findById(id)
        .populate('customer', 'name phone')
        .populate('chef', 'name phone')
    if (!booking) {
        throw httpError('Booking not found', 404)
    }

    const isCustomer = booking.customer._id.equals(req.user._id)
    const isChef = booking.chef._id.equals(req.user._id)
    const isAdmin = req.user.role === 'admin'
    if (!isCustomer && !isChef && !isAdmin) {
        throw httpError('You can only view your own bookings', 403)
    }

    const result = booking.toObject()
    const contactsVisible = ['confirmed', 'completed', 'disputed'].includes(booking.status)
    if (!contactsVisible && !isAdmin) {
        delete result.customer.phone
        delete result.chef.phone
        if (isChef) result.address = { city: result.address.city }
    }
    if (isCustomer && !isAdmin) {
        delete result.commissionRate
        delete result.commissionAmount
        delete result.payableToPlatform
    }

    res.status(200).json({ status: 'success', booking: result })
}

// ---------- Chef: accept or reject a request ----------

const findChefPendingBooking = async (bookingId, chefId) => {
    if (!mongoose.isValidObjectId(bookingId)) {
        throw httpError('Invalid booking id', 400)
    }
    const booking = await Booking.findById(bookingId)
    if (!booking) {
        throw httpError('Booking not found', 404)
    }
    if (!booking.chef.equals(chefId)) {
        throw httpError('You can only respond to your own booking requests', 403)
    }
    if (booking.status === 'pending' && booking.expiresAt < new Date()) {
        booking.status = 'expired'
        await booking.save()
        throw httpError('This request has expired', 409)
    }
    if (booking.status !== 'pending') {
        throw httpError(`This request is already ${booking.status}`, 409)
    }
    return booking
}

export const acceptBooking = async (req, res) => {
    if (await isChefPaymentBlocked(req.user._id)) {
        throw httpError('Your account is blocked for an overdue payment. Submit a settlement to accept new requests', 403)
    }
    const booking = await findChefPendingBooking(req.params.id, req.user._id)

    booking.status = 'confirmed'
    booking.slotLocked = true
    booking.respondedAt = new Date()
    if (booking.groceryItems.length > 0) {
        booking.groceryStatus = 'ordered'
    }

    try {
        await booking.save()
    } catch (err) {
        // The unique index blocked a second confirmed booking for the same slot
        if (err.code === 11000) {
            throw httpError('You have already accepted another booking for this slot', 409)
        }
        throw err
    }

    // All other pending requests for this chef and slot are rejected automatically
    const autoRejected = await Booking.updateMany(
        { chef: booking.chef, date: booking.date, slot: booking.slot, status: 'pending', _id: { $ne: booking._id } },
        { status: 'rejected', respondedAt: new Date(), cancelReason: 'The chef accepted another request for this slot' }
    )

    res.status(200).json({
        status: 'success',
        message: 'Booking confirmed',
        autoRejectedRequests: autoRejected.modifiedCount
    })
}

export const rejectBooking = async (req, res) => {
    const booking = await findChefPendingBooking(req.params.id, req.user._id)

    booking.status = 'rejected'
    booking.respondedAt = new Date()
    await booking.save()

    res.status(200).json({ status: 'success', message: 'Booking request rejected' })
}

// ---------- Public: which slots of a chef are free on a date ----------

export const getChefAvailability = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid chef id', 400)
    }
    const result = availabilityQuerySchema.safeParse(req.query)
    if (!result.success) {
        throw httpError(result.error.issues[0].message, 400)
    }
    const { date } = result.data

    const chefProfile = await findBookableChef(id)
    const lockedBookings = await Booking.find({ chef: chefProfile.user._id, date, slotLocked: true }).select('slot')
    const lockedSlots = lockedBookings.map((b) => b.slot)
    const lastBookableDate = addDays(todayInPakistan(), MAX_DAYS_AHEAD)

    const slots = SLOTS.map((slot) => {
        const { slotStart } = getSlotTimes(date, slot)
        let status = 'available'
        if (lockedSlots.includes(slot)) status = 'booked'
        else if (slotStart.getTime() - Date.now() < BOOKING_WINDOW_HOURS * HOUR) status = 'too_late'
        else if (date > lastBookableDate) status = 'too_far'
        return { slot, status }
    })

    res.status(200).json({ status: 'success', date, slots })
}

// ---------- Cancel, complete, grocery return ----------

const CANCEL_DEADLINE_MINUTES = 90  // user and chef can cancel until 1.5 hours before the slot

export const cancelBooking = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid booking id', 400)
    }

    await refreshBookingStatuses({ _id: id })
    const booking = await Booking.findById(id)
    if (!booking) {
        throw httpError('Booking not found', 404)
    }

    const role = req.user.role
    const isCustomer = booking.customer.equals(req.user._id)
    const isChef = booking.chef.equals(req.user._id)
    if (role !== 'admin' && !isCustomer && !isChef) {
        throw httpError('You can only cancel your own bookings', 403)
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
        throw httpError(`A ${booking.status} booking cannot be cancelled`, 409)
    }

    const now = Date.now()
    if (role === 'admin') {
        if (booking.slotEnd.getTime() <= now) {
            throw httpError('This slot has already ended', 400)
        }
    } else if (booking.slotStart.getTime() - now < CANCEL_DEADLINE_MINUTES * MINUTE) {
        throw httpError('Bookings can only be cancelled until 1.5 hours before the slot', 400)
    }

    booking.status = 'cancelled'
    booking.slotLocked = false
    booking.cancelledBy = role === 'admin' ? 'admin' : isChef ? 'chef' : 'user'
    booking.cancelReason = req.body.reason
    // Groceries not yet with the chef are simply cancelled; delivered ones need a return
    if (['ordered', 'packed'].includes(booking.groceryStatus)) {
        booking.groceryStatus = 'cancelled'
    }
    await booking.save()

    res.status(200).json({
        status: 'success',
        message: 'Booking cancelled',
        groceryStatus: booking.groceryStatus,
        groceryReturnNeeded: booking.groceryStatus === 'delivered_to_chef'
    })
}

export const completeBooking = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid booking id', 400)
    }

    const booking = await Booking.findById(id)
    if (!booking) {
        throw httpError('Booking not found', 404)
    }
    if (!booking.chef.equals(req.user._id)) {
        throw httpError('You can only complete your own bookings', 403)
    }
    if (booking.status !== 'confirmed') {
        throw httpError(`Only confirmed bookings can be completed (this one is ${booking.status})`, 409)
    }
    if (booking.slotEnd.getTime() > Date.now()) {
        throw httpError('You can mark the booking completed only after the slot ends', 400)
    }

    booking.status = 'completed'
    booking.completedAt = new Date()
    await booking.save()

    res.status(200).json({ status: 'success', message: 'Booking marked as completed' })
}

export const requestGroceryReturn = async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid booking id', 400)
    }

    const booking = await Booking.findById(id)
    if (!booking) {
        throw httpError('Booking not found', 404)
    }
    if (!booking.chef.equals(req.user._id)) {
        throw httpError('You can only return groceries of your own bookings', 403)
    }
    if (booking.status !== 'cancelled' || booking.groceryStatus !== 'delivered_to_chef') {
        throw httpError('A return is only for cancelled bookings whose groceries were delivered to you', 400)
    }

    booking.groceryStatus = 'return_requested'
    await booking.save()

    res.status(200).json({ status: 'success', message: 'Return requested. Please send the groceries back to the store' })
}
