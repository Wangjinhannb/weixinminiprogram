const svc = require('_shared/bookingService')
const { cloud, db, buildPermissionProfile, success, fail } = svc

const NICKNAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'
const NICKNAME_MIN_LENGTH = 8
const NICKNAME_MAX_LENGTH = 10
const MAX_NICKNAME_RETRY = 20

function trimString(value) {
  return String(value || '').trim()
}

function dedupeUsers(list) {
  const map = {}
  const out = []
  ;(list || []).forEach(item => {
    if (!item || !item._id || map[item._id]) return
    map[item._id] = true
    out.push(item)
  })
  return out
}

async function findUsers(where) {
  if (!where || !Object.keys(where).length) return []
  const res = await db.collection('users').where(where).limit(20).get()
  return res.data || []
}

async function getUserByOpenId(openId) {
  if (!openId) return null
  const byUserId = await findUsers({ userId: openId })
  const byWechatOpenId = await findUsers({ wechatOpenId: openId })
  const rows = dedupeUsers([].concat(byUserId, byWechatOpenId))
  if (!rows.length) return null
  if (rows.length > 1) {
    const err = new Error('当前微信身份匹配到多个账号，请联系管理员处理历史数据')
    err.code = 409
    throw err
  }
  return rows[0]
}

async function getUserByPhone(phone) {
  if (!phone) return null
  const rows = await findUsers({ phone })
  if (!rows.length) return null
  if (rows.length > 1) {
    const err = new Error('当前手机号匹配到多个账号，请联系管理员处理历史数据')
    err.code = 409
    throw err
  }
  return rows[0]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomNickName(length) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += NICKNAME_CHARS.charAt(Math.floor(Math.random() * NICKNAME_CHARS.length))
  }
  return out
}

async function isNickNameTaken(nickName, excludeId) {
  const rows = await findUsers({ nickName })
  if (!rows.length) return false
  return rows.some(item => !excludeId || item._id !== excludeId)
}

async function generateUniqueNickName(excludeId) {
  for (let i = 0; i < MAX_NICKNAME_RETRY; i++) {
    const candidate = randomNickName(randomInt(NICKNAME_MIN_LENGTH, NICKNAME_MAX_LENGTH))
    const taken = await isNickNameTaken(candidate, excludeId)
    if (!taken) return candidate
  }
  const err = new Error('随机昵称生成失败，请稍后重试')
  err.code = 500
  throw err
}

async function ensureUserNickName(existing) {
  const current = trimString(existing && existing.nickName)
  if (current) return current
  return generateUniqueNickName(existing && existing._id)
}

function maskPhone(phone) {
  phone = trimString(phone)
  if (!/^1\d{10}$/.test(phone)) return phone
  return `${phone.slice(0, 3)}****${phone.slice(7)}`
}

function computeWechatBound(doc) {
  if (!doc) return false
  if (typeof doc.isWechatBound === 'boolean') return doc.isWechatBound
  if (doc.loginType === 'wechat') return true
  if (doc.avatarUrl) return true
  if (trimString(doc.nickName) && trimString(doc.nickName) !== '游客') return true
  return false
}

function computePhoneBound(doc) {
  if (!doc) return false
  if (typeof doc.isPhoneBound === 'boolean') return doc.isPhoneBound
  return !!doc.phone
}

function computeProfileCompleted(doc) {
  if (!doc) return false
  if (typeof doc.profileCompleted === 'boolean') return doc.profileCompleted
  return computePhoneBound(doc) || computeWechatBound(doc)
}

function sanitizeUserProfile(doc, wxContext) {
  if (!doc) return null
  const isPhoneBound = computePhoneBound(doc)
  const isWechatBound = computeWechatBound(doc)
  const loginType = doc.loginType || (isWechatBound ? 'wechat' : (isPhoneBound ? 'phone' : 'wechat'))
  const permission = buildPermissionProfile({
    user: doc,
    openId: (wxContext && wxContext.OPENID) || doc.wechatOpenId || doc.userId || ''
  })
  return {
    userId: doc.userId,
    nickName: isWechatBound ? trimString(doc.nickName) : '',
    avatarUrl: '',
    phone: doc.phone || '',
    phoneMask: maskPhone(doc.phone || ''),
    wechatOpenId: '',
    unionId: '',
    loginType,
    isPhoneBound,
    isWechatBound,
    profileCompleted: computeProfileCompleted(doc),
    canEnterAdmin: permission.canEnterAdmin,
    isAdmin: permission.isAdmin,
    isSuperAdmin: permission.isSuperAdmin,
    canManageAdmins: permission.canManageAdmins,
    adminRole: permission.adminRole,
    permission
  }
}

async function getPhoneNumberByCode(code) {
  if (!code) {
    const err = new Error('缺少手机号授权凭证')
    err.code = 400
    throw err
  }
  try {
    const res = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    const info = res && (res.phoneInfo || res.phone_info || {})
    const phone = trimString(info.phoneNumber || info.purePhoneNumber || '')
    if (!/^1\d{10}$/.test(phone)) {
      const err = new Error('未获取到有效手机号')
      err.code = 400
      throw err
    }
    return phone
  } catch (err) {
    console.error('getPhoneNumberByCode error', err)
    const nextErr = new Error(err.message || '获取手机号失败，请确认小程序已认证并已开通手机号能力')
    nextErr.code = err.code || 400
    throw nextErr
  }
}

