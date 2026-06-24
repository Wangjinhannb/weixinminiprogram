const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const timeUtil = require('./time')
const {
  pad2,
  isValidTimeString,
  isValidDateString,
  timeToSeconds,
  timeToMinutes,
  buildTimeLabel,
  buildDateTimeText,
  buildDateTimeRangeLabel,
  normalizeMaxPeopleLimit,
  normalizeTimeSlot,
  normalizeTimeSlots,
  normalizeRange,
  mergeRanges,
  mergeTimeSlotsToRanges,
  isTimeRangeConflict,
  isRangeWithinRanges,
  findContainingRange,
  validateBookingDate,
  validateBookingTimeRange,
  validateTimeSlotsDetailed,
  validateVenueTimeConfigDetailed,
  getVenueDefaultTimeSlots,
  getVenueDateOverrides,
  getEffectiveTimeSlots,
  getEffectiveOpenRanges
} = timeUtil

const OCCUPY_STATUS = ['active', 'pending', 'approved', 'rescheduled']
const CANCEL_STATUS = ['cancelled', 'rejected']

const LEGACY_VENUES = [
  {
    venueId: 'v_multi_func',
    name: '多功能活动室',
    description: '适合小型会议、培训与讲座活动',
    location: '一楼101',
    capacity: 160,
    sort: 10,
    features: ['WiFi', '麦克风', '两个屏幕', '四台音响'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请提前10分钟到场'
  },
  {
    venueId: 'v_e_reading',
    name: '电子阅览室',
    description: '适合电子阅读、电脑操作与小型培训',
    location: '二楼201',
    capacity: 11,
    sort: 20,
    features: ['11台电脑'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请保持设备整洁'
  },
  {
    venueId: 'v_reading',
    name: '综合阅览室',
    description: '适合阅读、自习与安静交流',
    location: '二楼202',
    capacity: 30,
    sort: 30,
    features: ['书籍', '书桌', '椅子', '沙发'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请保持安静'
  },
  {
    venueId: 'v_dance',
    name: '综合活动室',
    description: '适合舞蹈、活动、排练',
    location: '三楼301',
    capacity: 30,
    sort: 40,
    features: ['木地板', '镜面墙', '活动空间'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请自备运动用品'
  },
  {
    venueId: 'v_kids',
    name: '儿童阅览室',
    description: '适合儿童阅读及亲子活动',
    location: '二楼203',
    capacity: 10,
    sort: 50,
    features: ['儿童书籍', '两张桌子', '八张椅子'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请家长陪同'
  },
  {
    venueId: 'v_scitech',
    name: '科教文卫室',
    description: '适合宣教活动、学习交流、多功能使用',
    location: '三楼302',
    capacity: 30,
    sort: 60,
    features: ['宣教活动', '学习交流', '多功能使用'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请按用途申请'
  },
  {
    venueId: 'v_qinqi_art',
    name: '琴祺书画室',
    description: '适合书画创作及艺术交流',
    location: '三楼303',
    capacity: 20,
    sort: 70,
    features: ['书画创作', '艺术交流', '安静环境'],
    timeSlots: [
      { start: '09:00', end: '10:00', label: '09:00-10:00' },
      { start: '10:00', end: '11:00', label: '10:00-11:00' },
      { start: '11:00', end: '12:00', label: '11:00-12:00' },
      { start: '14:00', end: '15:00', label: '14:00-15:00' },
      { start: '15:00', end: '16:00', label: '15:00-16:00' },
      { start: '16:00', end: '17:00', label: '16:00-17:00' }
    ],
    bookingNotice: '请保持场室整洁'
  }
]
const VENUES = LEGACY_VENUES.map(item => ({ id: item.venueId, name: item.name }))

const SUPER_ADMIN_OPENID = 'o48kz3XKXQeNCMZqqOK0KN6-HC7Y'

function success(data, message) {
  return { code: 200, data: data == null ? null : data, message: message || 'ok' }
}
function fail(code, message) {
  return { code: code || 500, message: message || '服务器异常' }
}
function toMin(t) {
  return timeToMinutes(t)
}
function isOverlap(startA, endA, startB, endB) {
  return isTimeRangeConflict(startA, endA, startB, endB)
}
function sanitizeVenueId(value) {
  value = String(value || '').trim().toLowerCase()
  value = value.replace(/[^a-z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return value || `venue_${Date.now()}`
}

function getPeopleCountFromForm(form) {
  const value = Number(form && form.people)
  if (!isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}
function getBookingPeopleCount(doc) {
  return getPeopleCountFromForm(doc && doc.form)
}
function getVenueLevelMaxPeopleLimit(doc) {
  return normalizeMaxPeopleLimit(doc && (doc.maxPeopleLimit || (doc.bookingTimeConfig && doc.bookingTimeConfig.maxPeopleLimit)))
}
function formatSlotDateTime(slot, date) {
  slot = slot || {}
  const next = Object.assign({}, slot)
  if (date) {
    next.startDateTime = buildDateTimeText(date, next.start)
    next.endDateTime = buildDateTimeText(date, next.end)
    next.dateTimeLabel = buildDateTimeRangeLabel(date, next.start, next.end)
  }
  return next
}
function resolveSlotLimit(venue, slot) {
  const slotLimit = normalizeMaxPeopleLimit(slot && slot.maxPeopleLimit)
  if (slotLimit > 0) return slotLimit
  return getVenueLevelMaxPeopleLimit(venue)
}
function getApplicableMaxPeopleLimit(venue, date, startTime, endTime) {
  if (!venue) return 0
  const startSec = timeToSeconds(startTime)
  const endSec = timeToSeconds(endTime)
  if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) return 0
  const slots = getEffectiveTimeSlots(venue, date, { keepSeconds: true })
  const matchedLimits = []
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i] || {}
    if (startSec < slot.endSec && endSec > slot.startSec) {
      const slotLimit = normalizeMaxPeopleLimit(slot.maxPeopleLimit)
      if (slotLimit > 0) matchedLimits.push(slotLimit)
    }
  }
  if (matchedLimits.length) return Math.min.apply(null, matchedLimits)
  return getVenueLevelMaxPeopleLimit(venue)
}
function assertBookingStartTimeNotPast(date, startTime) {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  if (String(date || '') !== todayStr) return true
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  if (timeToSeconds(startTime) <= nowSec) {
    const err = new Error('今天的预约开始时间不能早于当前时间')
    err.code = 400
    throw err
  }
  return true
}
function assertBookingPeopleWithinLimit(venue, payload) {
  const peopleCount = getPeopleCountFromForm(payload && payload.form)
  if (!(peopleCount > 0)) {
    const err = new Error('报名人数必须大于 0')
    err.code = 400
    throw err
  }
  const maxPeopleLimit = getApplicableMaxPeopleLimit(venue, payload.date, payload.startTime, payload.endTime)
  if (maxPeopleLimit > 0 && peopleCount > maxPeopleLimit) {
    const err = new Error(`当前时段最多可报名 ${maxPeopleLimit} 人`)
    err.code = 400
    throw err
  }
  return { peopleCount, maxPeopleLimit }
}
function normalizeImages(list) {
  if (typeof list === 'string') {
    const text = String(list || '').trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) list = parsed
      else list = [text]
    } catch (err) {
      list = text.split(/[\n,，;]/)
    }
  }
  if (!Array.isArray(list)) return []
  return list.map(item => {
    if (item && typeof item === 'object') item = item.fileID || item.fileId || item.url || item.src || item.path || item.tempFileURL || ''
    return String(item || '').trim()
  }).filter(item => !!item)
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key)
}

function chooseVenueImagesForSave(payload, existing) {
  payload = payload || {}
  existing = existing || {}
  const incoming = normalizeImages(
    hasOwn(payload, 'images') ? payload.images : (payload.imageUrls || payload.photos || payload.pictures || [])
  )
  const existingImages = normalizeImages(
    (existing.images && existing.images.length) ? existing.images : (existing.imageUrls || existing.photos || existing.pictures || [])
  )
  const imageListTouched = payload.imagesChanged === true || payload.imagesDirty === true
  if (imageListTouched) return incoming
  if (incoming.length) return incoming
  if (existingImages.length) return existingImages
  return []
}

function isCloudFileID(url) {
  return String(url || '').indexOf('cloud://') === 0
}

function isDisplayableImageUrl(url) {
  url = String(url || '').trim()
  if (!url || isCloudFileID(url)) return false
  return true
}

function normalizeDisplayImageUrls(list) {
  return normalizeImages(list).filter(isDisplayableImageUrl)
}

async function attachVenueImageUrls(venues) {
  venues = Array.isArray(venues) ? venues : []
  const cloudFiles = []
  const fileSet = {}
  venues.forEach(venue => {
    normalizeImages(venue && venue.images).forEach(fileID => {
      if (isCloudFileID(fileID) && !fileSet[fileID]) {
        fileSet[fileID] = true
        cloudFiles.push(fileID)
      }
    })
  })
  const tempMap = {}
  if (cloudFiles.length) {
    for (let i = 0; i < cloudFiles.length; i += 50) {
      const batch = cloudFiles.slice(i, i + 50)
      try {
        const res = await cloud.getTempFileURL({ fileList: batch })
        const list = (res && res.fileList) || []
        list.forEach(item => {
          item = item || {}
          const fileID = item.fileID || item.fileId || ''
          const tempURL = item.tempFileURL || item.download_url || item.url || ''
          if (fileID && tempURL) tempMap[fileID] = tempURL
        })
      } catch (err) {
        console.error('getTempFileURL for venue images failed', err)
      }
    }
  }
  return venues.map(venue => {
    const next = Object.assign({}, venue)
    const images = normalizeImages(next.images)
    const imageUrls = []
    images.forEach(item => {
      if (isCloudFileID(item)) {
        if (tempMap[item]) imageUrls.push(tempMap[item])
      } else if (isDisplayableImageUrl(item)) {
        imageUrls.push(item)
      }
    })
    next.images = images
    next.imageUrls = imageUrls
    return next
  })
}

function normalizeVenue(doc) {
  if (!doc) return null
  const timeSlots = (getVenueDefaultTimeSlots(doc, { keepSeconds: true }) || []).map(item => formatSlotDateTime(item, ''))
  const rawDateOverrides = getVenueDateOverrides(doc, { keepSeconds: true })
  const dateOverrides = (rawDateOverrides || []).map(item => ({
    date: item.date,
    timeSlots: (item.timeSlots || []).map(slot => formatSlotDateTime(slot, item.date))
  }))
  const openRanges = mergeTimeSlotsToRanges(timeSlots)
  const maxPeopleLimit = getVenueLevelMaxPeopleLimit(doc)
  return {
    _id: doc._id,
    id: doc.venueId,
    venueId: doc.venueId,
    name: doc.name || '',
    description: doc.description || '',
    location: doc.location || '',
    capacity: Number(doc.capacity || 0),
    maxPeopleLimit,
    visible: doc.visible !== false,
    enabled: doc.enabled !== false,
    deleted: !!doc.deleted,
    sort: Number(doc.sort || 0),
    timeSlots,
    dateOverrides,
    bookingTimeConfig: {
      defaultSlots: timeSlots,
      dateOverrides,
      maxPeopleLimit
    },
    openRanges,
    bookingNotice: doc.bookingNotice || '',
    images: normalizeImages((doc.images && doc.images.length) ? doc.images : (doc.imageUrls || doc.photos || doc.pictures || [])),
    features: Array.isArray(doc.features) ? doc.features : [],
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || ''
  }
}

function getVenueName(venueId) {
  const item = VENUES.find(v => v.id === venueId)
  return item ? item.name : ''
}
function buildVenueSnapshot(venue) {
  venue = normalizeVenue(venue)
  if (!venue) return null
  return {
    venueId: venue.venueId,
    name: venue.name,
    location: venue.location,
    description: venue.description,
    capacity: venue.capacity,
    maxPeopleLimit: venue.maxPeopleLimit,
    bookingNotice: venue.bookingNotice,
    features: venue.features,
    timeSlots: venue.timeSlots,
    dateOverrides: venue.dateOverrides,
    bookingTimeConfig: venue.bookingTimeConfig,
    openRanges: venue.openRanges
  }
}

function getVenueNameFromBooking(doc) {
  if (!doc) return ''
  return doc.venueName || (doc.venueSnapshot && doc.venueSnapshot.name) || getVenueName(doc.venueId) || '已删除场室'
}
function normalizeBooking(doc) {
  if (!doc) return null
  const form = doc.form || {}
  const peopleCount = Number(doc.peopleCount || getPeopleCountFromForm(form) || 0)
  return Object.assign({}, doc, {
    id: doc._id,
    timeLabel: doc.timeLabel || buildTimeLabel(doc.startTime, doc.endTime),
    venueName: getVenueNameFromBooking(doc),
    venueSnapshot: doc.venueSnapshot || null,
    form,
    peopleCount,
    maxPeopleLimitSnapshot: normalizeMaxPeopleLimit(doc.maxPeopleLimitSnapshot),
    remainingPeopleLimit: normalizeMaxPeopleLimit(doc.maxPeopleLimitSnapshot) > 0 ? Math.max(normalizeMaxPeopleLimit(doc.maxPeopleLimitSnapshot) - peopleCount, 0) : 0,
    rescheduleHistory: Array.isArray(doc.rescheduleHistory) ? doc.rescheduleHistory : []
  })
}
function sanitizePublicBooking(doc) {
  const booking = normalizeBooking(doc)
  if (!booking) return null
  return {
    id: booking.id,
    venueId: booking.venueId,
    venueName: booking.venueName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timeLabel: booking.timeLabel,
    status: booking.status,
    peopleCount: booking.peopleCount || 0,
    maxPeopleLimitSnapshot: booking.maxPeopleLimitSnapshot || 0,
    remainingPeopleLimit: booking.remainingPeopleLimit || 0
  }
}
function isSuperAdminOpenId(openId) {
  return !!openId && String(openId).trim() === SUPER_ADMIN_OPENID
}
function getPersistedAdminPermission(user) {
  if (!user) return false
  const permission = user.adminPermission || user.admin_permission || null
  if (!permission || typeof permission !== 'object') return false
  if (typeof permission.canEnterAdmin === 'boolean') return permission.canEnterAdmin
  if (typeof permission.isAdmin === 'boolean') return permission.isAdmin
  return false
}
function buildPermissionProfile(options) {
  options = options || {}
  const user = options.user || null
  const openId = String(options.openId || (user && (user.wechatOpenId || user.userId)) || '').trim()
  const isSuperAdmin = isSuperAdminOpenId(openId)
  const isDbAdmin = !!(user && (user.isAdmin || user.canEnterAdmin || getPersistedAdminPermission(user)))
  const canEnterAdmin = isSuperAdmin || isDbAdmin
  return {
    openId,
    isSuperAdmin,
    isAdmin: isDbAdmin,
    isDbAdmin,
    canEnterAdmin,
    canManageAdmins: isSuperAdmin,
    adminRole: isSuperAdmin ? 'super_admin' : (isDbAdmin ? 'admin' : 'user')
  }
}
function sanitizeUserProfile(doc, options) {
  if (!doc) return null
  const permission = buildPermissionProfile({ user: doc, openId: options && options.openId })
  return {
    userId: doc.userId,
    nickName: doc.nickName || '微信用户',
    avatarUrl: '',
    canEnterAdmin: permission.canEnterAdmin,
    isAdmin: permission.isAdmin,
    isSuperAdmin: permission.isSuperAdmin,
    canManageAdmins: permission.canManageAdmins,
    adminRole: permission.adminRole,
    permission
  }
}
function isAdminUserId(userId) {
  return isSuperAdminOpenId(userId)
}
function isCollectionNotExistsError(err, collectionName) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  if (!msg) return false
  const hasCollectionNotExists = msg.indexOf('database collection not exists') > -1 || msg.indexOf('Db or Table not exist') > -1 || msg.indexOf('COLLECTION_NOT_EXIST') > -1
  if (!hasCollectionNotExists) return false
  if (!collectionName) return true
  return msg.indexOf(String(collectionName)) > -1
}
function buildMissingCollectionError(collectionName) {
  const err = new Error(`系统数据暂未准备好，请稍后重试或联系管理员。`)
  err.code = 400
  err.errorType = 'COLLECTION_NOT_FOUND'
  err.collectionName = collectionName
  return err
}
function translateCollectionError(err, collectionName) {
  if (isCollectionNotExistsError(err, collectionName)) return buildMissingCollectionError(collectionName)
  return err
}
async function fetchAll(query, pageSize) {
  pageSize = pageSize || 100
  if (!query || typeof query.count !== 'function') return []
  const countRes = await query.count()
  const total = countRes.total || 0
  if (!total) return []
  const times = Math.ceil(total / pageSize)
  let rows = []
  for (let i = 0; i < times; i++) {
    const res = await query.skip(i * pageSize).limit(pageSize).get()
    rows = rows.concat(res.data || [])
  }
  return rows
}
async function getUserByUserId(userId) {
  if (!userId) return null
  const rows = await fetchAll(db.collection('users').where({ userId }), 20)
  return rows[0] || null
}
async function getUserPermissionByUserId(userId) {
  const user = await getUserByUserId(userId)
  return buildPermissionProfile({ user, openId: userId })
}
async function assertAdminUser(userId) {
  const permission = await getUserPermissionByUserId(userId)
  if (permission.canEnterAdmin) return true
  const err = new Error('仅管理员可访问')
  err.code = 403
  throw err
}
async function assertSuperAdminUser(userId) {
  const permission = await getUserPermissionByUserId(userId)
  if (permission.isSuperAdmin) return true
  const err = new Error('仅超级管理员可访问')
  err.code = 403
  throw err
}
async function getBookingById(bookingId) {
  const res = await db.collection('bookings').doc(bookingId).get()
  return res.data || null
}
async function getVenueByVenueId(venueId, options) {
  options = options || {}
  if (!venueId) return null
  let rows = []
  try {
    rows = await fetchAll(db.collection('venues').where({ venueId }), 20)
  } catch (err) {
    throw translateCollectionError(err, 'venues')
  }
  let item = rows[0] || null
  if (!item && options.allowLegacyFallback) {
    const legacy = LEGACY_VENUES.find(v => v.venueId === venueId)
    if (legacy) item = Object.assign({ _id: '' }, legacy, { visible: true, enabled: true, deleted: false, updatedBy: 'legacy' })
  }
  if (!item) return null
  if (!options.includeDeleted && item.deleted) return null
  return normalizeVenue(item)
}
async function listAvailableVenues() {
  try {
    const rows = await fetchAll(db.collection('venues').where({ visible: true, deleted: false }))
    const venues = (rows || [])
      .map(normalizeVenue)
      .filter(item => item && item.enabled !== false)
      .sort((a, b) => a.sort - b.sort)
    return await attachVenueImageUrls(venues)
  } catch (err) {
    if (isCollectionNotExistsError(err, 'venues')) return []
    throw err
  }
}
async function listAdminVenues() {
  try {
    const rows = await fetchAll(db.collection('venues'))
    const venues = (rows || []).map(normalizeVenue).filter(item => item && !item.deleted).sort((a, b) => a.sort - b.sort)
    return await attachVenueImageUrls(venues)
  } catch (err) {
    if (isCollectionNotExistsError(err, 'venues')) return []
    throw err
  }
}
async function listVenueDayBookings(venueId, date, includeCancelled) {
  const where = { venueId, date }
  if (!includeCancelled) where.status = _.in(OCCUPY_STATUS)
  const rows = await fetchAll(db.collection('bookings').where(where))
  return (rows || []).map(normalizeBooking).sort((a, b) => {
    if (a.date === b.date) return toMin(a.startTime) - toMin(b.startTime)
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
}
async function listBookingsByFilter(filters) {
  filters = filters || {}
  const where = {}
  if (filters.venueId) where.venueId = filters.venueId
  if (filters.date) where.date = filters.date
  if (filters.userId) where.userId = filters.userId
  if (filters.status) {
    if (Array.isArray(filters.status)) where.status = _.in(filters.status)
    else where.status = filters.status
  }
  const collection = db.collection('bookings')
  const query = Object.keys(where).length ? collection.where(where) : collection
  const rows = await fetchAll(query)
  return (rows || []).map(normalizeBooking)
}

function buildSummaryRowFromSlot(venue, date, slot, booking) {
  const currentPeople = booking ? getBookingPeopleCount(booking) : 0
  const maxPeopleLimit = resolveSlotLimit(venue, slot)
  return {
    venueId: venue.venueId,
    venueName: venue.name,
    date,
    startTime: slot.start,
    endTime: slot.end,
    timeLabel: slot.dateTimeLabel || slot.label || buildTimeLabel(slot.start, slot.end, true),
    dateTimeLabel: slot.dateTimeLabel || buildDateTimeRangeLabel(date, slot.start, slot.end),
    currentPeople,
    maxPeopleLimit,
    remainingPeople: maxPeopleLimit > 0 ? Math.max(maxPeopleLimit - currentPeople, 0) : 0,
    isFull: maxPeopleLimit > 0 && currentPeople >= maxPeopleLimit,
    bookingId: booking ? booking.id : '',
    status: booking ? booking.status : '',
    peopleCount: currentPeople,
    occupied: !!booking
  }
}
async function listBookingSummary(filters) {
  filters = filters || {}
  const venueId = String(filters.venueId || '').trim()
  const date = String(filters.date || '').trim()
  const summary = []
  if (date) {
    const venues = venueId
      ? [await getVenueByVenueId(venueId, { includeDeleted: true, allowLegacyFallback: false })].filter(item => item && !item.deleted && item.visible !== false)
      : (await listAvailableVenues()).filter(item => item && !item.deleted && item.visible !== false)
    const validVenueMap = {}
    for (let i = 0; i < venues.length; i++) validVenueMap[venues[i].venueId] = venues[i]
    const bookingList = (await listBookingsByFilter({ venueId, date, status: OCCUPY_STATUS })).filter(item => item && validVenueMap[item.venueId])
    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i]
      const slots = (getEffectiveTimeSlots(venue, date, { keepSeconds: true }) || []).map(slot => formatSlotDateTime(slot, date))
      for (let j = 0; j < slots.length; j++) {
        const slot = slots[j]
        let matchedBooking = null
        for (let n = 0; n < bookingList.length; n++) {
          const booking = bookingList[n]
          if (booking.venueId !== venue.venueId || booking.date !== date) continue
          if (isOverlap(slot.start, slot.end, booking.startTime, booking.endTime)) {
            matchedBooking = booking
            break
          }
        }
        summary.push(buildSummaryRowFromSlot(venue, date, slot, matchedBooking))
      }
    }
  } else {
    const currentVenues = venueId
      ? [await getVenueByVenueId(venueId, { includeDeleted: true, allowLegacyFallback: false })].filter(item => item && !item.deleted && item.visible !== false)
      : (await listAvailableVenues()).filter(item => item && !item.deleted && item.visible !== false)
    const normalizedMap = {}
    for (let i = 0; i < currentVenues.length; i++) {
      const venue = currentVenues[i]
      if (venue && venue.venueId) normalizedMap[venue.venueId] = venue
    }
    const bookingList = (await listBookingsByFilter({ venueId, status: OCCUPY_STATUS })).filter(item => item && normalizedMap[item.venueId])
    for (let n = 0; n < bookingList.length; n++) {
      const booking = bookingList[n]
      const venue = normalizedMap[booking.venueId]
      const maxPeopleLimit = normalizeMaxPeopleLimit(booking.maxPeopleLimitSnapshot) || getApplicableMaxPeopleLimit(venue, booking.date, booking.startTime, booking.endTime)
      const currentPeople = booking.peopleCount || getBookingPeopleCount(booking)
      summary.push({
        venueId: booking.venueId,
        venueName: venue.name || booking.venueName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        timeLabel: booking.timeLabel,
        dateTimeLabel: buildDateTimeRangeLabel(booking.date, booking.startTime, booking.endTime),
        currentPeople,
        maxPeopleLimit,
        remainingPeople: maxPeopleLimit > 0 ? Math.max(maxPeopleLimit - currentPeople, 0) : 0,
        isFull: maxPeopleLimit > 0 && currentPeople >= maxPeopleLimit,
        bookingId: booking.id,
        status: booking.status,
        peopleCount: currentPeople,
        occupied: true
      })
    }
  }
  summary.sort((a, b) => {
    const av = `${a.venueName || ''}_${a.date || ''}_${a.startTime || ''}`
    const bv = `${b.venueName || ''}_${b.date || ''}_${b.startTime || ''}`
    return av.localeCompare(bv)
  })
  return summary
}
function sortBookings(list, order) {
  list = list || []
  list.sort((a, b) => {
    const at = new Date(`${a.date || ''} ${a.startTime || '00:00'}`).getTime()
    const bt = new Date(`${b.date || ''} ${b.startTime || '00:00'}`).getTime()
    return order === 'desc' ? bt - at : at - bt
  })
  return list
}
async function enrichAdminBookings(list) {
  list = list || []
  if (!list.length) return []
  const userIds = []
  const map = {}
  for (let i = 0; i < list.length; i++) {
    const userId = list[i].userId
    if (userId && !map[userId]) {
      map[userId] = true
      userIds.push(userId)
    }
  }
  let userMap = {}
  if (userIds.length) {
    const userList = await fetchAll(db.collection('users').where({ userId: _.in(userIds) }))
    for (let i = 0; i < userList.length; i++) {
      userMap[userList[i].userId] = sanitizeUserProfile(userList[i])
    }
  }
  return list.map(item => {
    const userProfile = userMap[item.userId] || { userId: item.userId, nickName: '未知用户', avatarUrl: '', canEnterAdmin: false, isAdmin: false }
    return Object.assign({}, item, {
      userProfile,
      bookingOwner: {
        userId: item.userId,
        nickName: userProfile.nickName,
        avatarUrl: userProfile.avatarUrl,
        contactName: item.form && item.form.name ? item.form.name : userProfile.nickName,
        phone: item.form && item.form.phone ? item.form.phone : '',
        people: item.form && item.form.people ? item.form.people : '',
        idCard: item.form && item.form.idCard ? item.form.idCard : '',
        note: item.form && item.form.note ? item.form.note : ''
      }
    })
  })
}
function validateTimeSlots(timeSlots, options) {
  const validation = validateTimeSlotsDetailed(timeSlots, Object.assign({ keepSeconds: true, allowEmpty: false }, options || {}))
  if (!validation.ok) {
    const err = new Error(validation.message || '可预约时间段配置不合法')
    err.code = 400
    throw err
  }
  return validation.list
}
function validateVenueTimeConfig(defaultSlots, dateOverrides) {
  const validation = validateVenueTimeConfigDetailed(defaultSlots, dateOverrides, { keepSeconds: true })
  if (!validation.ok) {
    const err = new Error(validation.message || '可预约时间配置不合法')
    err.code = 400
    throw err
  }
  return validation
}
function assertBookingTimeInVenue(venue, startTime, endTime, date) {
  validateBookingTimeRange(startTime, endTime)
  const openRanges = getEffectiveOpenRanges(venue, date, { keepSeconds: true })
  const matchedRange = openRanges.find(item => isRangeWithinRanges(startTime, endTime, [item]))
  if (!matchedRange) {
    const err = new Error('所选时间段不在管理员配置的可预约范围内')
    err.code = 400
    throw err
  }
  return matchedRange
}
async function assertVenueBookableForPublic(venueId, startTime, endTime, date) {
  const venue = await getVenueByVenueId(venueId, { includeDeleted: true, allowLegacyFallback: true })
  if (!venue) {
    const err = new Error('场室不存在')
    err.code = 404
    throw err
  }
  if (venue.deleted) {
    const err = new Error('场室已删除，无法预约')
    err.code = 400
    throw err
  }
  if (!venue.visible) {
    const err = new Error('场室当前未对外展示')
    err.code = 400
    throw err
  }
  if (!venue.enabled) {
    const err = new Error('场室当前不可预约')
    err.code = 400
    throw err
  }
  const matchedSlot = assertBookingTimeInVenue(venue, startTime, endTime, date)
  return { venue, matchedSlot }
}
async function ensureNoConflict(payload, excludeBookingId) {
  const list = await listVenueDayBookings(payload.venueId, payload.date, false)
  for (const item of list) {
    if (excludeBookingId && item.id === excludeBookingId) continue
    if (isOverlap(payload.startTime, payload.endTime, item.startTime, item.endTime)) {
      const err = new Error(`所选时段与 ${item.timeLabel} 冲突`)
      err.code = 'CONFLICT'
      throw err
    }
  }
}
function assertValidDateStringOrThrow(date) {
  if (!isValidDateString(date)) {
    const err = new Error('预约日期格式不正确，请使用 YYYY-MM-DD')
    err.code = 400
    throw err
  }
  return date
}
function validateBookingPayload(payload) {
  payload = payload || {}
  const userId = String(payload.userId || '').trim()
  if (!userId) {
    const err = new Error('用户身份失效，请重新登录后再试')
    err.code = 401
    throw err
  }
  const venueId = String(payload.venueId || '').trim()
  if (!venueId) {
    const err = new Error('缺少 venueId')
    err.code = 400
    throw err
  }
  const date = validateBookingDate(String(payload.date || '').trim())
  const range = validateBookingTimeRange(String(payload.startTime || '').trim(), String(payload.endTime || '').trim())
  return {
    userId,
    venueId,
    date,
    startTime: range.startTime,
    endTime: range.endTime,
    timeLabel: String(payload.timeLabel || '').trim() || buildTimeLabel(range.startTime, range.endTime),
    form: payload.form || {}
  }
}
function normalizeReminderLeadMinutes(value) {
  const num = Number(value || 0)
  if (!isFinite(num) || num <= 0) return 0
  return Math.floor(num)
}
function buildChinaDateTimeMs(date, time) {
  const dateText = String(date || '').trim()
  const timeText = String(time || '').trim().slice(0, 8)
  if (!dateText || !timeText) return NaN
  const source = `${dateText}T${timeText.length === 5 ? `${timeText}:00` : timeText}+08:00`
  return new Date(source).getTime()
}
function formatChinaDateTime(ms) {
  ms = Number(ms || 0)
  if (!isFinite(ms) || ms <= 0) return ''
  const dt = new Date(ms + 8 * 60 * 60 * 1000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`
}
function formatReminderLeadText(minutes) {
  minutes = normalizeReminderLeadMinutes(minutes)
  if (!minutes) return ''
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const parts = []
  if (hour > 0) parts.push(`${hour}小时`)
  if (minute > 0) parts.push(`${minute}分钟`)
  return parts.join('') || '0分钟'
}
function buildReminderPatchByBooking(booking, subscriptionLike) {
  const leadMinutes = normalizeReminderLeadMinutes(subscriptionLike && subscriptionLike.reminderLeadMinutes)
  const bookingStartAtMs = buildChinaDateTimeMs(booking && booking.date, booking && booking.startTime)
  const patch = {
    reminderLeadMinutes: leadMinutes,
    reminderLeadText: formatReminderLeadText(leadMinutes),
    reminderBookingStartAtMs: isFinite(bookingStartAtMs) ? bookingStartAtMs : 0,
    reminderBookingStartAtText: booking && booking.date && booking.startTime ? `${booking.date} ${String(booking.startTime || '').slice(0, 5)}` : '',
    reminderBookingDate: booking && booking.date ? booking.date : '',
    reminderBookingTimeLabel: booking && booking.timeLabel ? booking.timeLabel : '',
    reminderLastError: ''
  }
  if (!(subscriptionLike && subscriptionLike.enabled)) {
    patch.reminderEnabled = false
    patch.reminderSendStatus = 'disabled'
    patch.reminderSendAtMs = 0
    patch.reminderSendAtText = ''
    patch.reminderSentAtMs = 0
    return patch
  }
  if (booking && booking.status === 'cancelled') {
    patch.reminderEnabled = false
    patch.reminderSendStatus = 'cancelled'
    patch.reminderSendAtMs = 0
    patch.reminderSendAtText = ''
    patch.reminderSentAtMs = 0
    patch.reminderLastError = '预约已取消'
    return patch
  }
  if (!(subscriptionLike && subscriptionLike.reminderEnabled) || leadMinutes <= 0 || !isFinite(bookingStartAtMs)) {
    patch.reminderEnabled = false
    patch.reminderSendStatus = 'disabled'
    patch.reminderSendAtMs = 0
    patch.reminderSendAtText = ''
    patch.reminderSentAtMs = 0
    return patch
  }
  const reminderAtMs = bookingStartAtMs - leadMinutes * 60 * 1000
  patch.reminderEnabled = true
  patch.reminderSendAtMs = reminderAtMs > 0 ? reminderAtMs : 0
  patch.reminderSendAtText = reminderAtMs > 0 ? formatChinaDateTime(reminderAtMs) : ''
  patch.reminderSentAtMs = 0
  patch.reminderSendStatus = reminderAtMs > Date.now() ? 'pending' : 'expired'
  if (patch.reminderSendStatus === 'expired') patch.reminderLastError = '提醒时间已过'
  return patch
}
async function upsertSubscription({ bookingId, userId, enabled, tmplIds, acceptResultMap, templateConfigMap, reminderEnabled, reminderLeadMinutes, booking }) {
  const rows = await fetchAll(db.collection('booking_subscriptions').where({ bookingId, userId }), 20)
  const existing = (rows && rows.length) ? rows[0] : null
  const nextEnabled = enabled == null ? !!(existing && existing.enabled) : !!enabled
  const nextLeadMinutes = reminderLeadMinutes == null
    ? normalizeReminderLeadMinutes(existing && existing.reminderLeadMinutes)
    : normalizeReminderLeadMinutes(reminderLeadMinutes)
  const nextReminderEnabled = nextEnabled && (reminderEnabled == null
    ? !!(existing && existing.reminderEnabled && nextLeadMinutes > 0)
    : (!!reminderEnabled && nextLeadMinutes > 0))
  const base = {
    bookingId,
    userId,
    enabled: nextEnabled,
    tmplIds: Array.isArray(tmplIds) && tmplIds.length ? tmplIds : ((existing && existing.tmplIds) || []),
    acceptResultMap: acceptResultMap && Object.keys(acceptResultMap).length ? acceptResultMap : ((existing && existing.acceptResultMap) || {}),
    templateConfigMap: templateConfigMap && Object.keys(templateConfigMap).length ? templateConfigMap : ((existing && existing.templateConfigMap) || {}),
    reminderEnabled: nextReminderEnabled,
    reminderLeadMinutes: nextLeadMinutes,
    updatedAt: db.serverDate()
  }
  const reminderPatch = booking ? buildReminderPatchByBooking(booking, base) : {}
  const data = Object.assign({}, base, reminderPatch)
  if (existing) {
    await db.collection('booking_subscriptions').doc(existing._id).update({ data })
    return Object.assign({}, existing, data)
  }
  const payload = Object.assign({}, data, { createdAt: db.serverDate() })
  const addRes = await db.collection('booking_subscriptions').add({ data: payload })
  return Object.assign({ _id: addRes._id }, payload)
}
async function syncSubscriptionReminderForBooking(booking) {
  if (!booking || !booking._id) return 0
  const rows = await fetchAll(db.collection('booking_subscriptions').where({ bookingId: booking._id }), 100)
  if (!rows.length) return 0
  const tasks = rows.map(item => {
    const patch = buildReminderPatchByBooking(booking, item)
    patch.updatedAt = db.serverDate()
    return db.collection('booking_subscriptions').doc(item._id).update({ data: patch })
  })
  await Promise.all(tasks)
  return rows.length
}
async function createNotificationLog({ booking, type, title, content, extra }) {
  const rows = await fetchAll(db.collection('booking_subscriptions').where({ bookingId: booking._id, enabled: true }))
  const tasks = rows.map(item => db.collection('booking_notifications').add({
    data: {
      bookingId: booking._id,
      userId: item.userId,
      type,
      status: booking.status,
      title,
      content,
      extra: extra || {},
      createdAt: db.serverDate(),
      read: false
    }
  }))
  await Promise.all(tasks)
  return rows.length
}
async function seedLegacyVenuesIfEmpty(userId) {
  await assertAdminUser(userId)
  let countRes
  try {
    countRes = await db.collection('venues').count()
  } catch (err) {
    throw translateCollectionError(err, 'venues')
  }
  if ((countRes.total || 0) > 0) return { inserted: 0, skipped: true }
  const now = db.serverDate()
  for (let i = 0; i < LEGACY_VENUES.length; i++) {
    const item = LEGACY_VENUES[i]
    await db.collection('venues').add({
      data: Object.assign({}, item, {
        visible: true,
        enabled: true,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId || 'system'
      })
    })
  }
  return { inserted: LEGACY_VENUES.length, skipped: false }
}
function buildVenuePayload(payload, userId) {
  payload = payload || {}
  const name = String(payload.name || '').trim()
  if (!name) {
    const err = new Error('场室名称不能为空')
    err.code = 400
    throw err
  }
  const venueId = sanitizeVenueId(payload.venueId || payload.id || name)
  const timeConfig = validateVenueTimeConfig(
    payload.timeSlots || (payload.bookingTimeConfig && payload.bookingTimeConfig.defaultSlots) || [],
    payload.dateOverrides || (payload.bookingTimeConfig && payload.bookingTimeConfig.dateOverrides) || []
  )
  const maxPeopleLimit = normalizeMaxPeopleLimit(payload.maxPeopleLimit || (payload.bookingTimeConfig && payload.bookingTimeConfig.maxPeopleLimit))
  const plainDefaultSlots = timeConfig.defaultSlots.map(item => ({
    start: item.start,
    end: item.end,
    label: item.label,
    maxPeopleLimit: normalizeMaxPeopleLimit(item.maxPeopleLimit)
  }))
  const plainDateOverrides = timeConfig.dateOverrides.map(item => ({
    date: item.date,
    timeSlots: (item.timeSlots || []).map(slot => ({
      start: slot.start,
      end: slot.end,
      label: slot.label,
      maxPeopleLimit: normalizeMaxPeopleLimit(slot.maxPeopleLimit),
      startDateTime: buildDateTimeText(item.date, slot.start),
      endDateTime: buildDateTimeText(item.date, slot.end),
      dateTimeLabel: buildDateTimeRangeLabel(item.date, slot.start, slot.end)
    }))
  }))
  return {
    venueId,
    name,
    description: String(payload.description || '').trim(),
    location: String(payload.location || '').trim(),
    capacity: Number(payload.capacity || 0),
    maxPeopleLimit,
    visible: payload.visible !== false,
    enabled: payload.enabled !== false,
    deleted: !!payload.deleted,
    sort: Number(payload.sort || 0),
    timeSlots: plainDefaultSlots,
    bookingTimeConfig: {
      defaultSlots: plainDefaultSlots,
      dateOverrides: plainDateOverrides,
      maxPeopleLimit
    },
    bookingNotice: String(payload.bookingNotice || '').trim(),
    images: chooseVenueImagesForSave(payload, payload.existingVenueForImages),
    features: Array.isArray(payload.features) ? payload.features : [],
    updatedAt: db.serverDate(),
    updatedBy: userId || ''
  }
}

module.exports = {
  cloud,
  db,
  _,
  OCCUPY_STATUS,
  CANCEL_STATUS,
  LEGACY_VENUES,
  VENUES,
  SUPER_ADMIN_OPENID,
  success,
  fail,
  getVenueName,
  pad2,
  isValidTimeString,
  isValidDateString,
  validateBookingDate,
  assertValidDateStringOrThrow,
  validateBookingTimeRange,
  toMin,
  isOverlap,
  buildTimeLabel,
  normalizeRange,
  mergeRanges,
  normalizeTimeSlot,
  normalizeTimeSlots,
  mergeTimeSlotsToRanges,
  isRangeWithinRanges,
  findContainingRange,
  normalizeVenue,
  chooseVenueImagesForSave,
  buildVenueSnapshot,
  normalizeBooking,
  sanitizePublicBooking,
  sanitizeUserProfile,
  sanitizeVenueId,
  isSuperAdminOpenId,
  buildPermissionProfile,
  isAdminUserId,
  assertAdminUser,
  assertSuperAdminUser,
  getUserPermissionByUserId,
  fetchAll,
  getUserByUserId,
  getBookingById,
  getVenueByVenueId,
  listAvailableVenues,
  listAdminVenues,
  listVenueDayBookings,
  listBookingsByFilter,
  sortBookings,
  enrichAdminBookings,
  validateTimeSlots,
  validateVenueTimeConfig,
  assertBookingTimeInVenue,
  assertVenueBookableForPublic,
  ensureNoConflict,
  validateBookingPayload,
  getPeopleCountFromForm,
  getBookingPeopleCount,
  getVenueLevelMaxPeopleLimit,
  getApplicableMaxPeopleLimit,
  assertBookingStartTimeNotPast,
  assertBookingPeopleWithinLimit,
  listBookingSummary,
  upsertSubscription,
  syncSubscriptionReminderForBooking,
  createNotificationLog,
  seedLegacyVenuesIfEmpty,
  buildVenuePayload,
  isCollectionNotExistsError,
  buildMissingCollectionError,
  translateCollectionError
}
