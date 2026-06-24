var statusText = require('../../utils/ui').statusText;
var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var userSession = require('../../utils/userSession');
var dateUtil = require('../../utils/date');
var excel = require('../../utils/excel');
var activityRegistration = require('../../utils/activityRegistration');

var BOOKED_STATUS = ['active', 'pending', 'approved', 'rescheduled'];
var CANCELLED_STATUS = ['cancelled', 'rejected'];
var BOOKED_LIMIT = 500;
var CANCELLED_LIMIT = 100;

function sortByTime(a, b) {
  var at = new Date((a.date || '') + ' ' + (a.startTime || '00:00')).getTime();
  var bt = new Date((b.date || '') + ' ' + (b.startTime || '00:00')).getTime();
  return bt - at;
}

function padSerial(n) {
  n = Number(n || 0) || 0;
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return String(n);
}

function normalizeActivityRegistrationList(list) {
  list = list || [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var item = activityRegistration.normalizeRegistration(list[i]);
    if (activityRegistration.isCancelledStatus && activityRegistration.isCancelledStatus(item.status)) continue;
    item.displayNo = padSerial(out.length + 1);
    item.createdAtText = item.createdAtText || activityRegistration.formatDateTime(item.createdAt);
    item.updatedAtText = item.updatedAtText || activityRegistration.formatDateTime(item.updatedAt);
    item.userName = (item.userProfile && item.userProfile.nickName) || '微信用户';
    item.participantName = item.participantName || item.userName;
    item.hasChildText = item.hasChildText || (item.hasChild ? '带小孩' : '不带小孩');
    out.push(item);
  }
  return out;
}

function buildVenueMap(venues) {
  var map = {};
  venues = venues || [];
  for (var i = 0; i < venues.length; i++) {
    var venue = venues[i] || {};
    var id = venue.venueId || venue.id || '';
    if (!id) continue;
    map[id] = venue;
  }
  return map;
}

function cloneBooking(item) {
  var out = {};
  item = item || {};
  for (var key in item) out[key] = item[key];
  return out;
}

function normalizeAdminList(list, limit, venueMap) {
  list = list || [];
  venueMap = venueMap || {};
  var filtered = [];
  for (var i = 0; i < list.length; i++) {
    var item = cloneBooking(list[i]);
    var venueId = item.venueId || (item.venueSnapshot && item.venueSnapshot.venueId) || '';
    var venue = venueMap[venueId];
    if (!venue) continue;
    item.venueName = venue.name || item.venueName || '未命名场室';
    item.venueSnapshot = item.venueSnapshot || {};
    item.venueSnapshot.name = item.venueName;
    filtered.push(item);
  }
  filtered.sort(sortByTime);
  if (limit > 0) filtered = filtered.slice(0, limit);
  for (var j = 0; j < filtered.length; j++) {
    filtered[j].statusLabel = statusText(filtered[j].status);
    filtered[j].detailTime = (filtered[j].date || '') + ' ' + (filtered[j].timeLabel || ((filtered[j].startTime || '') + '-' + (filtered[j].endTime || '')));
    filtered[j].displayNo = padSerial(j + 1);
  }
  return filtered;
}

function normalizeSummaryList(list, venueMap) {
  list = list || [];
  venueMap = venueMap || {};
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var item = {};
    var source = list[i] || {};
    for (var key in source) item[key] = source[key];
    var venueId = item.venueId || '';
    var venue = venueMap[venueId];
    if (!venue) continue;
    item.venueName = venue.name || item.venueName || '未命名场室';
    out.push(item);
  }
  out.sort(sortSummary);
  return out;
}

function getOwnerName(item) {
  item = item || {};
  var owner = item.bookingOwner || {};
  var profile = item.userProfile || {};
  return owner.contactName || profile.nickName || '';
}

function getOwnerPhone(item) {
  item = item || {};
  var owner = item.bookingOwner || {};
  return owner.phone || '';
}

function getPeopleText(item) {
  item = item || {};
  var owner = item.bookingOwner || {};
  return item.peopleCount || owner.people || '';
}

function buildExportRows(list) {
  var rows = [[
    '编号', '场室', '状态', '日期', '开始时间', '结束时间', '时间段',
    '预约人', '手机号', '人数', '身份证号', '备注', '微信昵称', '用户ID', '预约ID'
  ]];
  list = list || [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var owner = item.bookingOwner || {};
    var profile = item.userProfile || {};
    rows.push([
      item.displayNo || padSerial(i + 1),
      item.venueName || '',
      item.statusLabel || statusText(item.status),
      item.date || '',
      item.startTime || '',
      item.endTime || '',
      item.timeLabel || ((item.startTime || '') + '-' + (item.endTime || '')),
      getOwnerName(item),
      getOwnerPhone(item),
      getPeopleText(item),
      owner.idCard || '',
      owner.note || '',
      profile.nickName || owner.nickName || '',
      owner.userId || item.userId || '',
      item.id || item._id || ''
    ]);
  }
  return rows;
}

