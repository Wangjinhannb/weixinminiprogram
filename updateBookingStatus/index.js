const svc = require('_shared/bookingService')
const { cloud, db, getBookingById, normalizeBooking, createNotificationLog, assertAdminUser, fail, success } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (!event.bookingId || !event.status) return fail(400, '缺少 bookingId 或 status')
    await assertAdminUser(wxContext.OPENID)
    await db.collection('bookings').doc(event.bookingId).update({ data: { status: event.status, updatedAt: db.serverDate() } })
    const latest = await getBookingById(event.bookingId)
    const latestView = normalizeBooking(latest)
    await createNotificationLog({ booking: latest, type: 'BOOKING_STATUS_CHANGED', title: '预约状态已变更', content: `预约状态更新为：${latestView.status}` })
    return success(latestView, '状态更新成功')
  } catch (err) {
    console.error('updateBookingStatus error', err)
    return fail(err.code || 500, err.message || '状态更新失败')
  }
}
