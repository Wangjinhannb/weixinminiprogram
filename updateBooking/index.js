const svc = require('_shared/bookingService')
const { cloud, db, getBookingById, ensureNoConflict, normalizeBooking, createNotificationLog, syncSubscriptionReminderForBooking, assertVenueBookableForPublic, buildVenueSnapshot, validateBookingPayload, assertBookingStartTimeNotPast, assertBookingPeopleWithinLimit, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const bookingId = event.bookingId
  try {
    if (!bookingId) return fail(400, '缺少 bookingId')
    const oldBooking = await getBookingById(bookingId)
    if (!oldBooking) return fail(404, '预约不存在')
    if (oldBooking.userId !== wxContext.OPENID) return fail(403, '无权改期该预约')
    if (oldBooking.status === 'cancelled') return fail(400, '已取消预约不可改期')

    const payload = validateBookingPayload({
      userId: wxContext.OPENID,
      venueId: event.venueId || oldBooking.venueId,
      date: event.date || oldBooking.date,
      startTime: event.startTime || oldBooking.startTime,
      endTime: event.endTime || oldBooking.endTime,
      timeLabel: event.timeLabel,
      form: event.form || oldBooking.form || {}
    })
    const { venue } = await assertVenueBookableForPublic(payload.venueId, payload.startTime, payload.endTime, payload.date)
    assertBookingStartTimeNotPast(payload.date, payload.startTime)
    const peopleCheck = assertBookingPeopleWithinLimit(venue, payload)
    await ensureNoConflict(payload, bookingId)
    const history = Array.isArray(oldBooking.rescheduleHistory) ? oldBooking.rescheduleHistory.slice() : []
    history.push({
      fromVenueId: oldBooking.venueId,
      fromVenueName: oldBooking.venueName || ((oldBooking.venueSnapshot && oldBooking.venueSnapshot.name) || ''),
      fromDate: oldBooking.date,
      fromStartTime: oldBooking.startTime,
      fromEndTime: oldBooking.endTime,
      fromTimeLabel: oldBooking.timeLabel,
      toVenueId: payload.venueId,
      toVenueName: venue.name,
      toDate: payload.date,
      toStartTime: payload.startTime,
      toEndTime: payload.endTime,
      toTimeLabel: payload.timeLabel,
      changedAtText: new Date().toISOString(),
      changedBy: wxContext.OPENID
    })
    await db.collection('bookings').doc(bookingId).update({
      data: {
        venueId: payload.venueId,
        venueName: venue.name,
        venueSnapshot: buildVenueSnapshot(venue),
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        timeLabel: payload.timeLabel,
        form: payload.form,
        peopleCount: peopleCheck.peopleCount,
        maxPeopleLimitSnapshot: peopleCheck.maxPeopleLimit,
        rescheduleHistory: history,
        lastRescheduledAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    const latest = await getBookingById(bookingId)
    const latestView = normalizeBooking(latest)
    await syncSubscriptionReminderForBooking(latest)
    await createNotificationLog({ booking: latest, type: 'BOOKING_RESCHEDULED', title: '预约已改期', content: `预约已改期为 ${latestView.date} ${latestView.timeLabel}` })
    return success(latestView, '改期成功')
  } catch (err) {
    console.error('updateBooking error', err)
    return fail(err.code === 'CONFLICT' ? 409 : (err.code || 500), err.message || '改期失败')
  }
}
