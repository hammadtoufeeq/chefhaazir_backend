// Fills the database with sample chefs, grocery stores and grocery items for testing.
//
//   npm run seed            add the sample data (safe to run again: existing records are skipped)
//   npm run seed -- --reset remove everything this script added, then add it again
//   npm run seed -- --clear remove everything this script added and stop
//
// Every sample account uses an @seed.chefhaazir.pk email, so it never touches real accounts.
// All sample accounts share the password in SEED_PASSWORD below.

import 'dotenv/config'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'
import ChefProfile from '../models/ChefProfile.js'
import GroceryStore from '../models/GroceryStore.js'
import GroceryItem from '../models/GroceryItem.js'

const SEED_DOMAIN = 'seed.chefhaazir.pk'
const SEED_PASSWORD = 'Chef12345'

// ---------- Chefs (approved, phone verified, contract accepted) ----------
const chefs = [
    // Lahore
    { name: 'Shabana Aunty', city: 'Lahore', address: 'House 12, Block C, Gulberg III, Lahore', cuisines: ['Desi', 'Karahi', 'Biryani & Rice'], ratePerSlot: 1500, bio: 'I cook like I cook for my own sons: slow bhunai, desi ghee and plenty of love. Famous for my chicken karahi and aloo gosht.' },
    { name: 'Farzana Baji', city: 'Lahore', address: 'Street 4, Phase 5, DHA, Lahore', cuisines: ['Biryani & Rice', 'Desi', 'Healthy'], ratePerSlot: 1400, bio: 'Balanced spices and light, wholesome everyday cooking. Sindhi biryani, haleem and soft chapatis are my favourites.' },
    { name: 'Uncle Tariq', city: 'Lahore', address: 'House 7, Model Town Extension, Lahore', cuisines: ['BBQ', 'Karahi', 'Desi'], ratePerSlot: 1800, bio: 'Forty years of dawat recipes. Slow nihari, tandoori chicken and a proper BBQ platter for weekend gatherings.' },
    { name: 'Nasreen Khala', city: 'Lahore', address: 'House 88, Johar Town Block J, Lahore', cuisines: ['Desi', 'Breakfast'], ratePerSlot: 900, bio: 'Halwa puri, aloo paratha and chanay for Sunday nashta. Simple ghar ka khana for students on a budget.' },
    { name: 'Chef Bilal Ahmed', city: 'Lahore', address: 'Flat 3, Cavalry Ground, Lahore', cuisines: ['Continental', 'Chinese', 'Fast Food'], ratePerSlot: 2500, bio: 'Hotel-trained chef. Chicken manchurian, steak with mushroom sauce, pasta and loaded fries for movie nights.' },
    { name: 'Rukhsana Begum', city: 'Lahore', address: 'House 21, Samanabad, Lahore', cuisines: ['Baking & Desserts', 'Desi'], ratePerSlot: 1200, bio: 'Kheer, gajar ka halwa, zarda and fresh cakes. I also cook a simple daal chawal while the dessert sets.' },

    // Karachi
    { name: 'Zubaida Apa', city: 'Karachi', address: 'House 5, Block 13-D, Gulshan-e-Iqbal, Karachi', cuisines: ['Biryani & Rice', 'Desi', 'Karahi'], ratePerSlot: 1600, bio: 'Karachi-style biryani with aloo, haleem and bun kabab. Cooking for families in Gulshan for over 20 years.' },
    { name: 'Chef Imran Qureshi', city: 'Karachi', address: 'Flat 9, Clifton Block 2, Karachi', cuisines: ['BBQ', 'Fast Food', 'Continental'], ratePerSlot: 3000, bio: 'Seekh kabab, chicken tikka and grilled fish for rooftop dawats. I bring the skewers, you bring the guests.' },
    { name: 'Saima Baji', city: 'Karachi', address: 'House 44, North Nazimabad Block H, Karachi', cuisines: ['Desi', 'Healthy', 'Breakfast'], ratePerSlot: 1000, bio: 'Daily meal prep for working bachelors: daal, sabzi, roti and a light salan. Less oil, full taste.' },
    { name: 'Hameeda Khanum', city: 'Karachi', address: 'House 2, PECHS Block 6, Karachi', cuisines: ['Desi', 'Baking & Desserts'], ratePerSlot: 1300, bio: 'Nihari, paya and shahi tukray. My kitchen smells like Burns Road on a Sunday morning.' },

    // Islamabad / Rawalpindi
    { name: 'Ammi Jan Kausar', city: 'Islamabad', address: 'House 31, Street 12, F-7/2, Islamabad', cuisines: ['Desi', 'Karahi'], ratePerSlot: 1700, bio: 'Peshawari karahi, chapli kabab and kabuli pulao. Generous portions for hostel groups.' },
    { name: 'Chef Sana Malik', city: 'Islamabad', address: 'Flat 4, G-11 Markaz, Islamabad', cuisines: ['Healthy', 'Continental', 'Chinese'], ratePerSlot: 2200, bio: 'High-protein bowls, grilled chicken and stir-fries for people who want ghar ka khana without the heaviness.' },
    { name: 'Uncle Javed', city: 'Rawalpindi', address: 'House 10, Satellite Town Block B, Rawalpindi', cuisines: ['BBQ', 'Desi', 'Biryani & Rice'], ratePerSlot: 1500, bio: 'Pindi-style chanay, tikka boti and mutton pulao. Weekend dawats are my speciality.' },

    // Other cities
    { name: 'Razia Bibi', city: 'Faisalabad', address: 'House 17, Peoples Colony No. 1, Faisalabad', cuisines: ['Desi', 'Breakfast'], ratePerSlot: 800, bio: 'Saag, makki ki roti, lassi and desi breakfasts the way they are made in the village.' },
    { name: 'Shagufta Aunty', city: 'Multan', address: 'House 3, Gulgasht Colony, Multan', cuisines: ['Desi', 'Baking & Desserts', 'Karahi'], ratePerSlot: 1100, bio: 'Multani sohan halwa, sajji and mutton karahi. Big flavours, small budget.' },
    { name: 'Gul Khan', city: 'Peshawar', address: 'House 9, Hayatabad Phase 3, Peshawar', cuisines: ['BBQ', 'Karahi', 'Biryani & Rice'], ratePerSlot: 1400, bio: 'Namak mandi karahi, chapli kabab and kabuli pulao cooked the Peshawari way, in pure ghee.' }
]