function buildExportFileName(selectedVenueName, dateText, useDateFilter) {
  var now = new Date();
  var p = function (n) { return n < 10 ? '0' + n : '' + n; };
  var stamp = now.getFullYear() + p(now.getMonth() + 1) + p(now.getDate()) + '_' + p(now.getHours()) + p(now.getMinutes());
  var venue = selectedVenueName && selectedVenueName !== '全部场室' ? selectedVenueName : '全部场室';
  var date = useDateFilter && dateText ? dateText : '全部日期';
  return '已预约_' + venue + '_' + date + '_' + stamp;
}

function sortSummary(a, b) {
  var av = [(a.date || ''), (a.venueName || ''), (a.startTime || ''), (a.endTime || '')].join('|');
  var bv = [(b.date || ''), (b.venueName || ''), (b.startTime || ''), (b.endTime || '')].join('|');
  return av.localeCompare(bv);
}

Page({
  data: {
    statusText: statusText,
    uiFontSizePx: 16,
    user: null,
    venues: [],
    venueNames: ['全部场室'],
    venueIndex: 0,
    currentVenue: null,
    selectedVenueName: '全部场室',
    date: '',
    dateStart: '',
    dateEnd: '',
    useDateFilter: false,
    list: [],
    bookedList: [],
    cancelledList: [],
    summaryList: [],
    activityRegistrationList: [],
    activityRegistrationLoading: false,
    activityRegistrationError: '',
    loading: false,
    loadError: '',
    summaryError: '',
    venueMap: {}
  },

  onShow: function () {
    var that = this;
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb && tb.syncFont) tb.syncFont();
    } catch (e) {}

    var user = storage.getUser() || null;
    var localCanEnterAdmin = !!(user && user.canEnterAdmin);
    this.setData({ user: user });

    if (localCanEnterAdmin) {
      this.loadVenuesAndRefresh();
    }

    userSession.refreshCurrentUser({ user: user, silent: true }).then(function(syncRes){
      var latestUser = syncRes && syncRes.user ? syncRes.user : (storage.getUser() || null);
      var latestCanEnterAdmin = !!(latestUser && latestUser.canEnterAdmin);
      that.setData({ user: latestUser });

      if (!latestCanEnterAdmin) {
        that.setData({
          list: [],
          bookedList: [],
          cancelledList: [],
          summaryList: [],
          activityRegistrationList: [],
          loading: false,
          activityRegistrationLoading: false,
          loadError: '',
          summaryError: '',
          activityRegistrationError: ''
        });
        if (!localCanEnterAdmin) ui.toast('当前账号暂无管理员权限');
        return;
      }

      if (!localCanEnterAdmin || (syncRes && syncRes.adminChanged)) {
        that.loadVenuesAndRefresh();
      }
    }).catch(function(err){
      console.error('管理员页静默同步用户失败', err);
      var fallbackUser = storage.getUser() || user || null;
      that.setData({ user: fallbackUser });
      if (!fallbackUser || !fallbackUser.canEnterAdmin) {
        that.setData({
          list: [],
          bookedList: [],
          cancelledList: [],
          summaryList: [],
          activityRegistrationList: [],
          loading: false,
          activityRegistrationLoading: false
        });
        return;
      }
      if (!localCanEnterAdmin) that.loadVenuesAndRefresh();
    });
  },

  onLoad: function () {
    var today = dateUtil.fmtDate(new Date());
    this.setData({ date: today, dateStart: today, dateEnd: '2099-12-31' });
  },

  goMy: function () { wx.switchTab({ url: '/pages/my/my' }); },
  goVenueManage: function () { wx.navigateTo({ url: '/pages/admin_venues/admin_venues' }); },
  goActivityManage: function () { wx.navigateTo({ url: '/pages/admin_activities/admin_activities' }); },
  goAdminUsers: function () {
    var user = storage.getUser() || {};
    if (!user || !user.canManageAdmins) return ui.toast('仅超级管理员可管理管理员权限');
    wx.navigateTo({ url: '/pages/admin_users/admin_users' });
  },


  loadVenuesAndRefresh: function () {
    var that = this;
    this.refreshActivityRegistrations();
    bookingApi.getAdminVenues().then(function (venues) {
      venues = venues || [];
      var selectable = [];
      var names = ['全部场室'];
      for (var i = 0; i < venues.length; i++) {
        if (venues[i].deleted || venues[i].visible === false) continue;
        selectable.push(venues[i]);
        names.push(venues[i].name);
      }
      that.setData({ venues: selectable, venueNames: names, venueIndex: 0, currentVenue: null, selectedVenueName: '全部场室', venueMap: buildVenueMap(selectable) });
      that.refreshList();
    }).catch(function (e) {
      that.setData({ list: [], bookedList: [], cancelledList: [], summaryList: [], loadError: (e && e.message) || '加载场室失败', summaryError: '' });
      ui.toast((e && e.message) || '加载失败');
    });
  },

  onVenueChange: function (e) {
    var idx = Number(e.detail.value || 0);
    var venue = idx > 0 ? (this.data.venues || [])[idx - 1] || null : null;
    this.setData({ venueIndex: idx, currentVenue: venue, selectedVenueName: this.data.venueNames[idx] || '全部场室' });
    this.refreshList();
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value || '' });
    if (this.data.useDateFilter) this.refreshList();
  },

  onToggleDateFilter: function () {
    var next = !this.data.useDateFilter;
    this.setData({ useDateFilter: next });
    this.refreshList();
  },

  refreshList: function () {
    var that = this;
    var u = this.data.user;
    if (!u || !u.canEnterAdmin) {
      this.setData({ list: [], bookedList: [], cancelledList: [], summaryList: [], loadError: '当前账号暂无管理员权限', summaryError: '' });
      return;
    }
    var params = {};
    if (this.data.currentVenue && (this.data.currentVenue.id || this.data.currentVenue.venueId)) params.venueId = this.data.currentVenue.id || this.data.currentVenue.venueId;
    if (this.data.useDateFilter && this.data.date) params.date = this.data.date;

    var bookedParams = Object.assign({}, params, { status: BOOKED_STATUS, limit: BOOKED_LIMIT, order: 'desc' });
    var cancelledParams = Object.assign({}, params, { status: CANCELLED_STATUS, limit: CANCELLED_LIMIT, order: 'desc' });

    that.setData({ loading: true, loadError: '', summaryError: '' });
    Promise.all([
      bookingApi.listAdminBookings(bookedParams),
      bookingApi.listAdminBookings(cancelledParams),
      bookingApi.getBookingSummary(params)
    ]).then(function (res) {
      var venueMap = that.data.venueMap || buildVenueMap(that.data.venues || []);
      var bookedList = normalizeAdminList(res[0] || [], BOOKED_LIMIT, venueMap);
      var cancelledList = normalizeAdminList(res[1] || [], CANCELLED_LIMIT, venueMap);
      var summaryList = normalizeSummaryList(res[2] || [], venueMap);
      that.setData({
        list: bookedList.concat(cancelledList),
        bookedList: bookedList,
        cancelledList: cancelledList,
        summaryList: summaryList,
        loadError: '',
        summaryError: ''
      });
    }).catch(function (e) {
      that.setData({ list: [], bookedList: [], cancelledList: [], summaryList: [], loadError: (e && e.message) || '加载失败', summaryError: '' });
      ui.toast((e && e.message) || '加载失败');
    }).finally(function () { that.setData({ loading: false }); });
  },


  refreshActivityRegistrations: function () {
    var that = this;
    var u = this.data.user;
    if (!u || !u.canEnterAdmin) {
      this.setData({ activityRegistrationList: [], activityRegistrationError: '当前账号暂无管理员权限' });
      return;
    }
    this.setData({ activityRegistrationLoading: true, activityRegistrationError: '' });
    activityRegistration.listAdminRegistrations({ limit: 500, order: 'desc' }).then(function (list) {
      that.setData({
        activityRegistrationList: normalizeActivityRegistrationList(list),
        activityRegistrationError: ''
      });
    }).catch(function (err) {
      console.error('加载活动报名信息失败', err);
      that.setData({
        activityRegistrationList: [],
        activityRegistrationError: (err && err.message) || '加载活动报名信息失败'
      });
    }).finally(function () {
      that.setData({ activityRegistrationLoading: false });
    });
  },

  onRefreshActivityRegistrations: function () {
    this.refreshActivityRegistrations();
  },

  onExportBooked: function () {
    var list = this.data.bookedList || [];
    if (!list.length) return ui.toast('暂无可导出数据');
    try {
      var filePath = excel.writeXlsxFile({
        fileName: buildExportFileName(this.data.selectedVenueName, this.data.date, this.data.useDateFilter),
        sheetName: '已预约',
        rows: buildExportRows(list)
      });
      wx.openDocument({
        filePath: filePath,
        fileType: 'xlsx',
        showMenu: true,
        fail: function () { ui.toast('文件已生成，打开失败'); }
      });
    } catch (err) {
      console.error('导出已预约 Excel 失败', err);
      ui.toast((err && err.message) || '导出失败');
    }
  },

  onDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return ui.toast('缺少预约ID');
    wx.navigateTo({ url: '/pages/admin_booking_detail/admin_booking_detail?id=' + encodeURIComponent(id) });
  }
});
