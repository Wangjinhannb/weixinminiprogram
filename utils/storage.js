var profile = require('./profile');

var KEY_USER = 'VB_USER';
var KEY_BOOKINGS = 'VB_BOOKINGS';

function maskPhone(phone) {
  phone = String(phone || '').trim();
  if (!/^1\d{10}$/.test(phone)) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

function buildGuestUser() {
  return {
    userId: '',
    nickName: '游客',
    avatarUrl: '',
    avatarDisplayUrl: '',
    phone: '',
    phoneMask: '',
    loginType: 'guest',
    isAdmin: false,
    canEnterAdmin: false,
    isSuperAdmin: false,
    canManageAdmins: false,
    adminRole: 'user',
    permission: {
      openId: '',
      isSuperAdmin: false,
      isAdmin: false,
      isDbAdmin: false,
      canEnterAdmin: false,
      canManageAdmins: false,
      adminRole: 'user'
    },
    isPhoneBound: false,
    isWechatBound: false,
    profileCompleted: false,
    isGuest: true,
    displayName: '游客'
  };
}

function normalizeUser(user) {
  user = user || {};
  var guest = !user.userId;
  var phone = String(user.phone || '').trim();
  var phoneMask = user.phoneMask || maskPhone(phone);
  var nickName = typeof user.nickName === 'string' ? user.nickName.trim() : '';
  var avatarUrl = user.avatarUrl || '';
  var isPhoneBound = typeof user.isPhoneBound === 'boolean' ? user.isPhoneBound : !!phone;
  var isWechatBound = typeof user.isWechatBound === 'boolean'
    ? user.isWechatBound
    : !!(avatarUrl || (nickName && nickName !== '游客') || user.loginType === 'wechat');
  var loginType = user.loginType || (guest ? 'guest' : (isWechatBound ? 'wechat' : 'phone'));
  var displayName = guest
    ? '游客'
    : (isWechatBound ? (nickName || '微信用户') : (phone || phoneMask || '手机号用户'));
  var avatarDisplayUrl = guest ? '' : profile.getDisplayAvatarUrl({ isWechatBound: isWechatBound });
  var rawPermission = user.permission || {};
  var isSuperAdmin = !!(user.isSuperAdmin || rawPermission.isSuperAdmin);
  var isAdmin = typeof user.isAdmin === 'boolean' ? !!user.isAdmin : !!(rawPermission.isAdmin || rawPermission.isDbAdmin);
  var canEnterAdmin = typeof user.canEnterAdmin === 'boolean'
    ? !!user.canEnterAdmin
    : !!(rawPermission.canEnterAdmin || isSuperAdmin || isAdmin);
  var canManageAdmins = !!(user.canManageAdmins || rawPermission.canManageAdmins || isSuperAdmin);
  var adminRole = user.adminRole || rawPermission.adminRole || (isSuperAdmin ? 'super_admin' : (canEnterAdmin ? 'admin' : 'user'));
  var permission = {
    openId: rawPermission.openId || (guest ? '' : String(user.userId || '')),
    isSuperAdmin: isSuperAdmin,
    isAdmin: isAdmin,
    isDbAdmin: !!(rawPermission.isDbAdmin || isAdmin),
    canEnterAdmin: canEnterAdmin,
    canManageAdmins: canManageAdmins,
    adminRole: adminRole
  };

  return {
    userId: guest ? '' : String(user.userId || ''),
    nickName: guest ? '游客' : nickName,
    avatarUrl: avatarUrl,
    avatarDisplayUrl: avatarDisplayUrl,
    phone: phone,
    phoneMask: phoneMask,
    loginType: loginType,
    isAdmin: isAdmin,
    canEnterAdmin: canEnterAdmin,
    isSuperAdmin: isSuperAdmin,
    canManageAdmins: canManageAdmins,
    adminRole: adminRole,
    permission: permission,
    isPhoneBound: isPhoneBound,
    isWechatBound: isWechatBound,
    profileCompleted: !!user.profileCompleted,
    isGuest: guest,
    displayName: displayName,
    unionId: user.unionId || ''
  };
}

function getUser() {
  try {
    var user = wx.getStorageSync(KEY_USER) || null;
    return normalizeUser(user);
  } catch (e) {
    return buildGuestUser();
  }
}

function setUser(user) {
  try {
    wx.setStorageSync(KEY_USER, normalizeUser(user));
  } catch (e) {}
}

function clearUser() {
  try {
    wx.removeStorageSync(KEY_USER);
  } catch (e) {}
}

function isGuest(user) {
  return !normalizeUser(user).userId;
}

function getBookings() {
  try { return wx.getStorageSync(KEY_BOOKINGS) || []; } catch (e) { return []; }
}

function setBookings(list) {
  try { wx.setStorageSync(KEY_BOOKINGS, list || []); } catch (e) {}
}

module.exports = {
  getUser: getUser,
  setUser: setUser,
  clearUser: clearUser,
  getBookings: getBookings,
  setBookings: setBookings,
  maskPhone: maskPhone,
  buildGuestUser: buildGuestUser,
  normalizeUser: normalizeUser,
  isGuest: isGuest
};
