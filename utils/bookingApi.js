var cfg = require('./config').CONFIG;
var timeUtil = require('./time');
var OCCUPY_STATUS_MAP = { active: true, pending: true, approved: true, rescheduled: true };

function callCloud(name, data) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        var result = res && res.result ? res.result : {};
        if (result.code === 200) resolve(result.data);
        else reject(new Error(result.message || '服务异常'));
      },
      fail: function (err) { reject(err); }
    });
  });
}

function normalizeTimeSlot(item) {
  item = item || {};
  if (!item.start || !item.end) return null;
  var slot = timeUtil.normalizeTimeSlot(item, { keepSeconds: true });
  if (!slot) return null;
  return {
    start: slot.start,
    end: slot.end,
    label: slot.label,
    maxPeopleLimit: slot.maxPeopleLimit || 0,
    startDateTime: item.startDateTime || '',
    endDateTime: item.endDateTime || '',
    dateTimeLabel: item.dateTimeLabel || ''
  };
}

function normalizeDateOverrides(list) {
  list = timeUtil.normalizeDateOverrides(list || [], { keepSeconds: true });
  var out = [];
  for (var i = 0; i < list.length; i++) {
    out.push({
      date: list[i].date,
      timeSlots: (list[i].timeSlots || []).map(function (slot) {
        return {
          start: slot.start,
          end: slot.end,
          label: slot.label,
          maxPeopleLimit: slot.maxPeopleLimit || 0,
          startDateTime: slot.startDateTime || '',
          endDateTime: slot.endDateTime || '',
          dateTimeLabel: slot.dateTimeLabel || ''
        };
      })
    });
  }
  return out;
}

function normalizeImages(list) {
  if (typeof list === 'string') {
    var text = list.trim();
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) list = parsed;
      else list = [text];
    } catch (e) {
      list = text.split(/[\n,，;]/);
    }
  }
  if (!Array.isArray(list)) return [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var raw = list[i];
    if (raw && typeof raw === 'object') raw = raw.fileID || raw.fileId || raw.url || raw.src || raw.path || raw.tempFileURL || '';
    var item = String(raw || '').trim();
    if (item) out.push(item);
  }
  return out;
}

function normalizeVenue(item) {
  if (!item) return null;
  var out = {};
  for (var k in item) out[k] = item[k];
  out.id = out.id || out.venueId || '';
  out.venueId = out.venueId || out.id || '';
  out.name = out.name || '未命名场室';
  out.visible = out.visible !== false;
  out.enabled = out.enabled !== false;
  out.deleted = !!out.deleted;
  out.maxPeopleLimit = timeUtil.normalizeMaxPeopleLimit(out.maxPeopleLimit || (out.bookingTimeConfig && out.bookingTimeConfig.maxPeopleLimit));
  out.canBook = out.visible && out.enabled && !out.deleted;
  out.statusText = out.deleted ? '已删除' : (out.enabled ? '可预约' : '不可预约');
  out.statusTip = out.deleted ? '该场室已删除' : (out.enabled ? '' : '该场室当前不可预约');
  out.features = Array.isArray(out.features) ? out.features : [];
  out.imageUrls = normalizeImages(out.imageUrls || []);
  out.images = normalizeImages(out.images && out.images.length ? out.images : (out.imageUrls || out.photos || out.pictures || []));
  out.timeSlots = timeUtil.getVenueDefaultTimeSlots(out, { keepSeconds: true }).map(function (slot) {
    return {
      start: slot.start,
      end: slot.end,
      label: slot.label,
      maxPeopleLimit: slot.maxPeopleLimit || 0
    };
  });
  out.dateOverrides = normalizeDateOverrides((out.bookingTimeConfig && out.bookingTimeConfig.dateOverrides) || out.dateOverrides || []);
  out.bookingTimeConfig = {
    defaultSlots: out.timeSlots,
    dateOverrides: out.dateOverrides,
    maxPeopleLimit: out.maxPeopleLimit
  };
  out.openRanges = timeUtil.mergeTimeSlotsToRanges(out.timeSlots);
  return out;
}

