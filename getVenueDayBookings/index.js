const svc = require('_shared/bookingService')
const { cloud, listVenueDayBookings, listBookingsByFilter, sanitizePublicBooking, normalizeBooking, assertAdminUser, getVenueByVenueId, assertValidDateStringOrThrow, fail, success } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (!event.venueId || !event.date) return fail(400, '缺少 venueId 或 date')
    assertValidDateStringOrThrow(event.date)

    if (event.includeCancelled) {
      await assertAdminUser(wxContext.OPENID)
      const adminList = await listBookingsByFilter({ venueId: event.venueId, date: event.date })
      return success((adminList || []).map(normalizeBooking))
    }

    const venue = await getVenueByVenueId(event.venueId, { includeDeleted: true, allowLegacyFallback: true })
    if (!venue || venue.deleted || !venue.visible) return success([])
    const data = await listVenueDayBookings(event.venueId, event.date, false)
    return success((data || []).map(sanitizePublicBooking))
  } catch (err) {
    console.error('getVenueDayBookings error', err)
    return fail(err.code || 500, err.message || '查询失败')
  }
}
