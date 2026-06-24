const svc = require('_shared/bookingService')
const { cloud, db, _, fetchAll, getBookingById, normalizeBooking } = svc

function pad2(v) {
  v = Number(v || 0)
  return v < 10 ? `0${v}` : `${v}`
}
function formatChinaDateTime(ms) {
  ms = Number(ms || 0)
  if (!isFinite(ms) || ms <= 0) return ''
  const dt = new Date(ms + 8 * 60 * 60 * 1000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`
}
function formatLeadText(minutes) {
  minutes = Number(minutes || 0)
  if (!isFinite(minutes) || minutes <= 0) return ''
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const parts = []
  if (hour > 0) parts.push(`${hour}小时`)
  if (minute > 0) parts.push(`${minute}分钟`)
  return parts.join('') || '0分钟'
}
function getTypeLabel(type) {
  if (type === 'BOOKING_CREATED') return '预约成功通知'
  if (type === 'BOOKING_REMINDER') return '预约开始前提醒'
  return '预约通知'
}
function getRemarkByType(type, subscription) {
  if (type === 'BOOKING_CREATED') return '请按预约时间到场'
  if (type === 'BOOKING_REMINDER') return formatLeadText(subscription && subscription.reminderLeadMinutes) || '请提前做好准备'
  return '请留意预约状态'
}
function pickTemplateConfig(subscription, type) {
  const map = (subscription && subscription.templateConfigMap) || {}
  const acceptMap = (subscription && subscription.acceptResultMap) || {}
  const alias = type === 'BOOKING_REMINDER' ? 'bookingReminder' : 'bookingSuccess'
  const aliasConfig = map[alias]
  if (aliasConfig && aliasConfig.id && acceptMap[aliasConfig.id] === 'accept') return aliasConfig
  const keys = Object.keys(map)
  for (let i = 0; i < keys.length; i++) {
    const item = map[keys[i]]
    if (item && item.id && acceptMap[item.id] === 'accept') return item
  }
  const tmplIds = Array.isArray(subscription && subscription.tmplIds) ? subscription.tmplIds : []
  for (let j = 0; j < tmplIds.length; j++) {
    if (acceptMap[tmplIds[j]] === 'accept') {
      return {
        id: tmplIds[j],
        page: 'pages/booking_detail/booking_detail?id={{bookingId}}',
        fields: [
          { key: 'thing1', source: 'title', maxLength: 20 },
          { key: 'thing2', source: 'venueName', maxLength: 20 },
          { key: 'time3', source: 'bookingStartText', maxLength: 32 },
          { key: 'thing4', source: 'remark', maxLength: 20 }
        ]
      }
    }
  }
  return null
}
function resolvePage(config, booking) {
  const raw = String((config && config.page) || 'pages/booking_detail/booking_detail?id={{bookingId}}')
  return raw.replace(/\{\{bookingId\}\}/g, booking && booking._id ? booking._id : '')
}
function buildMessageContext(booking, bookingView, type, subscription) {
  return {
    title: getTypeLabel(type),
    venueName: bookingView.venueName || '预约场室',
    bookingDate: bookingView.date || '',
    bookingTime: bookingView.timeLabel || '',
    bookingStartText: bookingView.date && bookingView.startTime
      ? `${bookingView.date} ${String(bookingView.startTime || '').slice(0, 5)}`
      : '',
    reminderLeadText: formatLeadText(subscription && subscription.reminderLeadMinutes),
    reminderAtText: subscription && subscription.reminderSendAtText ? subscription.reminderSendAtText : '',
    remark: getRemarkByType(type, subscription),
    bookingId: booking && booking._id ? booking._id : '',

    contactName: booking && booking.form && booking.form.name ? booking.form.name : '',
    contactPhone: booking && booking.form && booking.form.phone ? booking.form.phone : '',
    bookingItem: '场室预约',
    reminderContent: `${bookingView.venueName || '您预约的场室'}即将开始`
  }
}
function truncateValue(value, maxLength) {
  value = String(value == null ? '' : value)
  if (!maxLength || value.length <= maxLength) return value
  return value.slice(0, maxLength)
}
function buildTemplateData(config, context) {
  const fields = Array.isArray(config && config.fields) ? config.fields : []
  const data = {}
  for (let i = 0; i < fields.length; i++) {
    const item = fields[i] || {}
    if (!item.key) continue
    const source = item.source || item.key
    data[item.key] = { value: truncateValue(context[source] || item.fallback || '', item.maxLength || 20) }
  }
  return data
}
async function writeNotificationLog({ booking, userId, type, title, content, extra, sendStatus, templateId }) {
  await db.collection('booking_notifications').add({
    data: {
      bookingId: booking._id,
      userId,
      type,
      status: booking.status,
      title,
      content,
      extra: Object.assign({ sendStatus: sendStatus || 'pending', templateId: templateId || '' }, extra || {}),
      createdAt: db.serverDate(),
      read: false
    }
  })
}
async function markSubscriptionSendResult(subscriptionId, patch) {
  await db.collection('booking_subscriptions').doc(subscriptionId).update({
    data: Object.assign({ updatedAt: db.serverDate() }, patch || {})
  })
}
async function sendSingleMessage({ booking, subscription, type }) {
  const bookingView = normalizeBooking(booking)
  const templateConfig = pickTemplateConfig(subscription, type)
  if (!templateConfig || !templateConfig.id) {
    if (type === 'BOOKING_REMINDER') {
      await markSubscriptionSendResult(subscription._id, {
        reminderSendStatus: 'skipped',
        reminderLastError: '未找到已授权的订阅模板'
      })
    }
    await writeNotificationLog({
      booking,
      userId: subscription.userId,
      type,
      title: getTypeLabel(type),
      content: `${bookingView.date} ${bookingView.timeLabel} 未发送：缺少可用模板`,
      extra: { reason: 'missing_template' },
      sendStatus: 'skipped'
    })
    return { sent: false, reason: 'missing_template' }
  }
  const context = buildMessageContext(booking, bookingView, type, subscription)
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: subscription.userId,
      templateId: templateConfig.id,
      page: resolvePage(templateConfig, booking),
      lang: 'zh_CN',
      data: buildTemplateData(templateConfig, context)
    })
    if (type === 'BOOKING_REMINDER') {
      await markSubscriptionSendResult(subscription._id, {
        reminderSendStatus: 'sent',
        reminderSentAtMs: Date.now(),
        reminderLastError: ''
      })
    }
    await writeNotificationLog({
      booking,
      userId: subscription.userId,
      type,
      title: getTypeLabel(type),
      content: `${bookingView.date} ${bookingView.timeLabel} 已发送订阅消息`,
      extra: { reminderAtText: subscription.reminderSendAtText || '', reminderLeadText: formatLeadText(subscription.reminderLeadMinutes) },
      sendStatus: 'sent',
      templateId: templateConfig.id
    })
    return { sent: true }
  } catch (err) {
    const errorMessage = err && err.errMsg ? err.errMsg : ((err && err.message) || '发送失败')
    if (type === 'BOOKING_REMINDER') {
      await markSubscriptionSendResult(subscription._id, {
        reminderSendStatus: 'failed',
        reminderLastError: errorMessage
      })
    }
    await writeNotificationLog({
      booking,
      userId: subscription.userId,
      type,
      title: getTypeLabel(type),
      content: `${bookingView.date} ${bookingView.timeLabel} 发送失败：${errorMessage}`,
      extra: { errorMessage },
      sendStatus: 'failed',
      templateId: templateConfig.id
    })
    return { sent: false, reason: errorMessage }
  }
}
async function dispatchBookingCreated(bookingId) {
  const booking = await getBookingById(bookingId)
  if (!booking) return { count: 0, sent: 0, skipped: 0 }
  const rows = await fetchAll(db.collection('booking_subscriptions').where({ bookingId, enabled: true }), 20)
  let sent = 0
  let skipped = 0
  for (let i = 0; i < rows.length; i++) {
    const result = await sendSingleMessage({ booking, subscription: rows[i], type: 'BOOKING_CREATED' })
    if (result.sent) sent += 1
    else skipped += 1
  }
  return { count: rows.length, sent, skipped }
}
async function dispatchDueReminders() {
  const now = Date.now()
  const rows = await fetchAll(db.collection('booking_subscriptions').where({
    enabled: true,
    reminderEnabled: true,
    reminderSendStatus: 'pending',
    reminderSendAtMs: _.lte(now)
  }), 100)
  let sent = 0
  let skipped = 0
  for (let i = 0; i < rows.length; i++) {
    const subscription = rows[i]
    const booking = await getBookingById(subscription.bookingId)
    if (!booking || booking.status === 'cancelled') {
      await markSubscriptionSendResult(subscription._id, {
        reminderSendStatus: 'cancelled',
        reminderLastError: '预约不存在或已取消'
      })
      skipped += 1
      continue
    }
    const bookingStartAtMs = Number(subscription.reminderBookingStartAtMs || 0)
    if (bookingStartAtMs > 0 && bookingStartAtMs <= now) {
      await markSubscriptionSendResult(subscription._id, {
        reminderSendStatus: 'expired',
        reminderLastError: '预约开始时间已过'
      })
      skipped += 1
      continue
    }
    const result = await sendSingleMessage({ booking, subscription, type: 'BOOKING_REMINDER' })
    if (result.sent) sent += 1
    else skipped += 1
  }
  return { count: rows.length, sent, skipped, nowText: formatChinaDateTime(now) }
}

exports.main = async (event) => {
  try {
    if (event && event.bookingId && event.type === 'BOOKING_CREATED') {
      const summary = await dispatchBookingCreated(event.bookingId)
      return { code: 200, data: summary, message: '预约成功通知处理完成' }
    }
    const summary = await dispatchDueReminders()
    return { code: 200, data: summary, message: '定时提醒处理完成' }
  } catch (err) {
    console.error('notifyBookingSubscribers error', err)
    return { code: 500, message: err.message || '通知失败' }
  }
}
