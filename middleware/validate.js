export const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body)
        if (!result.success) {
            const error = new Error(result.error.issues[0].message)
            error.statusCode = 400
            throw error
        }
        req.body = result.data
        next()
    }
}