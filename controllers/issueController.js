import mongoose from 'mongoose'
import Issue from '../models/Issue.js'
import Booking from '../models/Booking.js'
import { issueListQuerySchema } from '../zod-validator/issue_zod_schema.js'

const ISSUE_WINDOW = 24 * 60 * 60 * 1000   // until 24 hours after the slot ends

const httpError = (message, statusCode) => {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
}

// ---------- Customer or chef: report an issue ----------

export const createIssue = async (req, res) => {
    const { bookingId, reason, description } = req.body
    const me = req.user._id

    const booking = await Booking.findById(bookingId)
    if (!booking) {
        throw httpError('Booking not found', 404)
    }

    const isCustomer = booking.customer.equals(me)
    const isChef = booking.chef.equals(me)
    if (!isCustomer && !isChef) {
        throw httpError('You can only report an issue on your own booking', 403)
    }

    if (!['confirmed', 'completed', 'disputed'].includes(booking.status)) {
        throw httpError(`Issues can only be reported on confirmed or completed bookings (this one is ${booking.status})`, 400)
    }

    const now = Date.now()
    if (now < booking.slotStart.getTime()) {
        throw httpError('You can report an issue only after the slot has started', 400)
    }
    if (now > booking.slotEnd.getTime() + ISSUE_WINDOW) {
        throw httpError('The time to report an issue on this booking has passed (24 hours after the slot)', 400)
    }

    const already = await Issue.findOne({ booking: booking._id, reportedBy: me })
    if (already) {
        throw httpError('You have already reported an issue on this booking', 409)
    }

    const issue = await Issue.create({
        booking: booking._id,
        reportedBy: me,
        against: isCustomer ? booking.chef : booking.customer,
        reason,
        description
    })

    // The booking is on hold: no auto-complete and no commission until the admin decides
    booking.status = 'disputed'
    await booking.save()

    res.status(201).json({
        status: 'success',
        message: 'Issue reported. The admin will review it',
        issue: { id: issue._id, reason: issue.reason, status: issue.status }
    })
}

export const getMyIssues = async (req, res) => {
    const issues = await Issue.find({ reportedBy: req.user._id })
        .populate('booking', 'date slot status')
        .populate('against', 'name')
        .sort({ createdAt: -1 })

    res.status(200).json({ status: 'success', count: issues.length, issues })
}

// ---------- Admin: review and decide ----------

export const getIssues = async (req, res) => {
    const result = issueListQuerySchema.safeParse(req.query)
    if (!result.success) {
        throw httpError(result.error.issues[0].message, 400)
    }
    const { status, page, limit } = result.data

    const filter = {}
    if (status) filter.status = status

    const total = await Issue.countDocuments(filter)
    const issues = await Issue.find(filter)
        .populate('booking', 'date slot status')
        .populate('reportedBy', 'name role')
        .populate('against', 'name role status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

    res.status(200).json({
        status: 'success',
        issues,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
}

export const resolveIssue = async (req, res) => {
    const { id } = req.params
    const { decision, adminNote } = req.body

    if (!mongoose.isValidObjectId(id)) {
        throw httpError('Invalid issue id', 400)
    }
    const issue = await Issue.findById(id)
    if (!issue) {
        throw httpError('Issue not found', 404)
    }
    if (issue.status !== 'open') {
        throw httpError(`This issue is already marked ${issue.status}`, 409)
    }

    issue.status = decision
    issue.adminNote = adminNote
    issue.resolvedBy = req.user._id
    issue.resolvedAt = new Date()
    await issue.save()

    // When every issue on the booking is decided, the booking leaves "disputed":
    // any genuine issue -> cancelled (no commission), otherwise -> completed
    let bookingStatus = null
    const stillOpen = await Issue.exists({ booking: issue.booking, status: 'open' })
    if (!stillOpen) {
        const booking = await Booking.findById(issue.booking)
        if (booking && booking.status === 'disputed') {
            const anyGenuine = await Issue.exists({ booking: issue.booking, status: 'genuine' })
            if (anyGenuine) {
                booking.status = 'cancelled'
                booking.slotLocked = false
                booking.cancelledBy = 'admin'
                booking.cancelReason = 'Issue confirmed by admin'
            } else {
                booking.status = 'completed'
                booking.completedAt = new Date()
            }
            await booking.save()
            bookingStatus = booking.status
        }
    }

    res.status(200).json({
        status: 'success',
        message: `Issue marked as ${decision}`,
        bookingStatus
    })
}