function normalizeBooking(item) {
  if (!item) return null;
  var out = {};
  for (var k in item) out[k] = item[k];
  out.id = out.id || out._id || '';
  out.form = out.form || {};
  out.userProfile = out.userProfile || {};
  out.bookingOwner = out.bookingOwner || {};
  out.venueName = out.venueName || ((out.venueSnapshot && out.venueSnapshot.name) ? out.venueSnapshot.name : '已预约场室');
  out.timeLabel = out.timeLabel || ((out.startTime || '') + '-' + (out.endTime || ''));
  out.peopleCount = Number(out.peopleCount || (out.form && out.form.people) || 0) || 0;
  out.maxPeopleLimitSnapshot = Number(out.maxPeopleLimitSnapshot || 0) || 0;
  out.remainingPeopleLimit = out.maxPeopleLimitSnapshot > 0 ? Math.max(out.maxPeopleLimitSnapshot - out.peopleCount, 0) : 0;
  out.rescheduleHistory = Array.isArray(out.rescheduleHistory) ? out.rescheduleHistory : [];
  return out;
}

function normalizeAdminUser(item) {
  if (!item) return null;
  var out = {};
  for (var k in item) out[k] = item[k];
  out.userId = out.userId || '';
  out.nickName = out.nickName || '微信用户';
  out.phone = out.phone || '';
  out.phoneMask = out.phoneMask || out.phone || '';
  out.isAdmin = !!out.isAdmin;
  out.canEnterAdmin = !!out.canEnterAdmin;
  out.isSuperAdmin = !!out.isSuperAdmin;
  out.canManageAdmins = !!out.canManageAdmins;
  out.adminRole = out.adminRole || (out.isSuperAdmin ? 'super_admin' : (out.canEnterAdmin ? 'admin' : 'user'));
  out.roleText = out.isSuperAdmin ? '超级管理员' : (out.canEnterAdmin ? '普通管理员' : '普通用户');
  return out;
}

function getAvailableVenues() {
  return callCloud('getAvailableVenues', {}).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var venue = normalizeVenue(list[i]);
      if (venue && venue.enabled !== false) out.push(venue);
    }
    return out;
  });
}

function listVenues() { return getAvailableVenues(); }

function getAdminVenues() {
  return callCloud('getAdminVenues', {}).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(normalizeVenue(list[i]));
    return out;
  });
}

function saveVenue(payload) { return callCloud('saveVenue', payload).then(normalizeVenue); }
function toggleVenueStatus(venueId, enabled) { return callCloud('toggleVenueStatus', { venueId: venueId, enabled: enabled }).then(normalizeVenue); }
function toggleVenueVisible(venueId, visible) { return callCloud('toggleVenueVisible', { venueId: venueId, visible: visible }).then(normalizeVenue); }
function deleteVenue(venueId) { return callCloud('deleteVenue', { venueId: venueId }).then(normalizeVenue); }
function initVenueData() { return callCloud('initVenueData', {}); }

function getBooking(id) {
  return callCloud('getBookingDetail', { bookingId: id }).then(normalizeBooking);
}

function listVenueDayBookings(venueId, date, includeCancelled) {
  return callCloud('getVenueDayBookings', {
    venueId: venueId,
    date: date,
    includeCancelled: !!includeCancelled
  }).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(normalizeBooking(list[i]));
    return out;
  });
}

function listMyBookings() {
  return callCloud('getMyBookings', {}).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(normalizeBooking(list[i]));
    return out;
  });
}

function listAdminBookings(params) {
  return callCloud('getAdminBookings', params || {}).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(normalizeBooking(list[i]));
    return out;
  });
}

