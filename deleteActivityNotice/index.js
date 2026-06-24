const svc = require('_shared/bookingService')
const { cloud, db, assertAdminUser, success, fail, translateCollectionError } = svc

const COLLECTION = 'activity_notices'

function trim(value) {
  return String(value == null ? '' : value).trim()
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    await assertAdminUser(userId)
    const id = trim(event && (event.id || event._id || event.noticeId || event.activityId))
    if (!id) {
      const err = new Error('缺少活动ID')
      err.code = 400
      throw err
    }
    await db.collection(COLLECTION).doc(id).update({
      data: {
        enabled: false,
        deleted: true,
        deletedAt: db.serverDate(),
        deletedBy: userId || '',
        updatedAt: db.serverDate(),
        updatedBy: userId || ''
      }
    })
    return success({ id, deleted: true }, '删除成功')
  } catch (err) {
    console.error('deleteActivityNotice error', err)
    err = translateCollectionError(err, COLLECTION)
    return fail(err.code || 500, err.message || '删除活动失败')
  }
}
