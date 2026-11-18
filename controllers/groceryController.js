import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import GroceryStore from '../models/GroceryStore.js'
import GroceryItem from '../models/GroceryItem.js'
import Booking from '../models/Booking.js'
import { groceryOrdersQuerySchema } from '../zod-validator/booking_zod_schema.js'
import { groceryItemsQuerySchema } from '../zod-validator/grocery_zod_schema.js'

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- Register (account + store together) ----------

export const registerGroceryOwner = async (req, res) => {
    const { name, email, password, phone, storeName, city, address } = req.body

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
        role: 'grocery_owner'
    })

    let store
    try {
        store = await GroceryStore.create({
            owner: user._id,
            name: storeName,
            city,
            address
        })
    } catch (err) {
        await User.findByIdAndDelete(user._id)
        const error = new Error('Could not create grocery store. Please try again')
        error.statusCode = 500
        throw error
    }

    res.status(201).json({
        status: 'success',
        message: 'Grocery owner registered successfully. Your store is pending approval',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        store: { id: store._id, name: store.name, city: store.city, approvalStatus: store.approvalStatus }
    })
}

// ---------- Grocery owner: own store and items ----------

// Finds the logged-in owner's store; optionally requires it to be approved
const findMyStore = async (ownerId, mustBeApproved) => {
    const store = await GroceryStore.findOne({ owner: ownerId })
    if (!store) {
        const error = new Error('Grocery store not found')
        error.statusCode = 404
        throw error
    }
    if (mustBeApproved && store.approvalStatus !== 'approved') {
        const error = new Error('Your store is not approved yet')
        error.statusCode = 403
        throw error
    }
    return store
}

// Finds one item and makes sure it belongs to this owner's store
const findMyItem = async (itemId, store) => {
    if (!mongoose.isValidObjectId(itemId)) {
        const error = new Error('Invalid item id')
        error.statusCode = 400
        throw error
    }
    const item = await GroceryItem.findById(itemId)
    if (!item) {
        const error = new Error('Item not found')
        error.statusCode = 404
        throw error
    }
    if (!item.store.equals(store._id)) {
        const error = new Error('You can only manage items of your own store')
        error.statusCode = 403
        throw error
    }
    return item
}

export const getMyStore = async (req, res) => {
    const store = await findMyStore(req.user._id, false)
    const itemCount = await GroceryItem.countDocuments({ store: store._id })

    res.status(200).json({
        status: 'success',
        store: {
            id: store._id,
            name: store.name,
            city: store.city,
            address: store.address,
            approvalStatus: store.approvalStatus,
            itemCount
        }
    })
}

export const getMyItems = async (req, res) => {
    const store = await findMyStore(req.user._id, false)
    const items = await GroceryItem.find({ store: store._id }).sort({ category: 1, name: 1 })

    res.status(200).json({ status: 'success', count: items.length, items })
}

export const createItem = async (req, res) => {
    const store = await findMyStore(req.user._id, true)

    const existingItem = await GroceryItem.findOne({ store: store._id, name: req.body.name })
    if (existingItem) {
        const error = new Error('An item with this name already exists in your store')
        error.statusCode = 409
        throw error
    }

    const item = await GroceryItem.create({ ...req.body, store: store._id })

    res.status(201).json({ status: 'success', message: 'Item added', item })
}

export const updateItem = async (req, res) => {
    const store = await findMyStore(req.user._id, true)
    const item = await findMyItem(req.params.id, store)

    if (req.body.name && req.body.name !== item.name) {
        const sameName = await GroceryItem.findOne({ store: store._id, name: req.body.name })
        if (sameName) {
            const error = new Error('An item with this name already exists in your store')
            error.statusCode = 409
            throw error
        }
    }

    Object.assign(item, req.body)
    await item.save()

    res.status(200).json({ status: 'success', message: 'Item updated', item })
}

export const deleteItem = async (req, res) => {
    const store = await findMyStore(req.user._id, true)
    const item = await findMyItem(req.params.id, store)

    await item.deleteOne()

    res.status(200).json({ status: 'success', message: 'Item deleted' })
}

// ---------- Public: browse stores and items ----------

export const getStores = async (req, res) => {
    const stores = await GroceryStore.find({ approvalStatus: 'approved' })
        .select('name city')
        .sort({ city: 1 })

    res.status(200).json({ status: 'success', count: stores.length, stores })
}