function getBookingSummary(params) {
  return callCloud('getBookingSummary', params || {}).then(function (list) {
    list = list || [];
    return list.map(function (item) {
      item = item || {};
      item.currentPeople = Number(item.currentPeople || item.peopleCount || 0) || 0;
      item.maxPeopleLimit = Number(item.maxPeopleLimit || 0) || 0;
      item.remainingPeople = Number(item.remainingPeople || 0) || 0;
      item.isFull = !!item.isFull;
      item.occupied = !!item.occupied;
      return item;
    });
  });
}

function listAdminUsers(keyword) {
  return callCloud('getAdminUsers', { keyword: keyword || '' }).then(function (list) {
    list = list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(normalizeAdminUser(list[i]));
    return out;
  });
}

function setUserAdminPermission(userId, canEnterAdmin) {
  return callCloud('setUserAdminPermission', {
    userId: userId,
    canEnterAdmin: !!canEnterAdmin
  }).then(normalizeAdminUser);
}

function createBooking(payload) { return callCloud('createBooking', payload).then(normalizeBooking); }
function updateBooking(payload) { return callCloud('updateBooking', payload).then(normalizeBooking); }
function cancelBooking(id, reason) { return callCloud('cancelBooking', { bookingId: id, reason: reason || '' }).then(normalizeBooking); }
function updateBookingStatus(id, status) { return callCloud('updateBookingStatus', { bookingId: id, status: status }).then(normalizeBooking); }

function getSubscriptionStatus(bookingId, userId) {
  return new Promise(function (resolve, reject) {
    wx.cloud.database().collection('booking_subscriptions').where({
      bookingId: bookingId,
      userId: userId,
      enabled: true
    }).get().then(function (res) {
      var item = (res.data || [])[0] || null;
      resolve({ enabled: !!item, detail: item });
    }).catch(reject);
  });
}

function batchGetSubscriptionStatus(bookingIds, userId) {
  bookingIds = bookingIds || [];
  if (!bookingIds.length) return Promise.resolve({});
  var tasks = [];
  for (var i = 0; i < bookingIds.length; i++) {
    (function (bookingId) {
      tasks.push(getSubscriptionStatus(bookingId, userId).then(function (res) {
        return { bookingId: bookingId, enabled: !!res.enabled };
      }).catch(function () {
        return { bookingId: bookingId, enabled: false };
      }));
    })(bookingIds[i]);
  }
  return Promise.all(tasks).then(function (rows) {
    var map = {};
    for (var j = 0; j < rows.length; j++) map[rows[j].bookingId] = rows[j].enabled;
    return map;
  });
}

function saveSubscription(params) {
  return callCloud('saveSubscription', params || {});
}

function notifyBookingSubscribers(params) {
  return callCloud('notifyBookingSubscribers', params || {});
}

function cancelSubscription(bookingId) {
  return callCloud('saveSubscription', { bookingId: bookingId, enabled: false });
}

function isOccupyingStatus(status) { return !!OCCUPY_STATUS_MAP[status || '']; }

module.exports = {
  listVenues: listVenues,
  getAvailableVenues: getAvailableVenues,
  getAdminVenues: getAdminVenues,
  saveVenue: saveVenue,
  toggleVenueStatus: toggleVenueStatus,
  toggleVenueVisible: toggleVenueVisible,
  deleteVenue: deleteVenue,
  initVenueData: initVenueData,
  getBooking: getBooking,
  listVenueDayBookings: listVenueDayBookings,
  listMyBookings: listMyBookings,
  listAdminBookings: listAdminBookings,
  getBookingSummary: getBookingSummary,
  listAdminUsers: listAdminUsers,
  setUserAdminPermission: setUserAdminPermission,
  createBooking: createBooking,
  updateBooking: updateBooking,
  cancelBooking: cancelBooking,
  updateBookingStatus: updateBookingStatus,
  getSubscriptionStatus: getSubscriptionStatus,
  batchGetSubscriptionStatus: batchGetSubscriptionStatus,
  saveSubscription: saveSubscription,
  notifyBookingSubscribers: notifyBookingSubscribers,
  cancelSubscription: cancelSubscription,
  isOccupyingStatus: isOccupyingStatus
};
