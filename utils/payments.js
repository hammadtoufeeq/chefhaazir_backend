import Booking from '../models/Booking.js'
import { getSettings } from '../models/Setting.js'

const DAY = 24 * 60 * 60 * 1000
const ISSUE_WINDOW = DAY   // customers can report an issue until 24 hours after the slot

// Bookings the chef owes money for and has not paid yet:
// - completed bookings: commission + groceries + delivery
// - cancelled bookings whose groceries reached the chef and were not returned:
//   groceries + delivery
// A booking becomes payable only after its issue window closes.
export const payableFilter = (extra = {}) => ({
    settlement: null,
    slotEnd: { $lte: new Date(Date.now() - ISSUE_WINDOW) },
    $or: [
        { status: 'completed' },
        { status: 'cancelled', groceryStatus: { $in: ['delivered_to_chef', 'return_requested'] } }
    ],
    ...extra
})

// What the chef owes for one booking
export const amountOwed = (booking) => {
    if (booking.status === 'completed') return booking.payableToPlatform
    return booking.grocerySubtotal + booking.deliveryFee
}

// Payable bookings older than the payment block limit (3 days by default)
const overdueFilter = async (extra = {}) => {
    const settings = await getSettings()
    return payableFilter({
        slotEnd: { $lte: new Date(Date.now() - ISSUE_WINDOW - settings.paymentBlockDays * DAY) },
        ...extra
    })
}

// Is this chef blocked for not paying on time?
export const isChefPaymentBlocked = async (chefUserId) => {
    const overdue = await Booking.exists(await overdueFilter({ chef: chefUserId }))
    return !!overdue
}

// Ids of all chef accounts that are currently payment-blocked
export const getPaymentBlockedChefIds = async () => {
    return Booking.distinct('chef', await overdueFilter())
}
