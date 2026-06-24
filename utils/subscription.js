var timeUtil = require('./time');

var DEFAULT_TEMPLATE_CONFIG_MAP = {
  bookingSuccess: {
    id: 'RKgIUQZMAg0lOxqhA_pXSBfeg9ESR9-Ceatl5nueBjM',
    page: 'pages/booking_detail/booking_detail?id={{bookingId}}',
    fields: [
      { key: 'name1', source: 'contactName', maxLength: 10 },
          { key: 'thing2', source: 'venueName', maxLength: 20 },
          { key: 'date3', source: 'bookingStartText', maxLength: 32 },
          { key: 'phone_number4', source: 'contactPhone', maxLength: 11 },
          { key: 'thing13', source: 'bookingItem', maxLength: 20, fallback: '场室预约' }
    ]
  },
  bookingReminder: {
    id: 'RKgIUQZMAg0lOxqhA_pXSBfeg9ESR9-Ceatl5nueBjM',
    page: 'pages/booking_detail/booking_detail?id={{bookingId}}',
    fields: [
      { key: 'thing2', source: 'reminderContent', maxLength: 20, fallback: '您预约的活动即将开始' },
          { key: 'date3', source: 'bookingStartText', maxLength: 32 },
          { key: 'date5', source: 'reminderAtText', maxLength: 32 },
          { key: 'thing6', source: 'venueName', maxLength: 20 }
    ]
  }
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function pad2(v) {
  v = Number(v || 0);
  return v < 10 ? '0' + v : '' + v;
}

function trimTime(value) {
  value = String(value || '').trim();
  if (!value) return '';
  var normalized = timeUtil.normalizeTimeString ? timeUtil.normalizeTimeString(value, true) : value;
  if (!normalized) normalized = value;
  return normalized.slice(0, 5);
}

function buildDateTimeMs(date, time) {
  date = String(date || '').trim();
  time = trimTime(time);
  if (!date || !time) return NaN;
  var text = date + 'T' + time + ':00+08:00';
  return new Date(text).getTime();
}

function formatChinaDateTime(ms) {
  ms = Number(ms);
  if (!isFinite(ms) || ms <= 0) return '';
  var china = new Date(ms + 8 * 60 * 60 * 1000);
  return china.getUTCFullYear() + '-' + pad2(china.getUTCMonth() + 1) + '-' + pad2(china.getUTCDate())
    + ' ' + pad2(china.getUTCHours()) + ':' + pad2(china.getUTCMinutes());
}

function formatLeadText(minutes) {
  minutes = Number(minutes || 0);
  if (!isFinite(minutes) || minutes <= 0) return '';
  var hour = Math.floor(minutes / 60);
  var minute = minutes % 60;
  var parts = [];
  if (hour > 0) parts.push(hour + '小时');
  if (minute > 0) parts.push(minute + '分钟');
  return parts.join('') || '0分钟';
}

function getTemplateConfigMap() {
  var app = null;
  try { app = getApp && getApp(); } catch (e) {}
  var map = app && app.globalData && app.globalData.subscribeMessageTemplates;
  if (!map || typeof map !== 'object') map = DEFAULT_TEMPLATE_CONFIG_MAP;
  return deepClone(map);
}

function getRequestTemplateIds() {
  var map = getTemplateConfigMap();
  var keys = Object.keys(map || {});
  var ids = [];
  var seen = {};
  for (var i = 0; i < keys.length; i++) {
    var id = String((map[keys[i]] && map[keys[i]].id) || '').trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    ids.push(id);
  }
  if (!ids.length) {
    var app = null;
    try { app = getApp && getApp(); } catch (e2) {}
    var fallbackIds = (app && app.globalData && app.globalData.subscribeTemplateIds) || [];
    for (var j = 0; j < fallbackIds.length; j++) {
      var item = String(fallbackIds[j] || '').trim();
      if (!item || seen[item]) continue;
      seen[item] = true;
      ids.push(item);
    }
  }
  return ids;
}

function isPlaceholderTemplateId(id) {
  id = String(id || '').trim();
  return !id || /^TEMPLATE_ID_/i.test(id);
}

function isTemplateConfigReady() {
  var ids = getRequestTemplateIds();
  if (!ids.length) return false;
  for (var i = 0; i < ids.length; i++) {
    if (!isPlaceholderTemplateId(ids[i])) return true;
  }
  return false;
}

function hasAcceptedTemplate(acceptResultMap) {
  acceptResultMap = acceptResultMap || {};
  var ids = Object.keys(acceptResultMap);
  for (var i = 0; i < ids.length; i++) {
    if (acceptResultMap[ids[i]] === 'accept') return true;
  }
  return false;
}

function getMaxLeadMinutes(booking) {
  booking = booking || {};
  var bookingStartMs = buildDateTimeMs(booking.date, booking.startTime);
  if (!isFinite(bookingStartMs) || bookingStartMs <= 0) return 0;
  var now = Date.now();
  var diffMinutes = Math.floor((bookingStartMs - now) / 60000) - 1;
  if (!isFinite(diffMinutes) || diffMinutes <= 0) return 0;
  return Math.max(0, Math.min(23 * 60 + 59, diffMinutes));
}

function getDefaultLeadMinutes(booking) {
  var maxLead = getMaxLeadMinutes(booking);
  if (maxLead <= 0) return 0;
  if (maxLead >= 30) return 30;
  if (maxLead >= 15) return 15;
  if (maxLead >= 10) return 10;
  if (maxLead >= 5) return 5;
  return maxLead;
}

module.exports = {
  getTemplateConfigMap: getTemplateConfigMap,
  getRequestTemplateIds: getRequestTemplateIds,
  isTemplateConfigReady: isTemplateConfigReady,
  hasAcceptedTemplate: hasAcceptedTemplate,
  isPlaceholderTemplateId: isPlaceholderTemplateId,
  buildDateTimeMs: buildDateTimeMs,
  formatChinaDateTime: formatChinaDateTime,
  formatLeadText: formatLeadText,
  getMaxLeadMinutes: getMaxLeadMinutes,
  getDefaultLeadMinutes: getDefaultLeadMinutes,
  trimTime: trimTime
};