// ---------- Grocery stores (approved) and their items ----------
const stores = [
    { owner: 'Lahore Store Manager', city: 'Lahore', name: 'Chef Haazir Store Lahore', address: 'Shop 4, Main Market, Gulberg II, Lahore' },
    { owner: 'Karachi Store Manager', city: 'Karachi', name: 'Chef Haazir Store Karachi', address: 'Shop 11, Tariq Road, PECHS, Karachi' },
    { owner: 'Islamabad Store Manager', city: 'Islamabad', name: 'Chef Haazir Store Islamabad', address: 'Shop 2, F-10 Markaz, Islamabad' }
]

// [name, category, price (Rs), unit, inStock]
const items = [
    ['Chicken (whole, cleaned)', 'Meat & Chicken', 720, 'kg', true],
    ['Chicken boneless', 'Meat & Chicken', 1150, 'kg', true],
    ['Mutton', 'Meat & Chicken', 2400, 'kg', true],
    ['Beef (boneless)', 'Meat & Chicken', 1500, 'kg', true],
    ['Beef mince (qeema)', 'Meat & Chicken', 1300, 'kg', true],
    ['Basmati rice (sella)', 'Atta & Rice', 420, 'kg', true],
    ['Chakki atta', 'Atta & Rice', 140, 'kg', true],
    ['Maida', 'Atta & Rice', 150, 'kg', true],
    ['Onions', 'Vegetables', 160, 'kg', true],
    ['Tomatoes', 'Vegetables', 180, 'kg', true],
    ['Potatoes', 'Vegetables', 110, 'kg', true],
    ['Green chillies', 'Vegetables', 60, 'pack', true],
    ['Ginger', 'Vegetables', 120, 'pack', true],
    ['Garlic', 'Vegetables', 100, 'pack', true],
    ['Fresh coriander (dhania)', 'Vegetables', 40, 'pack', true],
    ['Spinach (palak)', 'Vegetables', 80, 'kg', false],
    ['Lemons', 'Fruits', 60, 'pack', true],
    ['Bananas', 'Fruits', 180, 'dozen', true],
    ['Red chilli powder', 'Spices & Masala', 150, 'pack', true],
    ['Haldi (turmeric)', 'Spices & Masala', 120, 'pack', true],
    ['Garam masala', 'Spices & Masala', 180, 'pack', true],
    ['Biryani masala', 'Spices & Masala', 140, 'pack', true],
    ['Karahi masala', 'Spices & Masala', 140, 'pack', true],
    ['Zeera (cumin)', 'Spices & Masala', 160, 'pack', true],
    ['Fresh milk', 'Dairy & Eggs', 220, 'litre', true],
    ['Yogurt (dahi)', 'Dairy & Eggs', 240, 'kg', true],
    ['Eggs', 'Dairy & Eggs', 380, 'dozen', true],
    ['Butter', 'Dairy & Eggs', 320, 'pack', true],
    ['Cooking oil', 'Oil & Ghee', 560, 'litre', true],
    ['Desi ghee', 'Oil & Ghee', 1100, 'kg', true],
    ['Banaspati ghee', 'Oil & Ghee', 520, 'kg', true],
    ['Daal masoor', 'Daal & Pulses', 320, 'kg', true],
    ['Daal chana', 'Daal & Pulses', 280, 'kg', true],
    ['Daal mash', 'Daal & Pulses', 480, 'kg', true],
    ['Safaid chanay', 'Daal & Pulses', 340, 'kg', true],
    ['Salt', 'Other', 60, 'pack', true],
    ['Sugar', 'Other', 160, 'kg', true],
    ['Tea leaves', 'Other', 450, 'pack', true]
]

