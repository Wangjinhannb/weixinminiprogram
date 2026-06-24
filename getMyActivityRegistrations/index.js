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

function firstDefined(obj, keys) {
  obj = obj || {}
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function normalizeHasChild(value) {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  const text = trim(value).toLowerCase()
  if (text === 'true' || text === '1' || text === 'yes' || text === 'y' || text === '是' || text === '有' || text === '带' || text === '带小孩') return true
  return false
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

function getItemTime(item) {
  return toTime(item && (item.updatedAt || item.cancelledAt || item.createdAt))
}

function sanitizeRegistration(doc) {
  doc = doc || {}
  const id = trim(doc._id || doc.id)
  return {
    id,
    _id: id,
    userId: trim(doc.userId),
    activityId: trim(doc.activityId),
    activityTitle: trim(doc.activityTitle || (doc.activitySnapshot && doc.activitySnapshot.title)) || '未命名活动',
    activitySnapshot: doc.activitySnapshot || null,
    participantName: trim(doc.participantName || doc.name || doc.contactName),
    phone: trim(doc.phone),
    peopleCount: normalizePeople(doc.peopleCount || doc.people),
    hasChild: normalizeHasChild(firstDefined(doc, ['hasChild', 'withChild', 'bringChild'])),
    hasChildText: normalizeHasChild(firstDefined(doc, ['hasChild', 'withChild', 'bringChild'])) ? '带小孩' : '不带小孩',
    status: normalizeStatus(doc.status || 'submitted'),
    userProfile: doc.userProfile || {},
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    cancelledAt: doc.cancelledAt || null
  }
}

function pickLatestPerActivity(rows) {
  const sorted = (rows || []).map(sanitizeRegistration).sort((a, b) => getItemTime(b) - getItemTime(a))
  const seen = {}
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]
    const key = item.activityId || item.id
    if (seen[key]) continue
    seen[key] = true
    out.push(item)
  }
  return out
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
    event = event || {}
    const activityId = trim(event.activityId || event.id || event._id)
    const includeCancelled = event.includeCancelled === true
    const where = { userId }
    if (activityId) where.activityId = activityId
    const rows = await fetchAll(db.collection(COLLECTION).where(where), 100)
    let list = pickLatestPerActivity(rows)
    if (!includeCancelled) list = list.filter(item => !isCancelledStatus(item.status))
    list.sort((a, b) => getItemTime(b) - getItemTime(a))
    return success(list)
  } catch (err) {
    if (isCollectionNotExistsError(err, COLLECTION)) return success([])
    console.error('getMyActivityRegistrations error', err)
    err = translateCollectionError(err, COLLECTION)
    return fail(err.code || 500, err.message || '查询我的活动报名失败')
  }
}
