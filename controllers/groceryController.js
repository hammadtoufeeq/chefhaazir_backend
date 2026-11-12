import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import GroceryStore from '../models/GroceryStore.js'
import GroceryItem from '../models/GroceryItem.js'
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
