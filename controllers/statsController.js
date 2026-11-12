import Booking from '../models/Booking.js'
import User from '../models/User.js'
import ChefProfile from '../models/ChefProfile.js'
import GroceryStore from '../models/GroceryStore.js'
import Issue from '../models/Issue.js'
import { getSettings } from '../models/Setting.js'
import { SLOTS } from '../utils/time.js'

// Best-selling grocery items across completed bookings (optionally for one store)
const bestSellingItems = (match) => Booking.aggregate([
    { $match: { status: 'completed', ...match } },
    { $unwind: '$groceryItems' },
    {
        $group: {
            _id: '$groceryItems.item',
            name: { $first: '$groceryItems.name' },
            unit: { $first: '$groceryItems.unit' },
            quantitySold: { $sum: '$groceryItems.quantity' },
            revenue: { $sum: '$groceryItems.lineTotal' }
        }
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 10 }
])

// ---------- Admin dashboard ----------

export const getAdminStats = async (req, res) => {
    // 1. Revenue split per month: chef commission vs grocery sales
    const revenueByMonth = await Booking.aggregate([
        { $match: { status: 'completed' } },
        {
            $group: {
                _id: { $substr: ['$date', 0, 7] },   // "2026-11"
                bookings: { $sum: 1 },
                commission: { $sum: '$commissionAmount' },
                grocerySales: { $sum: '$grocerySubtotal' },
                deliveryFees: { $sum: '$deliveryFee' }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: '$_id', bookings: 1, commission: 1, grocerySales: 1, deliveryFees: 1 } }
    ])

    const totals = revenueByMonth.reduce(
        (sum, m) => ({
            bookings: sum.bookings + m.bookings,
            commission: sum.commission + m.commission,
            grocerySales: sum.grocerySales + m.grocerySales,
            deliveryFees: sum.deliveryFees + m.deliveryFees
        }),
        { bookings: 0, commission: 0, grocerySales: 0, deliveryFees: 0 }
    )
    totals.totalRevenue = totals.commission + totals.grocerySales + totals.deliveryFees

    // 2. Top 5 chefs by completed bookings
    const topChefs = await Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$chef', bookings: { $sum: 1 }, earnedForPlatform: { $sum: '$commissionAmount' } } },
        { $sort: { bookings: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'chef' } },
        { $unwind: '$chef' },
        { $project: { _id: 0, chefId: '$_id', name: '$chef.name', bookings: 1, earnedForPlatform: 1 } }
    ])

    // 3. Best-selling grocery items
    const topItems = await bestSellingItems({})

    // 4. Bookings per slot (which times are most popular)
    const slotCounts = await Booking.aggregate([
        { $match: { status: { $in: ['confirmed', 'completed'] } } },
        { $group: { _id: '$slot', bookings: { $sum: 1 } } }
    ])
    const bookingsPerSlot = SLOTS.map((slot) => {
        const row = slotCounts.find((s) => s._id === slot)
        return { slot, bookings: row ? row.bookings : 0 }
    })

    // 5. Bookings by status
    const statusRows = await Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    const bookingsByStatus = Object.fromEntries(statusRows.map((s) => [s._id, s.count]))

    // 6. Things waiting for the admin
    const roleRows = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
    const pendingChefs = await ChefProfile.countDocuments({ approvalStatus: 'pending' })
    const pendingStores = await GroceryStore.countDocuments({ approvalStatus: 'pending' })
    const openIssues = await Issue.countDocuments({ status: 'open' })

    res.status(200).json({
        status: 'success',
        totals,
        revenueByMonth,
        topChefs,
        topItems,
        bookingsPerSlot,
        bookingsByStatus,
        accounts: Object.fromEntries(roleRows.map((r) => [r._id, r.count])),
        waitingForAdmin: { pendingChefs, pendingStores, openIssues }
    })
}

// ---------- Settings ----------

export const getSettingsHandler = async (req, res) => {
    const settings = await getSettings()
    res.status(200).json({ status: 'success', settings })
}

export const updateSettings = async (req, res) => {
    const settings = await getSettings()
    Object.assign(settings, req.body)
    await settings.save()

    res.status(200).json({
        status: 'success',
        message: 'Settings updated. New values apply to new bookings only',
        settings
    })
}

// ---------- Grocery owner dashboard ----------

export const getStoreStats = async (req, res) => {
    const store = await GroceryStore.findOne({ owner: req.user._id })
    if (!store) {
        const error = new Error('Grocery store not found')
        error.statusCode = 404
        throw error
    }

    const salesRows = await Booking.aggregate([
        { $match: { groceryStore: store._id, status: 'completed' } },
        { $group: { _id: null, orders: { $sum: 1 }, sales: { $sum: '$grocerySubtotal' }, deliveryFees: { $sum: '$deliveryFee' } } }
    ])
    const openRows = await Booking.aggregate([
        {
            $match: {
                groceryStore: store._id,
                $or: [
                    { status: 'confirmed', groceryStatus: { $in: ['ordered', 'packed'] } },
                    { groceryStatus: 'return_requested' }
                ]
            }
        },
        { $group: { _id: '$groceryStatus', count: { $sum: 1 } } }
    ])

    res.status(200).json({
        status: 'success',
        store: { id: store._id, name: store.name, city: store.city },
        sales: salesRows[0] ? { orders: salesRows[0].orders, sales: salesRows[0].sales, deliveryFees: salesRows[0].deliveryFees } : { orders: 0, sales: 0, deliveryFees: 0 },
        needsAction: Object.fromEntries(openRows.map((r) => [r._id, r.count])),
        topItems: await bestSellingItems({ groceryStore: store._id })
    })
}
