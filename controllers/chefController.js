import ChefProfile from '../models/ChefProfile.js'
import bcrypt from 'bcrypt'
import User from '../models/User.js'

export const registerChef = async (req, res) => {
    const { name, email, password, phone, city, address, cuisines, ratePerSlot, bio } = req.body

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
        role: 'chef'
    })

    let profile
    try {
        profile = await ChefProfile.create({
            user: user._id,
            city,
            address,
            cuisines,
            ratePerSlot,
            bio
        })
    } catch (err) {
        await User.findByIdAndDelete(user._id)
        const error = new Error('Could not create chef profile. Please try again')
        error.statusCode = 500
        throw error
    }

    res.status(201).json({
        status: 'success',
        message: 'Chef registered successfully. Your profile is pending approval',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        profile: {
            city: profile.city,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            approvalStatus: profile.approvalStatus
        }
    })
}
export const getMyProfile = async (req, res) => {
    const profile = await ChefProfile.findOne({ user: req.user._id })
    if (!profile) {
        const error = new Error('Chef profile not found')
        error.statusCode = 404
        throw error
    }

    res.status(200).json({
        status: 'success',
        profile: {
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            city: profile.city,
            address: profile.address,
            cuisines: profile.cuisines,
            ratePerSlot: profile.ratePerSlot,
            bio: profile.bio,
            phoneVerified: profile.phoneVerified,
            contractAccepted: !!profile.contractAcceptedAt,
            approvalStatus: profile.approvalStatus
        }
    })
}