const svc = require('_shared/bookingService')
const { cloud, db, fetchAll, assertSuperAdminUser, buildPermissionProfile, success, fail } = svc

function trimString(value) {
  return String(value || '').trim()
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
  return !!trimString(doc.phone)
}

function sanitizeManageUser(doc) {
  if (!doc) return null
  const permission = buildPermissionProfile({ user: doc, openId: doc.wechatOpenId || doc.userId || '' })
  return {
    userId: doc.userId || '',
    nickName: trimString(doc.nickName) || '微信用户',
    phone: trimString(doc.phone),
    phoneMask: maskPhone(doc.phone),
    loginType: doc.loginType || (computeWechatBound(doc) ? 'wechat' : (computePhoneBound(doc) ? 'phone' : 'wechat')),
    isPhoneBound: computePhoneBound(doc),
    isWechatBound: computeWechatBound(doc),
    isAdmin: permission.isAdmin,
    canEnterAdmin: permission.canEnterAdmin,
    isSuperAdmin: permission.isSuperAdmin,
    canManageAdmins: permission.canManageAdmins,
    adminRole: permission.adminRole,
    permission,
    updatedAt: doc.updatedAt || null,
    lastLoginAt: doc.lastLoginAt || null,
    createTime: doc.createTime || null
  }
}

function matchKeyword(doc, keyword) {
  if (!keyword) return true
  const text = [
    doc.userId,
    doc.wechatOpenId,
    doc.nickName,
    doc.phone,
    doc.unionId
  ].map(item => trimString(item).toLowerCase()).join(' ')
  return text.indexOf(keyword) > -1
}

function toTimeValue(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const time = new Date(value).getTime()
    return isNaN(time) ? 0 : time
  }
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object') {
    if (value.$date) return new Date(value.$date).getTime() || 0
    if (typeof value.toDate === 'function') {
      try { return value.toDate().getTime() || 0 } catch (e) {}
    }
    if (typeof value.getTime === 'function') {
      try { return value.getTime() || 0 } catch (e) {}
    }
  }
  return 0
}

function sortUsers(a, b) {
  const roleA = a.isSuperAdmin ? 0 : (a.canEnterAdmin ? 1 : 2)
  const roleB = b.isSuperAdmin ? 0 : (b.canEnterAdmin ? 1 : 2)
  if (roleA !== roleB) return roleA - roleB
  const timeA = toTimeValue(a.lastLoginAt || a.updatedAt || a.createTime)
  const timeB = toTimeValue(b.lastLoginAt || b.updatedAt || b.createTime)
  return timeB - timeA
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    await assertSuperAdminUser(wxContext.OPENID)
    const keyword = trimString(event && event.keyword).toLowerCase()
    const rows = await fetchAll(db.collection('users'), 100)
    const filtered = (rows || []).filter(item => item && item.userId && matchKeyword(item, keyword))
    const data = filtered.map(sanitizeManageUser).sort(sortUsers).slice(0, 200)
    return success(data)
  } catch (err) {
    console.error('getAdminUsers error', err)
    return fail(err.code || 500, err.message || '查询管理员用户列表失败')
  }
}
