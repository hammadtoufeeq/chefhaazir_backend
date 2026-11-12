import express from 'express'
import { createBooking, getMyBookings, getChefBookings, getBookingById, acceptBooking, rejectBooking } from '../controllers/bookingController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { createBookingSchema } from '../zod-validator/booking_zod_schema.js'

const router = express.Router()

router.post('/', protect, requireRole('user'), validate(createBookingSchema), createBooking)
router.get('/mine', protect, requireRole('user'), getMyBookings)
router.get('/chef', protect, requireRole('chef'), getChefBookings)
router.get('/:id', protect, getBookingById)
router.patch('/:id/accept', protect, requireRole('chef'), acceptBooking)
router.patch('/:id/reject', protect, requireRole('chef'), rejectBooking)

export default router
