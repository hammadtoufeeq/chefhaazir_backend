import mongoose from 'mongoose'

export const ISSUE_REASONS = ['customer_not_home', 'chef_no_show', 'bad_behaviour', 'payment_problem', 'other']

const issueSchema = new mongoose.Schema(
    {
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        against: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, enum: ISSUE_REASONS, required: true },
        description: { type: String, trim: true, required: true, maxlength: 500 },
        status: { type: String, enum: ['open', 'genuine', 'dismissed'], default: 'open' },
        adminNote: { type: String, trim: true },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        resolvedAt: { type: Date }
    },
    { timestamps: true }
)

// One report per person per booking
issueSchema.index({ booking: 1, reportedBy: 1 }, { unique: true })
issueSchema.index({ against: 1, status: 1 })

const Issue = mongoose.model('Issue', issueSchema)

export default Issue
