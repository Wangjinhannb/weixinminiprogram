const svc = require('_shared/bookingService')
const { cloud, listBookingsByFilter, sortBookings, success, fail } = svc

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  try {
    const userId = wxContext.OPENID
    const list = await listBookingsByFilter({ userId })
    return success(sortBookings(list, 'desc'))
  } catch (err) {
    console.error('getMyBookings error', err)
    return fail(500, err.message || '查询我的预约失败')
  }
}
