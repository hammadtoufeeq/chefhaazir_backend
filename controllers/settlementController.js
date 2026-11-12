import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Settlement from '../models/Settlement.js'
import { payableFilter, amountOwed, isChefPaymentBlocked } from '../utils/payments.js'
import { settlementListQuerySchema } from '../zod-validator/settlement_zod_schema.js'

const httpError = (message, statusCode) => {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
}

// ---------- Chef: earnings breakdown ----------

export const getMyEarnings = async (req, res) => {
    const chefId = req.user._id

    const payable = await Booking.find(payableFilter({ chef: chefId }))
        .select('date slot status chefRate grocerySubtotal deliveryFee commissionAmount payableToPlatform totalFromCustomer groceryStatus')
        .sort({ slotStart: 1 })
    const totalDue = payable.reduce((sum, b) => sum + amountOwed(b), 0)

    const awaiting = await Settlement.findOne({ chef: chefId, status: 'submitted' }).select('amount method transactionId submittedAt')
    const blocked = await isChefPaymentBlocked(chefId)

    // Recent completed bookings with their full breakdown
    const recent = await Booking.find({ chef: chefId, status: 'completed' })
        .select('date slot chefRate grocerySubtotal deliveryFee totalFromCustomer commissionAmount payableToPlatform settlement')
        .sort({ slotStart: -1 })
        .limit(20)

    res.status(200).json({
        status: 'success',
        summary: {
            totalDue,
            payableBookings: payable.length,
            awaitingVerification: awaiting,
            paymentBlocked: blocked
        },
        payable: payable.map((b) => ({ ...b.toObject(), owed: amountOwed(b) })),
        recentBookings: recent.map((b) => ({
            id: b._id,
            date: b.date,
            slot: b.slot,
            chefFee: b.chefRate,
            groceries: b.grocerySubtotal,
            delivery: b.deliveryFee,
            collectFromCustomer: b.totalFromCustomer,
            commission: b.commissionAmount,
            payToPlatform: b.payableToPlatform,
            chefKeeps: b.chefRate - b.commissionAmount,
            settled: !!b.settlement
        }))
    })
}

// ---------- Chef: submit a payment ----------

export const createSettlement = async (req, res) => {
    const chefId = req.user._id
    const { method, transactionId } = req.body

    const awaiting = await Settlement.findOne({ chef: chefId, status: 'submitted' })
    if (awaiting) {
        throw httpError('You already have a payment waiting for verification', 409)
    }

    const payable = await Booking.find(payableFilter({ chef: chefId }))
    if (payable.length === 0) {
        throw httpError('You have nothing to pay right now', 400)
    }
    const amount = payable.reduce((sum, b) => sum + amountOwed(b), 0)

    const settlement = await Settlement.create({
        chef: chefId,
        bookings: payable.map((b) => b._id),
        amount,
        method,
        transactionId
    })

    // Link the bookings to this payment so they are no longer counted as due
    await Booking.updateMany({ _id: { $in: settlement.bookings } }, { settlement: settlement._id })

    res.status(201).json({
        status: 'success',
        message: 'Payment submitted. The admin will verify it',
        settlement: { id: settlement._id, amount, method, bookings: settlement.bookings.length, status: settlement.status }
    })
}

export const getMySettlements = async (req, res) => {
    const settlements = await Settlement.find({ chef: req.user._id })
        .select('-bookings')
        .sort({ createdAt: -1 })

    res.status(200).json({ status: 'success', count: settlements.length, settlements })
}

// ---------- Admin: review payments ----------

export const getSettlements = async (req, res) => {
    const result = settlementListQuerySchema.safeParse(req.query)
    if (!result.success) {
        throw httpError(result.error.issues[0].message, 400)
    }
    const { chef, status, page, limit } = result.data

    const filter = {}
    if (chef) filter.chef = chef
    if (status) filter.status = status

    const total = await Settlement.countDocuments(filter)
    const settlements = await Settlement.find(filter)
        .populate('chef', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        settlements,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

const findSubmittedSettlement = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid settlement id', 400)
    }
    const settlement = await Settlement.findById(id)
    if (!settlement) {
        throw httpError('Settlement not found', 404)
    }
    if (settlement.status !== 'submitted') {
        throw httpError(`This payment is already ${settlement.status}`, 409)
    }
    return settlement
}

export const verifySettlement = async (req, res) => {
    const settlement = await findSubmittedSettlement(req.params.id)

    settlement.status = 'verified'
    settlement.verifiedAt = new Date()
    settlement.verifiedBy = req.user._id
    await settlement.save()

    res.status(200).json({ status: 'success', message: `Payment of Rs ${settlement.amount} verified` })
}

export const rejectSettlement = async (req, res) => {
    const settlement = await findSubmittedSettlement(req.params.id)

    settlement.status = 'rejected'
    settlement.rejectReason = req.body.reason
    settlement.verifiedBy = req.user._id
    await settlement.save()

    // The bookings go back to the chef's amount due
    await Booking.updateMany({ settlement: settlement._id }, { settlement: null })

    res.status(200).json({ status: 'success', message: 'Payment rejected. The bookings are due again' })
}
