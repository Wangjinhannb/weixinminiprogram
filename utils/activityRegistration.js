function callCloud(name, data) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('当前环境暂不支持云函数'));
      return;
    }
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

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function pad2(n) {
  n = Number(n || 0) || 0;
  return n < 10 ? '0' + n : '' + n;
}

function formatDateTime(value) {
  if (!value) return '';
  var d = null;
  if (value instanceof Date) d = value;
  else if (typeof value === 'string' || typeof value === 'number') d = new Date(value);
  else if (value.$date) d = new Date(value.$date);
  if (!d || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function normalizeStatus(value) {
  return trim(value || 'submitted').toLowerCase();
}

function normalizeHasChild(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  var text = trim(value).toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes' || text === 'y' || text === '是' || text === '有' || text === '带' || text === '带小孩') return true;
  return false;
}

function hasChildText(value) {
  return normalizeHasChild(value) ? '带小孩' : '不带小孩';
}

function isCancelledStatus(status) {
  status = normalizeStatus(status);
  return status === 'cancelled' || status === 'canceled' || status === 'cancel' || status === 'rejected';
}

function normalizeRegistration(item) {
  item = item || {};
  var out = {};
  for (var key in item) out[key] = item[key];
  out.id = trim(out.id || out._id);
  out.activityId = trim(out.activityId);
  out.activityTitle = trim(out.activityTitle || (out.activitySnapshot && out.activitySnapshot.title)) || '未命名活动';
  out.participantName = trim(out.participantName || out.name || out.contactName);
  out.phone = trim(out.phone);
  out.peopleCount = Number(out.peopleCount || out.people || 0) || 0;
  out.hasChild = normalizeHasChild(out.hasChild || out.withChild || out.bringChild);
  out.hasChildText = trim(out.hasChildText) || hasChildText(out.hasChild);
  out.status = normalizeStatus(out.status || 'submitted');
  out.userProfile = out.userProfile || {};
  out.createdAtText = out.createdAtText || formatDateTime(out.createdAt);
  out.updatedAtText = out.updatedAtText || formatDateTime(out.updatedAt);
  return out;
}

function normalizeRegistrationList(list) {
  list = list || [];
  var out = [];
  for (var i = 0; i < list.length; i++) out.push(normalizeRegistration(list[i]));
  return out;
}

function submitRegistration(payload) {
  payload = payload || {};
  return callCloud('submitActivityRegistration', {
    activityId: trim(payload.activityId),
    participantName: trim(payload.participantName || payload.name || payload.contactName),
    phone: trim(payload.phone),
    peopleCount: Number(payload.peopleCount || payload.people || 0) || 0,
    hasChild: !!payload.hasChild,
    userProfile: payload.userProfile || {}
  }).then(normalizeRegistration);
}

function cancelRegistration(payload) {
  payload = payload || {};
  return callCloud('cancelActivityRegistration', {
    registrationId: trim(payload.registrationId || payload.id || payload._id),
    activityId: trim(payload.activityId)
  }).then(normalizeRegistration);
}

function listMyRegistrations(params) {
  params = params || {};
  return callCloud('getMyActivityRegistrations', {
    activityId: trim(params.activityId || params.id || params._id),
    includeCancelled: !!params.includeCancelled
  }).then(normalizeRegistrationList);
}

function listAdminRegistrations(params) {
  return callCloud('getAdminActivityRegistrations', params || {}).then(normalizeRegistrationList);
}

module.exports = {
  submitRegistration: submitRegistration,
  cancelRegistration: cancelRegistration,
  listMyRegistrations: listMyRegistrations,
  listAdminRegistrations: listAdminRegistrations,
  normalizeRegistration: normalizeRegistration,
  formatDateTime: formatDateTime,
  isCancelledStatus: isCancelledStatus,
  normalizeHasChild: normalizeHasChild,
  hasChildText: hasChildText
};
