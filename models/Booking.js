import mongoose from 'mongoose'
import cities from '../constants/cities.js'
import { SLOTS } from '../utils/time.js'

const bookingGroceryItemSchema = new mongoose.Schema(
    {
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryItem', required: true },
        name: { type: String, required: true },
        unit: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        lineTotal: { type: Number, required: true }
    },
    { _id: false }
)

const bookingSchema = new mongoose.Schema(
    {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        chef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        chefProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'ChefProfile', required: true },

        date: { type: String, required: true },
        slot: { type: String, enum: SLOTS, required: true },
        slotStart: { type: Date, required: true },
        slotEnd: { type: Date, required: true },

        note: { type: String, trim: true, maxlength: 500 },
        address: {
            city: { type: String, enum: cities, required: true },
            street: { type: String, trim: true, required: true }
        },

        // Copied at booking time so later changes never affect this booking
        chefRate: { type: Number, required: true },
        commissionRate: { type: Number, required: true },
        commissionAmount: { type: Number, required: true },

        groceryStore: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryStore' },
        groceryItems: { type: [bookingGroceryItemSchema], default: [] },
        grocerySubtotal: { type: Number, default: 0 },
        deliveryFee: { type: Number, default: 0 },

        totalFromCustomer: { type: Number, required: true },
        payableToPlatform: { type: Number, required: true },

        status: {
            type: String,
            enum: ['pending', 'confirmed', 'rejected', 'expired', 'cancelled', 'completed', 'disputed'],
            default: 'pending'
        },
        // true only while the booking holds the slot (confirmed, completed, disputed)
        slotLocked: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true },
        respondedAt: { type: Date },
        completedAt: { type: Date },
        cancelledBy: { type: String, enum: ['user', 'chef', 'admin', 'system'] },
        cancelReason: { type: String, trim: true },

        groceryStatus: {
            type: String,
            enum: ['none', 'ordered', 'packed', 'delivered_to_chef', 'return_requested', 'return_verified', 'cancelled'],
            default: 'none'
        },
        settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement' }
    },
    { timestamps: true }
)

// Two bookings can never hold the same chef, date and slot
bookingSchema.index(
    { chef: 1, date: 1, slot: 1 },
    { unique: true, partialFilterExpression: { slotLocked: true } }
)
// A customer cannot send two pending requests to the same chef for the same slot
bookingSchema.index(
    { customer: 1, chef: 1, date: 1, slot: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } }
)
bookingSchema.index({ chef: 1, status: 1 })
bookingSchema.index({ customer: 1, createdAt: -1 })

const Booking = mongoose.model('Booking', bookingSchema)

// Lazy status updates (no cron job on Vercel). Called before reading or
// acting on bookings:
// 1. pending requests past their 15-minute window become expired
// 2. confirmed bookings 24 hours after the slot ended become completed
export const refreshBookingStatuses = async (filter = {}) => {
    const now = new Date()
    await Booking.updateMany(
        { ...filter, status: 'pending', expiresAt: { $lt: now } },
        { status: 'expired' }
    )
    await Booking.updateMany(
        { ...filter, status: 'confirmed', slotEnd: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        { status: 'completed', completedAt: now }
    )
}

export default Booking