function buildBasePatch(existing, wxContext) {
  return {
    userId: (existing && existing.userId) || wxContext.OPENID,
    wechatOpenId: wxContext.OPENID,
    unionId: wxContext.UNIONID || (existing && existing.unionId) || '',
    updatedAt: db.serverDate(),
    lastLoginAt: db.serverDate()
  }
}

async function saveUser(existing, patch) {
  const payload = Object.assign({}, existing || {}, patch || {})
  payload.isPhoneBound = computePhoneBound(payload)
  payload.isWechatBound = computeWechatBound(payload)
  payload.profileCompleted = computeProfileCompleted(payload)
  const patchWithDerived = Object.assign({}, patch || {}, {
    isPhoneBound: payload.isPhoneBound,
    isWechatBound: payload.isWechatBound,
    profileCompleted: payload.profileCompleted
  })
  if (!existing) {
    const data = Object.assign({}, payload, { createTime: db.serverDate() })
    const result = await db.collection('users').add({ data })
    return Object.assign({ _id: result._id }, data)
  }
  await db.collection('users').doc(existing._id).update({ data: patchWithDerived })
  return Object.assign({}, existing, patchWithDerived)
}

async function refreshUser(existing, wxContext) {
  if (!existing) {
    const err = new Error('当前会话未登录')
    err.code = 401
    throw err
  }
  const basePatch = buildBasePatch(existing, wxContext)
  const patch = {}
  if ((existing.wechatOpenId || '') !== basePatch.wechatOpenId) patch.wechatOpenId = basePatch.wechatOpenId
  if ((existing.unionId || '') !== basePatch.unionId) patch.unionId = basePatch.unionId
  patch.updatedAt = db.serverDate()
  patch.lastLoginAt = db.serverDate()
  if (typeof existing.isPhoneBound !== 'boolean') patch.isPhoneBound = computePhoneBound(existing)
  if (typeof existing.isWechatBound !== 'boolean') patch.isWechatBound = computeWechatBound(existing)
  if (typeof existing.profileCompleted !== 'boolean') patch.profileCompleted = computeProfileCompleted(existing)
  if (computeWechatBound(existing) && !trimString(existing.nickName)) {
    patch.nickName = await ensureUserNickName(existing)
    patch.isWechatBound = true
    patch.profileCompleted = true
  }
  if (!Object.keys(patch).length) return existing
  return saveUser(existing, patch)
}

async function handleWechatAction(existing, wxContext, action) {
  const basePatch = buildBasePatch(existing, wxContext)
  const nickName = await ensureUserNickName(existing)
  const patch = Object.assign({}, basePatch, {
    loginType: 'wechat',
    nickName,
    avatarUrl: (existing && existing.avatarUrl) || '',
    isWechatBound: true,
    profileCompleted: true
  })
  const saved = await saveUser(existing, patch)
  return success(sanitizeUserProfile(saved, wxContext), action === 'bindWechat' ? '微信绑定成功' : '登录成功')
}

async function handlePhoneAction(existing, wxContext, event, action) {
  const phone = await getPhoneNumberByCode(event.phoneCode)
  const phoneOwner = await getUserByPhone(phone)

  if (phoneOwner && existing && phoneOwner._id !== existing._id) {
    const err = new Error('该手机号已绑定其他账号，无法重复绑定')
    err.code = 409
    throw err
  }
  if (phoneOwner && !existing && phoneOwner.userId !== wxContext.OPENID) {
    const err = new Error('该手机号已绑定其他账号，请使用原账号登录后再绑定')
    err.code = 409
    throw err
  }

  const target = existing || phoneOwner
  const basePatch = buildBasePatch(target, wxContext)
  const patch = Object.assign({}, basePatch, {
    phone,
    loginType: action === 'bindPhone' ? ((target && target.loginType) || (computeWechatBound(target) ? 'wechat' : 'phone')) : 'phone',
    isPhoneBound: true,
    profileCompleted: true
  })

  if (!target) {
    patch.nickName = ''
    patch.avatarUrl = ''
    patch.isWechatBound = false
  } else if (computeWechatBound(target) && !trimString(target.nickName)) {
    patch.nickName = await ensureUserNickName(target)
  }

  const saved = await saveUser(target, patch)
  return success(sanitizeUserProfile(saved, wxContext), action === 'bindPhone' ? '手机号绑定成功' : '登录成功')
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    const existing = await getUserByOpenId(openId)
    let action = event.action || ''

    if (!action) {
      if (event.phoneCode) action = 'phoneLogin'
      else if (Object.prototype.hasOwnProperty.call(event, 'nickName') || Object.prototype.hasOwnProperty.call(event, 'avatarUrl')) action = 'wechatLogin'
      else action = 'refresh'
    }

    if (action === 'refresh') {
      const latest = await refreshUser(existing, wxContext)
      return success(sanitizeUserProfile(latest, wxContext))
    }

    if (action === 'wechatLogin' || action === 'bindWechat') {
      return await handleWechatAction(existing, wxContext, action)
    }

    if (action === 'phoneLogin') {
      return await handlePhoneAction(existing, wxContext, event, action)
    }

    if (action === 'bindPhone') {
      if (!existing) return fail(401, '请先登录后再绑定手机号')
      return await handlePhoneAction(existing, wxContext, event, action)
    }

    return fail(400, '不支持的操作类型')
  } catch (e) {
    console.error('syncUser error', e)
    return fail(e.code || 500, e.message || '同步用户失败')
  }
}
