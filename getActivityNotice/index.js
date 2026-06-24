const svc = require('_shared/bookingService')
const { cloud, db, success, fail, isCollectionNotExistsError, translateCollectionError } = svc

const COLLECTION = 'activity_notices'

function trim(value) {
  return String(value == null ? '' : value).trim()
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

function sanitizeNotice(doc) {
  doc = doc || {}
  const id = trim(doc._id || doc.id || doc.noticeId || doc.activityId)
  const title = trim(doc.title)
  const content = trim(doc.content || doc.text || doc.description)
  const imageUrl = trim(doc.imageUrl || doc.image || doc.cover || doc.coverUrl)
  let images = normalizeImages((doc.images && doc.images.length) ? doc.images : (doc.imageUrls || doc.photos || doc.pictures || []))
  if (!images.length && imageUrl) images = [imageUrl]
  const linkUrl = trim(doc.linkUrl || doc.url || doc.link)
  const linkText = trim(doc.linkText || doc.buttonText) || '立即报名'
  const deleted = doc.deleted === true
  const enabled = doc.enabled !== false
  const hasContent = !!(title || content || imageUrl || images.length || linkUrl)
  return {
    id,
    _id: id,
    enabled,
    deleted,
    title,
    content,
    imageUrl: imageUrl || images[0] || '',
    images,
    linkUrl,
    linkText,
    hasActivity: !!(!deleted && enabled && hasContent),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null
  }
}

function toTime(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (value.$date) return new Date(value.$date).getTime() || 0
  return 0
}

exports.main = async () => {
  try {
    const res = await db.collection(COLLECTION).limit(100).get()
    const list = (res.data || [])
      .map(sanitizeNotice)
      .filter(item => item.hasActivity)
      .sort((a, b) => toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt))
    const resolvedList = await Promise.all(list.map(item => attachDisplayImageUrls(item)))
    return success({ list: resolvedList })
  } catch (err) {
    if (isCollectionNotExistsError(err, COLLECTION)) return success({ list: [] })
    console.error('getActivityNotice error', err)
    err = translateCollectionError(err, COLLECTION)
    return fail(err.code || 500, err.message || '读取活动预告失败')
  }
}