// ---------- Helpers ----------
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
const emailFor = (name) => `${slug(name)}@${SEED_DOMAIN}`
const seedEmailRegex = new RegExp(`@${SEED_DOMAIN.replace(/\./g, '\\.')}$`)

// Unique, valid Pakistani mobile numbers: 0300 0000 001, 0300 0000 002, ...
let phoneCounter = 0
const nextPhone = () => `0300${String(++phoneCounter).padStart(7, '0')}`

const clearSeed = async () => {
    const users = await User.find({ email: seedEmailRegex }).select('_id')
    const userIds = users.map((u) => u._id)
    const seedStores = await GroceryStore.find({ owner: { $in: userIds } }).select('_id')
    const storeIds = seedStores.map((s) => s._id)

    const removedItems = await GroceryItem.deleteMany({ store: { $in: storeIds } })
    await GroceryStore.deleteMany({ _id: { $in: storeIds } })
    await ChefProfile.deleteMany({ user: { $in: userIds } })
    await User.deleteMany({ _id: { $in: userIds } })

    console.log(`Removed ${userIds.length} sample accounts, ${storeIds.length} stores and ${removedItems.deletedCount} grocery items`)
}

const seed = async () => {
    const args = process.argv.slice(2)
    await connectDB().catch((error) => { console.error(`MongoDB connection failed: ${error.message}`); process.exit(1) })

    if (args.includes('--clear') || args.includes('--reset')) await clearSeed()
    if (args.includes('--clear')) return

    const password = await bcrypt.hash(SEED_PASSWORD, 12)
    const now = new Date()

    // Chefs
    let chefsAdded = 0
    for (const chef of chefs) {
        const email = emailFor(chef.name)
        if (await User.exists({ email })) continue

        const user = await User.create({ name: chef.name, email, password, phone: nextPhone(), role: 'chef' })
        try {
            await ChefProfile.create({
                user: user._id,
                city: chef.city,
                address: chef.address,
                cuisines: chef.cuisines,
                ratePerSlot: chef.ratePerSlot,
                bio: chef.bio,
                phoneVerified: true,
                contractAcceptedAt: now,
                declarationAcceptedAt: now,
                approvalStatus: 'approved'
            })
        } catch (error) {
            await User.deleteOne({ _id: user._id })   // no half accounts
            throw error
        }
        chefsAdded++
    }
    console.log(`Chefs: ${chefsAdded} added, ${chefs.length - chefsAdded} already there`)

    // Grocery stores and items
    for (const s of stores) {
        const email = emailFor(s.owner)
        let owner = await User.findOne({ email })
        let store = owner && await GroceryStore.findOne({ owner: owner._id })

        if (!store) {
            // A real approved store may already exist in this city (only one is allowed)
            const existing = await GroceryStore.findOne({ city: s.city, approvalStatus: 'approved' })
            if (existing) {
                console.log(`${s.city}: an approved store already exists (${existing.name}), skipped`)
                continue
            }
            if (!owner) owner = await User.create({ name: s.owner, email, password, phone: nextPhone(), role: 'grocery_owner' })
            store = await GroceryStore.create({ owner: owner._id, name: s.name, city: s.city, address: s.address, approvalStatus: 'approved' })
        }

        let itemsAdded = 0
        for (const [name, category, price, unit, inStock] of items) {
            const result = await GroceryItem.updateOne(
                { store: store._id, name },
                { $setOnInsert: { store: store._id, name, category, price, unit, inStock } },
                { upsert: true }
            )
            if (result.upsertedCount) itemsAdded++
        }
        console.log(`${s.city}: store "${store.name}", ${itemsAdded} items added`)
    }

    // One sample customer to try bookings with
    const customerEmail = `customer@${SEED_DOMAIN}`
    if (!(await User.exists({ email: customerEmail }))) {
        await User.create({ name: 'Ali Raza', email: customerEmail, password, phone: nextPhone(), role: 'user', city: 'Lahore', address: 'Room 14, Al-Noor Hostel, Gulberg II, Lahore' })
        console.log('Customer: added')
    }

    console.log(`\nDone. Sample logins (password for all: ${SEED_PASSWORD})`)
    console.log(`  Customer:      ${customerEmail}`)
    console.log(`  Chef:          ${emailFor(chefs[0].name)}`)
    console.log(`  Grocery owner: ${emailFor(stores[0].owner)}`)
}

seed()
    .catch((error) => { console.error(error.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
