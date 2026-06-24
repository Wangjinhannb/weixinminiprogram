const svc = require('_shared/bookingService')
const { cloud, getBookingById, upsertSubscription } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (!event.bookingId) return { code: 400, message: '缺少 bookingId' }
    const booking = await getBookingById(event.bookingId)
    if (!booking) return { code: 404, message: '预约不存在' }
    if (booking.userId !== wxContext.OPENID) return { code: 403, message: '仅预约人可订阅通知' }
    const saved = await upsertSubscription({
      bookingId: event.bookingId,
      userId: wxContext.OPENID,
      enabled: !!event.enabled,
      tmplIds: event.tmplIds || [],
      acceptResultMap: event.acceptResultMap || {},
      templateConfigMap: event.templateConfigMap || {},
      reminderEnabled: !!event.reminderEnabled,
      reminderLeadMinutes: Number(event.reminderLeadMinutes || 0),
      booking
    })
    return { code: 200, data: saved, message: event.enabled ? '订阅成功' : '已取消订阅' }
  } catch (err) {
    console.error('saveSubscription error', err)
    return { code: 500, message: err.message || '保存订阅失败' }
  }
}
