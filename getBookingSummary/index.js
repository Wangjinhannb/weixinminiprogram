const svc = require('_shared/bookingService')
const { cloud, assertAdminUser, listBookingSummary, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    await assertAdminUser(wxContext.OPENID)
    const data = await listBookingSummary({
      venueId: event.venueId || '',
      date: event.date || ''
    })
    return success(data)
  } catch (err) {
    console.error('getBookingSummary error', err)
    return fail(err.code || 500, err.message || '查询报名人数汇总失败')
  }
}
