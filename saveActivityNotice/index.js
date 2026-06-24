const svc = require('_shared/bookingService')
const { cloud, db, assertAdminUser, success, fail, translateCollectionError } = svc

const COLLECTION = 'activity_notices'
const MAX_TITLE_LENGTH = 80
const MAX_CONTENT_LENGTH = 1200
const MAX_URL_LENGTH = 500

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

function normalizeImages(list) {
  if (typeof list === 'string') {
    const text = trim(list)
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      list = Array.isArray(parsed) ? parsed : [text]
    } catch (err) {
      list = text.split(/[\n,，;]/)
    }
  }
  if (!Array.isArray(list)) return []
  const out = []
  list.forEach(item => {
    if (item && typeof item === 'object') item = item.fileID || item.fileId || item.url || item.src || item.path || item.tempFileURL || ''
    item = trim(item)
    if (item && out.indexOf(item) < 0) out.push(item)
  })
  return out
}

function isCloudFileID(url) {
  return trim(url).indexOf('cloud://') === 0
}

function isDisplayableImageUrl(url) {
  url = trim(url)
  return !!url && !isCloudFileID(url)
}

function pickImages(payload, existing) {
  payload = payload || {}
  existing = existing || {}
  const incoming = normalizeImages(payload.images || payload.imageUrls || payload.photos || payload.pictures || [])
  if (payload.imageUrl && incoming.indexOf(payload.imageUrl) < 0) incoming.unshift(payload.imageUrl)
  const existingImages = normalizeImages((existing.images && existing.images.length) ? existing.images : (existing.imageUrls || existing.photos || existing.pictures || []))
  if (!existingImages.length && existing.imageUrl) existingImages.push(existing.imageUrl)
  if (payload.imagesChanged === true || payload.imagesDirty === true) return incoming
  if (incoming.length) return incoming
  return existingImages
}

async function attachDisplayImageUrls(notice) {
  notice = notice || {}
  const rawImages = normalizeImages((notice.images && notice.images.length) ? notice.images : (notice.imageUrl ? [notice.imageUrl] : []))
  const imageUrls = []
  const cloudFiles = []
  rawImages.forEach(item => {
    if (isCloudFileID(item)) cloudFiles.push(item)
    else if (isDisplayableImageUrl(item)) imageUrls.push(item)
  })
  if (cloudFiles.length && cloud && cloud.getTempFileURL) {
    try {
      const res = await cloud.getTempFileURL({ fileList: cloudFiles })
      const list = (res && res.fileList) || []
      list.forEach(item => {
        item = item || {}
        const url = item.tempFileURL || item.download_url || item.url || ''
        if (isDisplayableImageUrl(url)) imageUrls.push(url)
      })
    } catch (e) {
      console.error('resolve activity image temp url failed', e)
    }
  }
  notice.images = rawImages
  notice.imageUrl = notice.imageUrl || rawImages[0] || ''
  notice.imageUrls = imageUrls
  notice.displayImageUrl = imageUrls[0] || ''
  return notice
}

function sanitizePayload(event, existing) {
  event = event || {}
  const id = trim(event.id || event._id || event.noticeId || event.activityId)
  const title = limitText(event.title, MAX_TITLE_LENGTH, '活动标题')
  const content = limitText(event.content || event.text || event.description, MAX_CONTENT_LENGTH, '活动内容')
  const imageUrl = limitText(event.imageUrl || event.image || event.cover || event.coverUrl, MAX_URL_LENGTH, '图片链接')
  const linkUrl = limitText(event.linkUrl || event.url || event.link, MAX_URL_LENGTH, '详情链接')
  const linkText = '立即报名'
  const imagesChanged = event.imagesChanged === true || event.imagesDirty === true
  const images = pickImages({ images: event.images, imageUrls: event.imageUrls, imageUrl, imagesChanged }, existing)
  const finalImageUrl = imageUrl || images[0] || ''
  const hasContent = !!(title || content || finalImageUrl || linkUrl)
  if (!hasContent) {
    const err = new Error('请至少填写活动标题、内容、图片或链接中的一项')
    err.code = 400
    throw err
  }
  return {
    id,
    enabled: true,
    deleted: false,
    title,
    content,
    imageUrl: finalImageUrl,
    images,
    linkUrl,
    linkText
  }
}

function buildResult(id, data) {
  const hasContent = !!(data.title || data.content || data.imageUrl || data.linkUrl)
  return Object.assign({}, data, {
    id,
    _id: id,
    hasActivity: !!(!data.deleted && data.enabled !== false && hasContent)
  })
}

async function getExisting(id) {
  if (!id) return null
  try {
    const res = await db.collection(COLLECTION).doc(id).get()
    return res.data || null
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('does not exist') > -1 || msg.indexOf('not exists') > -1) return null
    throw err
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  try {
    await assertAdminUser(userId)
    const rawId = trim(event && (event.id || event._id || event.noticeId || event.activityId))
    const existing = rawId ? await getExisting(rawId) : null
    const payload = sanitizePayload(event, existing)
    const now = db.serverDate()
    const data = {
      enabled: true,
      deleted: false,
      title: payload.title,
      content: payload.content,
      imageUrl: payload.imageUrl,
      images: payload.images,
      linkUrl: payload.linkUrl,
      linkText: payload.linkText,
      updatedAt: now,
      updatedBy: userId || ''
    }
    let id = payload.id
    if (id) {
      await db.collection(COLLECTION).doc(id).update({ data })
    } else {
      const addRes = await db.collection(COLLECTION).add({
        data: Object.assign({}, data, {
          createdAt: now,
          createdBy: userId || ''
        })
      })
      id = addRes._id
    }
    const result = await attachDisplayImageUrls(buildResult(id, data))
    return success(result, '保存成功')
  } catch (err) {
    console.error('saveActivityNotice error', err)
    err = translateCollectionError(err, COLLECTION)
    return fail(err.code || 500, err.message || '保存活动失败')
  }
}
