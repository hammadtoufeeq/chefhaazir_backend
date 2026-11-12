// Pakistan has no daylight saving, so it is always UTC+5
const PAKISTAN_OFFSET = '+05:00'

export const SLOTS = ['08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22']

// Exact start and end instants of a slot on a Pakistan date (YYYY-MM-DD)
export const getSlotTimes = (date, slot) => {
    const [startHour, endHour] = slot.split('-')
    return {
        slotStart: new Date(`${date}T${startHour}:00:00${PAKISTAN_OFFSET}`),
        slotEnd: new Date(`${date}T${endHour}:00:00${PAKISTAN_OFFSET}`)
    }
}

// Today's date in Pakistan as YYYY-MM-DD
export const todayInPakistan = () => {
    return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Adds whole days to a YYYY-MM-DD date
export const addDays = (date, days) => {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

// True only for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30)
export const isValidDate = (date) => {
    const d = new Date(`${date}T00:00:00Z`)
    return !isNaN(d) && d.toISOString().slice(0, 10) === date
}

export const HOUR = 60 * 60 * 1000
export const MINUTE = 60 * 1000
