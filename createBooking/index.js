const svc = require('_shared/bookingService')
const { cloud, db, validateBookingPayload, assertVenueBookableForPublic, ensureNoConflict, normalizeBooking, buildVenueSnapshot, assertBookingStartTimeNotPast, assertBookingPeopleWithinLimit, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    const payload = validateBookingPayload({
      userId,
      venueId: event.venueId,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      timeLabel: event.timeLabel,
      form: event.form || {}
    })
    const { venue } = await assertVenueBookableForPublic(payload.venueId, payload.startTime, payload.endTime, payload.date)
    assertBookingStartTimeNotPast(payload.date, payload.startTime)
    const peopleCheck = assertBookingPeopleWithinLimit(venue, payload)
    await ensureNoConflict(payload)
    const newBookingData = {
      userId,
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
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    const result = await db.collection('bookings').add({ data: newBookingData })
    return success(normalizeBooking(Object.assign({ _id: result._id }, newBookingData)), '预约成功')
  } catch (err) {
    console.error('createBooking error:', err)
    return fail(err.code === 'CONFLICT' ? 409 : (err.code || 500), err.message || '服务器异常，请稍后再试')
  }
}