export const getItems = async (req, res) => {
    const result = groceryItemsQuerySchema.safeParse(req.query)
    if (!result.success) {
        const error = new Error(result.error.issues[0].message)
        error.statusCode = 400
        throw error
    }
    const { city, category, search, page, limit } = result.data

    const store = await GroceryStore.findOne({ city, approvalStatus: 'approved' }).select('name city')
    if (!store) {
        return res.status(200).json({
            status: 'success',
            store: null,
            message: 'Grocery is not available in this city yet',
            items: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
        })
    }

    const filter = { store: store._id }
    if (category) filter.category = category
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }

    const total = await GroceryItem.countDocuments(filter)
    const items = await GroceryItem.find(filter)
        .select('name category price unit inStock')
        .sort({ category: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        store,
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

// ---------- Grocery owner: orders that come from confirmed bookings ----------

// Bookings whose groceries still matter to the store (not cancelled, rejected or expired)
const ACTIVE_BOOKING_STATUSES = ['confirmed', 'completed', 'disputed']

export const getMyOrders = async (req, res) => {
    const store = await findMyStore(req.user._id, false)

    const result = groceryOrdersQuerySchema.safeParse(req.query)
    if (!result.success) {
        const error = new Error(result.error.issues[0].message)
        error.statusCode = 400
        throw error
    }
    const { status, view, page, limit } = result.data

    const filter = { groceryStore: store._id, groceryStatus: status || { $ne: 'none' } }

    // An order that is still open is either upcoming (delivery time not reached yet)
    // or missed (delivery time passed, or the booking already completed, and the store
    // never marked it delivered). The store can still update missed orders.
    const openStatuses = ['ordered', 'packed', 'out_for_delivery']
    const listView = view || (openStatuses.includes(status) ? 'upcoming' : null)
    if (listView) {
        filter.groceryStatus = openStatuses.includes(status) ? status : { $in: openStatuses }
        if (listView === 'missed') {
            filter.status = { $in: ACTIVE_BOOKING_STATUSES }
            filter.slotStart = { $lt: new Date() }
        } else {
            filter.status = 'confirmed'
            filter.slotStart = { $gte: new Date() }
        }
    }

    const total = await Booking.countDocuments(filter)
    const orders = await Booking.find(filter)
        .populate('chef', 'name phone')
        .populate('chefProfile', 'address city')
        .select('date slot slotStart slotEnd status groceryItems grocerySubtotal deliveryFee groceryStatus groceryPackedAt groceryShippedAt groceryDeliveredAt cancelReason createdAt chef chefProfile')
<<<<<<< HEAD
        .sort({ slotStart: status === 'delivered_to_chef' ? -1 : 1 })
=======
        .sort({ slotStart: 1 })
>>>>>>> 360156876a0ab8ca2e47750e654dee17205e91e5
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

// Finds a booking that belongs to this owner's store
const findMyOrder = async (bookingId, store) => {
    if (!mongoose.isValidObjectId(bookingId)) {
        const error = new Error('Invalid order id')
        error.statusCode = 400
        throw error
    }
    const booking = await Booking.findById(bookingId)
    if (!booking || !booking.groceryStore || !booking.groceryStore.equals(store._id)) {
        const error = new Error('Order not found')
        error.statusCode = 404
        throw error
    }
    return booking
}

// ordered -> packed -> out_for_delivery -> delivered_to_chef
<<<<<<< HEAD
const ORDER_FLOW = ['ordered', 'packed', 'out_for_delivery', 'delivered_to_chef']
=======
const NEXT_STEP = { ordered: 'packed', packed: 'out_for_delivery', out_for_delivery: 'delivered_to_chef' }
>>>>>>> 360156876a0ab8ca2e47750e654dee17205e91e5
const STEP_TIME = { packed: 'groceryPackedAt', out_for_delivery: 'groceryShippedAt', delivered_to_chef: 'groceryDeliveredAt' }

export const updateOrderStatus = async (req, res) => {
    const store = await findMyStore(req.user._id, true)
    const booking = await findMyOrder(req.params.bookingId, store)
    const { status } = req.body

    // Completed bookings are still allowed: the store may have forgotten to update the order
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
        const error = new Error(`Groceries can only be sent for active bookings (this one is ${booking.status})`)
        error.statusCode = 409
        throw error
    }

    const from = ORDER_FLOW.indexOf(booking.groceryStatus)
    const to = ORDER_FLOW.indexOf(status)
    if (from === -1 || to <= from) {
        const error = new Error(`Order is ${booking.groceryStatus}; it cannot move to ${status}`)
        error.statusCode = 409
        throw error
    }

    // Normally one step at a time. A missed order (delivery time passed, or booking
    // already completed) may jump ahead, e.g. straight to delivered.
    const missed = booking.status !== 'confirmed' || booking.slotStart.getTime() < Date.now()
    if (to !== from + 1 && !missed) {
        const error = new Error(`Order is ${booking.groceryStatus}; move it one step at a time`)
        error.statusCode = 409
        throw error
    }

    const now = new Date()
    for (let i = from + 1; i <= to; i++) {
        const field = STEP_TIME[ORDER_FLOW[i]]
        booking[field] = booking[field] || now
    }
    booking.groceryStatus = status
    booking[STEP_TIME[status]] = new Date()
    await booking.save()

    const messages = { packed: 'Order packed', out_for_delivery: 'Order sent out to the chef', delivered_to_chef: 'Order delivered to the chef' }
    res.status(200).json({ status: 'success', message: messages[status], groceryStatus: booking.groceryStatus })
}

export const verifyReturn = async (req, res) => {
    const store = await findMyStore(req.user._id, true)
    const booking = await findMyOrder(req.params.bookingId, store)

    if (booking.groceryStatus !== 'return_requested') {
        const error = new Error('There is no return request for this order')
        error.statusCode = 409
        throw error
    }

    booking.groceryStatus = 'return_verified'
    await booking.save()

    res.status(200).json({ status: 'success', message: 'Return verified' })
}