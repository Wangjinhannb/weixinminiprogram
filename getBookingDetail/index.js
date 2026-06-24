const svc = require('_shared/bookingService')
const { cloud, getBookingById, normalizeBooking, assertAdminUser, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (!event.bookingId) return fail(400, '缺少 bookingId')
    const booking = await getBookingById(event.bookingId)
    if (!booking) return success(null)
    if (booking.userId !== wxContext.OPENID) {
      await assertAdminUser(wxContext.OPENID)
    }
    return success(normalizeBooking(booking))
  } catch (err) {
    console.error('getBookingDetail error', err)
    return fail(err.code || 500, err.message || '查询失败')
  }
}
