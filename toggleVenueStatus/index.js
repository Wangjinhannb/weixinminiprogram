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
    const enabled = typeof event.enabled === 'boolean' ? event.enabled : !venue.enabled
    await db.collection('venues').doc(venue._id).update({ data: { enabled, visible: true, updatedAt: db.serverDate(), updatedBy: userId } })
    return success(Object.assign({}, venue, { enabled, visible: true }), enabled ? '已启用' : '已停用')
  } catch (err) {
    console.error('toggleVenueStatus error', err)
    err = translateCollectionError(err, 'venues')
    return fail(err.code || 500, err.message || '切换场室状态失败')
  }
}
