const svc = require('_shared/bookingService')
const { cloud, db, assertAdminUser, getVenueByVenueId, translateCollectionError, success, fail } = svc

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    await assertAdminUser(userId)
    const venueId = event.venueId
    if (!venueId) return fail(400, '缺少 venueId')
    const venue = await getVenueByVenueId(venueId, { includeDeleted: true })
    if (!venue) return fail(404, '场室不存在')
    if (venue.deleted) return success(venue, '场室已删除')
    await db.collection('venues').doc(venue._id).update({ data: { deleted: true, visible: false, enabled: false, updatedAt: db.serverDate(), updatedBy: userId } })
    return success(Object.assign({}, venue, { deleted: true, visible: false, enabled: false }), '已删除场室')
  } catch (err) {
    console.error('deleteVenue error', err)
    err = translateCollectionError(err, 'venues')
    return fail(err.code || 500, err.message || '删除场室失败')
  }
}
