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
    const visible = typeof event.visible === 'boolean' ? event.visible : !venue.visible
    await db.collection('venues').doc(venue._id).update({ data: { visible, updatedAt: db.serverDate(), updatedBy: userId } })
    return success(Object.assign({}, venue, { visible }), '已更新')
  } catch (err) {
    console.error('toggleVenueVisible error', err)
    err = translateCollectionError(err, 'venues')
    return fail(err.code || 500, err.message || '切换场室展示状态失败')
  }
}
