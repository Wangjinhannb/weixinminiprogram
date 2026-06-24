const svc = require('_shared/bookingService')
const { cloud, db, assertAdminUser, buildVenuePayload, getVenueByVenueId, sanitizeVenueId, translateCollectionError, success, fail } = svc

async function getVenueByDocId(docId) {
  if (!docId) return null
  try {
    const res = await db.collection('venues').doc(docId).get()
    return res.data || null
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('does not exist') > -1 || msg.indexOf('not exists') > -1) return null
    throw err
  }
}

function prepareVenueEventForSave(event, existing, targetVenueId) {
  const next = Object.assign({}, event || {}, { venueId: targetVenueId })
  // 仅用于保存阶段判断“没有传图片字段”时是否保留旧图片，不会写入数据库。
  next.existingVenueForImages = existing || null
  return next
}

async function generateUniqueVenueId(seed) {
  let base = sanitizeVenueId(seed || `venue_${Date.now().toString(36)}`)
  if (base.indexOf('venue_') !== 0) base = `venue_${base}`
  for (let i = 0; i < 10; i++) {
    const suffix = i === 0 ? '' : `_${Math.random().toString(36).slice(2, 6)}`
    const candidate = `${base}${suffix}`
    const exists = await getVenueByVenueId(candidate, { includeDeleted: true })
    if (!exists) return candidate
  }
  return `venue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    await assertAdminUser(userId)

    const docId = event._id || ''
    let existing = null
    if (docId) existing = await getVenueByDocId(docId)
    if (!existing && event.venueId) existing = await getVenueByVenueId(event.venueId, { includeDeleted: true })

    if (docId && !existing) return fail(404, '场室不存在')

    let targetVenueId = ''
    if (existing) {
      targetVenueId = existing.venueId
    } else if (event.venueId) {
      targetVenueId = sanitizeVenueId(event.venueId)
      const duplicate = await getVenueByVenueId(targetVenueId, { includeDeleted: true })
      if (duplicate) return fail(400, 'venueId 已存在，请修改后重试')
    } else {
      targetVenueId = await generateUniqueVenueId(`venue_${Date.now().toString(36)}`)
    }

    const payload = buildVenuePayload(prepareVenueEventForSave(event, existing, targetVenueId), userId)
    if (existing) payload.deleted = !!existing.deleted

    if (existing) {
      await db.collection('venues').doc(existing._id).update({ data: payload })
      return success(Object.assign({ _id: existing._id }, payload), '保存成功')
    }

    const addRes = await db.collection('venues').add({ data: Object.assign({}, payload, { createdAt: db.serverDate() }) })
    return success(Object.assign({ _id: addRes._id }, payload), '新增成功')
  } catch (err) {
    console.error('saveVenue error', err)
    err = translateCollectionError(err, 'venues')
    return fail(err.code || 500, err.message || '保存场室失败')
  }
}
