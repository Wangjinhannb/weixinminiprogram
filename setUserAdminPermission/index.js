const svc = require('_shared/bookingService')
const { cloud, db, assertSuperAdminUser, getUserByUserId, buildPermissionProfile, success, fail } = svc

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
    permission
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    await assertSuperAdminUser(wxContext.OPENID)
    const userId = trimString(event && event.userId)
    if (!userId) return fail(400, '缺少 userId')
    const target = await getUserByUserId(userId)
    if (!target) return fail(404, '未找到目标用户')

    const permission = buildPermissionProfile({ user: target, openId: userId })
    if (permission.isSuperAdmin) return fail(400, '超级管理员权限固定，不支持修改')

    const canEnterAdmin = !!(event && event.canEnterAdmin)
    const operatorId = wxContext.OPENID || ''
    const permissionChangedAt = new Date()
    const adminPermission = {
      canEnterAdmin: canEnterAdmin,
      isAdmin: canEnterAdmin,
      role: canEnterAdmin ? 'admin' : 'user',
      persisted: true,
      source: 'super_admin_grant',
      updatedAt: permissionChangedAt,
      updatedBy: operatorId
    }
    if (canEnterAdmin) {
      adminPermission.grantedAt = permissionChangedAt
      adminPermission.grantedBy = operatorId
    } else {
      adminPermission.revokedAt = permissionChangedAt
      adminPermission.revokedBy = operatorId
    }

    await db.collection('users').doc(target._id).update({
      data: {
        isAdmin: canEnterAdmin,
        canEnterAdmin: canEnterAdmin,
        adminPermission: adminPermission,
        updatedAt: db.serverDate(),
        updatedBy: operatorId
      }
    })

    const latest = Object.assign({}, target, {
      isAdmin: canEnterAdmin,
      canEnterAdmin: canEnterAdmin,
      adminPermission: adminPermission
    })
    return success(sanitizeManageUser(latest), canEnterAdmin ? '管理员权限已开启' : '管理员权限已移除')
  } catch (err) {
    console.error('setUserAdminPermission error', err)
    return fail(err.code || 500, err.message || '设置管理员权限失败')
  }
}
