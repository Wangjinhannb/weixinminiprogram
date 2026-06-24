const svc = require('_shared/bookingService')
const { cloud, db, fetchAll, success, fail, isCollectionNotExistsError, translateCollectionError } = svc

const COLLECTION = 'activity_registrations'

function trim(value) {
  return String(value == null ? '' : value).trim()
}

function normalizePeople(value) {
  const num = Number(value)
  if (!isFinite(num) || num <= 0) return 0
  return Math.floor(num)
}

function normalizeStatus(value) {
  return trim(value || 'submitted').toLowerCase()
}

function isCancelledStatus(status) {
  status = normalizeStatus(status)
  return status === 'cancelled' || status === 'canceled' || status === 'cancel' || status === 'rejected'
}

function toTime(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (value.$date) return new Date(value.$date).getTime() || 0
  return 0
}

function sortLatestFirst(list) {
  return (list || []).sort((a, b) => {
    const at = toTime(a && (a.updatedAt || a.cancelledAt || a.createdAt))
    const bt = toTime(b && (b.updatedAt || b.cancelledAt || b.createdAt))
    return bt - at
  })
}

function sanitizeRegistration(doc) {
  doc = doc || {}
  return {
    id: trim(doc._id || doc.id),
    _id: trim(doc._id || doc.id),
    userId: trim(doc.userId),
    activityId: trim(doc.activityId),
    activityTitle: trim(doc.activityTitle || (doc.activitySnapshot && doc.activitySnapshot.title)) || '未命名活动',
    activitySnapshot: doc.activitySnapshot || null,
    phone: trim(doc.phone),
    peopleCount: normalizePeople(doc.peopleCount || doc.people),
    status: normalizeStatus(doc.status || 'cancelled'),
    userProfile: doc.userProfile || {},
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    cancelledAt: doc.cancelledAt || null
  }
}

async function getRegistrationById(id) {
  const res = await db.collection(COLLECTION).doc(id).get()
  const doc = res.data || null
  if (doc && !doc._id) doc._id = id
  return doc
}

async function findOwnedRows(userId, event) {
  event = event || {}
  const registrationId = trim(event.registrationId || event.id || event._id)
  const activityId = trim(event.activityId)

  if (registrationId) {
    const doc = await getRegistrationById(registrationId)
    if (!doc || trim(doc.userId) !== userId) return []
    const docActivityId = trim(doc.activityId) || activityId
    if (!docActivityId) return [doc]
    // 取消时按「用户 + 活动」批量取消，避免历史重复报名记录在管理员端残留。
    const rows = await fetchAll(db.collection(COLLECTION).where({ userId, activityId: docActivityId }), 50)
    return rows && rows.length ? rows : [doc]
  }

  if (!activityId) return []
  return fetchAll(db.collection(COLLECTION).where({ userId, activityId }), 50)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    if (!userId) {
      const err = new Error('用户身份失效，请重新登录后再试')
      err.code = 401
      throw err
    }
    const rows = sortLatestFirst(await findOwnedRows(userId, event || {}))
    if (!rows || !rows.length) {
      const err = new Error('未找到可取消的报名信息')
      err.code = 404
      throw err
    }

    const ownedRows = rows.filter(item => item && trim(item.userId) === userId && item._id)
    const activeRows = ownedRows.filter(item => !isCancelledStatus(item.status))
    if (!ownedRows.length) {
      const err = new Error('不能取消他人的报名')
      err.code = 403
      throw err
    }

    if (!activeRows.length) {
      return success(sanitizeRegistration(Object.assign({}, ownedRows[0], { status: 'cancelled' })), '报名已取消')
    }

    const patch = {
      status: 'cancelled',
      cancelledAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    await Promise.all(activeRows.map(item => {
      return db.collection(COLLECTION).doc(item._id).update({ data: patch })
    }))

    return success(Object.assign(sanitizeRegistration(Object.assign({}, activeRows[0], patch)), { cancelledCount: activeRows.length }), '已取消报名')
  } catch (err) {
    if (isCollectionNotExistsError(err, COLLECTION)) {
      return fail(404, '未找到可取消的报名信息')
    }
    console.error('cancelActivityRegistration error', err)
    err = translateCollectionError(err, COLLECTION)
    return fail(err.code || 500, err.message || '取消活动报名失败')
  }
}
