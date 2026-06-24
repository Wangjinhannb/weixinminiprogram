const svc = require('_shared/bookingService')
const { cloud, assertAdminUser, listBookingsByFilter, sortBookings, enrichAdminBookings, listAvailableVenues, buildVenueSnapshot, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    await assertAdminUser(wxContext.OPENID)
    const filters = {
      venueId: event.venueId || '',
      date: event.date || '',
      status: event.status || ''
    }
    const venues = await listAvailableVenues()
    const venueMap = {}
    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i]
      if (venue && venue.venueId) venueMap[venue.venueId] = venue
    }
    const list = (await listBookingsByFilter(filters)).filter(item => item && item.venueId && venueMap[item.venueId])
      .map(item => Object.assign({}, item, {
        venueName: venueMap[item.venueId].name || item.venueName,
        venueSnapshot: item.venueSnapshot || buildVenueSnapshot(venueMap[item.venueId])
      }))
    const order = event.order === 'desc' ? 'desc' : 'asc'
    const limit = Math.max(0, Math.min(Number(event.limit || 0) || 0, 500))
    const sorted = sortBookings(list, order)
    const limited = limit > 0 ? sorted.slice(0, limit) : sorted
    const data = await enrichAdminBookings(limited)
    return success(data)
  } catch (err) {
    console.error('getAdminBookings error', err)
    return fail(err.code || 500, err.message || '查询管理员预约列表失败')
  }
}
