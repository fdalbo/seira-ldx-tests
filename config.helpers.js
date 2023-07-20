

module.exports.getArtilleryUser = () => {
    const workerIdx = parseInt(process.env.LOCAL_WORKER_ID ?? '')
    if (isNaN(workerIdx)) {
        throw new Error(`Unexpected empty 'LOCAL_WORKER_ID' env variable`)
    }
    const userPrefix = process.env.SLDX_USER_PREFIX ?? 'user'
    if (userPrefix.length == 0) {
        throw new Error(`Unexpected empty 'SLDX_USER_PREFIX' env variable`)
    }
    /**
     * userPrefix1, 2, 3....
     */
    const userFirstIdx = workerIdx + parseInt(process.env.SLDX_USER_FIRST_IDX ?? '0')
    if (isNaN(userFirstIdx)) {
        throw new Error(`Unexpected empty 'SLDX_USER_FIRST_IDX' env variable`)
    }
    return `${userPrefix}${userFirstIdx}`
}
module.exports.getPlaywrightUser = () => {
    const user = process.env.SLDX_PLAYWRIGHT_USER ?? ''
    if (user.length == 0) {
        throw new Error(`Unexpected empty 'SLDX_PLAYWRIGHT_USER' env variable`)
    }
    return user
}