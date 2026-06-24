const svc = require('_shared/bookingService')
const { listAvailableVenues, success, fail } = svc

exports.main = async () => {
  try {
    const data = await listAvailableVenues()
    return success(data)
  } catch (err) {
    console.error('getAvailableVenues error', err)
    return fail(err.code || 500, err.message || '查询可预约场室失败')
  }
}
