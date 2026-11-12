import mongoose from 'mongoose'

// A record of one payment a chef sends to the platform
const settlementSchema = new mongoose.Schema(
    {
        chef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
        amount: { type: Number, required: true, min: 1 },
        method: { type: String, enum: ['cash', 'jazzcash', 'easypaisa', 'bank'], required: true },
        transactionId: { type: String, trim: true },
        status: { type: String, enum: ['submitted', 'verified', 'rejected'], default: 'submitted' },
        submittedAt: { type: Date, default: Date.now },
        verifiedAt: { type: Date },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectReason: { type: String, trim: true },
        proofImage: { type: String }   // empty for now; screenshot upload (Multer) later
    },
    { timestamps: true }
)

settlementSchema.index({ chef: 1, status: 1 })

const Settlement = mongoose.model('Settlement', settlementSchema)

export default Settlement
