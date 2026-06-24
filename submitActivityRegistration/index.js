const svc = require('_shared/bookingService')
const { cloud, db, fetchAll, success, fail, isCollectionNotExistsError, translateCollectionError } = svc

const ACTIVITY_COLLECTION = 'activity_notices'
const REG_COLLECTION = 'activity_registrations'
const MAX_PHONE_LENGTH = 20
const MAX_NAME_LENGTH = 30

function trim(value) {
  return String(value == null ? '' : value).trim()
}

function limitText(value, max, fieldName) {
  value = trim(value)
  if (value.length > max) {
    const err = new Error(`${fieldName}不能超过 ${max} 个字符`)
    err.code = 400
    throw err
  }
  return value
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
  if (text === 'false' || text === '0' || text === 'no' || text === 'n' || text === '否' || text === '无' || text === '不带' || text === '不带小孩') return false
  return null
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

function sanitizeActivity(doc) {
  doc = doc || {}
  const id = trim(doc._id || doc.id || doc.noticeId || doc.activityId)
  const title = trim(doc.title) || '未命名活动'
  const content = trim(doc.content || doc.text || doc.description)
  const imageUrl = trim(doc.imageUrl || doc.image || doc.cover || doc.coverUrl)
  const linkUrl = trim(doc.linkUrl || doc.url || doc.link)
  const linkText = trim(doc.linkText || doc.buttonText) || '立即报名'
  const deleted = doc.deleted === true
  const enabled = doc.enabled !== false
  const hasContent = !!(title || content || imageUrl || linkUrl)
  return {
    id,
    _id: id,
    enabled,
    deleted,
    title,
    content,
    imageUrl,
    linkUrl,
    linkText,
    hasActivity: !!(!deleted && enabled && hasContent)
  }
}

function sanitizeUserProfile(profile) {
  profile = profile || {}
  return {
    nickName: limitText(profile.nickName || profile.displayName || '', 40, '昵称') || '微信用户',
    phone: limitText(profile.phone || '', MAX_PHONE_LENGTH, '用户手机号'),
    phoneMask: limitText(profile.phoneMask || '', MAX_PHONE_LENGTH, '手机号掩码'),
    loginType: limitText(profile.loginType || '', 20, '登录方式')
  }
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
    participantName: trim(doc.participantName || doc.name || doc.contactName),
    phone: trim(doc.phone),
    peopleCount: normalizePeople(doc.peopleCount || doc.people),
    hasChild: normalizeHasChild(firstDefined(doc, ['hasChild', 'withChild', 'bringChild'])) === true,
    hasChildText: normalizeHasChild(firstDefined(doc, ['hasChild', 'withChild', 'bringChild'])) === true ? '带小孩' : '不带小孩',
    status: doc.status || 'submitted',
    userProfile: doc.userProfile || {},
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null
  }
}

async function ensureRegistrationCollection() {
  if (!db.createCollection) return
  try {
    await db.createCollection(REG_COLLECTION)
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('already exists') > -1 || msg.indexOf('collection already exists') > -1 || msg.indexOf('DATABASE_COLLECTION_ALREADY_EXIST') > -1) return
  }
}

async function getActivity(activityId) {
  try {
    const res = await db.collection(ACTIVITY_COLLECTION).doc(activityId).get()
    return sanitizeActivity(res.data || null)
  } catch (err) {
    err = translateCollectionError(err, ACTIVITY_COLLECTION)
    throw err
  }
}

function buildPayload(event, userId, activity) {
  event = event || {}
  const participantName = limitText(firstDefined(event, ['participantName', 'name', 'contactName']), MAX_NAME_LENGTH, '姓名')
  if (!participantName) {
    const err = new Error('请填写姓名')
    err.code = 400
    throw err
  }
  const phone = limitText(event.phone, MAX_PHONE_LENGTH, '手机号')
  if (!/^1\d{10}$/.test(phone)) {
    const err = new Error('请填写正确的11位手机号')
    err.code = 400
    throw err
  }
  const peopleCount = normalizePeople(event.peopleCount || event.people)
  if (!peopleCount) {
    const err = new Error('报名人数必须大于 0')
    err.code = 400
    throw err
  }
  const hasChild = normalizeHasChild(firstDefined(event, ['hasChild', 'withChild', 'bringChild']))
  if (hasChild === null) {
    const err = new Error('请选择是否带小孩')
    err.code = 400
    throw err
  }
  return {
    userId,
    activityId: activity.id,
    activityTitle: activity.title,
    activitySnapshot: {
      id: activity.id,
      title: activity.title,
      content: activity.content,
      imageUrl: activity.imageUrl,
      linkUrl: activity.linkUrl,
      linkText: activity.linkText
    },
    participantName,
    phone,
    peopleCount,
    hasChild,
    hasChildText: hasChild ? '带小孩' : '不带小孩',
    status: 'submitted',
    userProfile: sanitizeUserProfile(event.userProfile || {}),
    updatedAt: db.serverDate()
  }
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
    const activityId = trim(event && (event.activityId || event.id || event._id))
    if (!activityId) {
      const err = new Error('缺少活动ID')
      err.code = 400
      throw err
    }
    const activity = await getActivity(activityId)
    if (!activity || !activity.id || !activity.hasActivity) {
      const err = new Error('活动不存在或已下线')
      err.code = 404
      throw err
    }
    await ensureRegistrationCollection()
    const payload = buildPayload(event, userId, activity)
    let existing = null
    let duplicateRows = []
    try {
      const rows = sortLatestFirst(await fetchAll(db.collection(REG_COLLECTION).where({ userId, activityId }), 50))
      existing = (rows || [])[0] || null
      duplicateRows = (rows || []).slice(1)
    } catch (err) {
      if (!isCollectionNotExistsError(err, REG_COLLECTION)) throw err
    }
    let id = existing && existing._id
    if (id) {
      await db.collection(REG_COLLECTION).doc(id).update({ data: payload })
    } else {
      const addRes = await db.collection(REG_COLLECTION).add({ data: Object.assign({}, payload, { createdAt: db.serverDate() }) })
      id = addRes._id
    }
    // 同一用户同一活动历史上可能产生过多条报名记录。重新报名时只保留最新一条为有效，避免管理员端看到重复或已取消后仍残留的记录。
    await Promise.all((duplicateRows || []).filter(item => item && item._id && item._id !== id).map(item => {
      return db.collection(REG_COLLECTION).doc(item._id).update({
        data: {
          status: 'cancelled',
          cancelledAt: db.serverDate(),
          updatedAt: db.serverDate(),
          cancelReason: 'duplicate_replaced'
        }
      }).catch(() => null)
    }))
    return success(sanitizeRegistration(Object.assign({}, existing || {}, payload, { _id: id })), existing ? '报名信息已更新' : '报名成功')
  } catch (err) {
    console.error('submitActivityRegistration error', err)
    if (isCollectionNotExistsError(err, REG_COLLECTION)) err = translateCollectionError(err, REG_COLLECTION)
    return fail(err.code || 500, err.message || '提交活动报名失败')
  }
}
