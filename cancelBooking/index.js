const svc = require('_shared/bookingService')
const { cloud, db, getBookingById, normalizeBooking, createNotificationLog, syncSubscriptionReminderForBooking, fail, success } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const bookingId = event.bookingId
  try {
    if (!bookingId) return fail(400, '缺少 bookingId')
    const booking = await getBookingById(bookingId)
    if (!booking) return fail(404, '预约不存在')
    if (booking.userId !== wxContext.OPENID) return fail(403, '无权取消该预约')
    if (booking.status === 'cancelled') return success(normalizeBooking(booking), '预约已取消')
    await db.collection('bookings').doc(bookingId).update({
      data: { status: 'cancelled', cancelReason: event.reason || '', cancelledAt: db.serverDate(), updatedAt: db.serverDate() }
    })
    const latest = await getBookingById(bookingId)
    const latestView = normalizeBooking(latest)
    await syncSubscriptionReminderForBooking(latest)
    await createNotificationLog({ booking: latest, type: 'BOOKING_CANCELLED', title: '预约已取消', content: `预约 ${latestView.date} ${latestView.timeLabel} 已取消` })
    return success(latestView, '取消成功')
  } catch (err) {
    console.error('cancelBooking error', err)
    return fail(err.code || 500, err.message || '取消失败')
  }
}
