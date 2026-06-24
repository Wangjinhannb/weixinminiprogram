var uiFont = require("../../utils/ui_font");
var bookingApi = require("../../utils/bookingApi");
var dateUtil = require("../../utils/date");
var storage = require("../../utils/storage");
var userSession = require('../../utils/userSession');
var activityNotice = require('../../utils/activityNotice');

function buildSegments() {
  var arr = [];
  for (var h = 8; h < 22; h++) {
    var hh = h < 10 ? ('0' + h) : ('' + h);
    arr.push(hh + ':00');
    arr.push(hh + ':30');
  }
  return arr;
}
function toMin(t) { var p = String(t || '').split(':'); return Number(p[0] || 0) * 60 + Number(p[1] || 0); }
function isOverlap(a1, a2, b1, b2) { return toMin(a1) < toMin(b2) && toMin(a2) > toMin(b1); }
function buildRoomTags(venue) {
  var tags = [];
  venue = venue || {};
  if (venue.capacity) tags.push('约' + venue.capacity + '人');
  var features = Array.isArray(venue.features) ? venue.features : [];
  for (var i = 0; i < features.length && tags.length < 5; i++) {
    if (features[i]) tags.push(features[i]);
  }
  if (!tags.length && venue.location) tags.push(venue.location);
  return tags;
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

function isCloudFileID(url) {
  return String(url || '').indexOf('cloud://') === 0;
}

function isDisplayableImageUrl(url) {
  url = String(url || '').trim();
  return !!url && !isCloudFileID(url);
}

function normalizeDisplayImageUrls(list) {
  var images = normalizeImages(list);
  var out = [];
  for (var i = 0; i < images.length; i++) {
    if (isDisplayableImageUrl(images[i])) out.push(images[i]);
  }
  return out;
}

function resolveCloudImageUrls(images) {
  images = normalizeImages(images);
  if (!images.length) return Promise.resolve([]);
  if (!wx.cloud || !wx.cloud.getTempFileURL) return Promise.resolve(normalizeDisplayImageUrls(images));

  var result = images.slice();
  var cloudFiles = [];
  var cloudIndexes = [];
  for (var i = 0; i < images.length; i++) {
    if (isCloudFileID(images[i])) {
      cloudFiles.push(images[i]);
      cloudIndexes.push(i);
    }
  }
  if (!cloudFiles.length) return Promise.resolve(result);

  return new Promise(function (resolve) {
    wx.cloud.getTempFileURL({
      fileList: cloudFiles,
      success: function (res) {
        var list = (res && res.fileList) || [];
        for (var i = 0; i < list.length; i++) {
          var item = list[i] || {};
          var targetIndex = cloudIndexes[i];
          if (targetIndex == null) continue;
          result[targetIndex] = item.tempFileURL || item.download_url || item.fileID || result[targetIndex];
        }
        resolve(normalizeDisplayImageUrls(result));
      },
      fail: function () {
        resolve(normalizeDisplayImageUrls(result));
      }
    });
  });
}

function mapVenueToRoom(venue) {
  venue = venue || {};
  var imageList = normalizeImages(venue.images && venue.images.length ? venue.images : (venue.imageUrls || venue.photos || venue.pictures || []));
  var displayUrls = normalizeDisplayImageUrls(venue.imageUrls || []);
  if (!displayUrls.length) displayUrls = normalizeDisplayImageUrls(imageList);
  return {
    id: venue._id || venue.venueId || venue.id,
    venueId: venue.venueId || venue.id || '',
    name: venue.name || '未命名场室',
    tags: buildRoomTags(venue),
    desc: venue.description || venue.bookingNotice || '暂无场室说明',
    bookingNotice: venue.bookingNotice || '',
    location: venue.location || '',
    capacity: venue.capacity || 0,
    images: imageList,
    imageUrls: displayUrls,
    enabled: venue.enabled !== false,
    visible: venue.visible !== false,
    deleted: !!venue.deleted,
    canBook: !!venue.canBook,
    isBooked: false,
    hasPartialBooking: false,
    statusText: venue.enabled === false ? '不可预约' : '可预约',
    statusClass: venue.enabled === false ? 'badge-paused' : '',
    actionText: venue.enabled === false ? '不可预约' : '去预约'
  };
}

Page({
  data: {
    uiFontSizePx: 16,
    uiFontMin: 14,
    uiFontMax: 22,
    activeIndex: 0,
    rooms: [],
    loading: false,
    emptyText: '',
    homeActivityNotice: activityNotice.emptyNotice(),
    homeActivityNotices: [],
    homeActivityNoticeLoading: false
  },

  onShow: function () {
    var that = this;
    var app = getApp();
    var px = (app && app.globalData && app.globalData.uiFontSizePx) ? app.globalData.uiFontSizePx : uiFont.getFontSizePx();
    this.setData({ uiFontSizePx: px });
    var tb = this.getTabBar && this.getTabBar();
    if (tb) {
      if (tb.setSelectedByPath) tb.setSelectedByPath("/pages/home/home");
      if (tb.syncFont) tb.syncFont();
    }
    this.loadHomeActivityNotice();
    var currentUser = storage.getUser();
    userSession.refreshCurrentUser({ user: currentUser, silent: true }).then(function(syncRes) {
      if (syncRes && syncRes.adminChanged) {
        wx.showToast({ title: syncRes.user && syncRes.user.canEnterAdmin ? '管理员权限已更新' : '管理员权限已变更', icon: 'none' });
      }
    }).catch(function(err) {
      console.error('首页静默同步用户失败', err);
    }).finally(function() {
      that.loadVenues();
    });
  },

  loadHomeActivityNotice: function () {
    var that = this;
    this.setData({ homeActivityNoticeLoading: true });
    activityNotice.getNotice().then(function (notice) {
      var normalized = activityNotice.normalizeNoticeGroup(notice);
      that.setData({
        homeActivityNotice: normalized,
        homeActivityNotices: normalized.list || [],
        activityNotice: normalized
      });
    }).catch(function () {
      that.setData({
        homeActivityNotice: activityNotice.emptyNotice(),
        homeActivityNotices: []
      });
    }).finally(function () {
      that.setData({ homeActivityNoticeLoading: false });
    });
  },

  onHomeActivityPreview: function (e) {
    var url = e.currentTarget.dataset.url || '';
    if (!url) return;
    var list = this.data.homeActivityNotices || [];
    var urls = [];
    for (var i = 0; i < list.length; i++) {
      var itemUrl = list[i].displayImageUrl || '';
      if (itemUrl) urls.push(itemUrl);
    }
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },

  onHomeActivityOpenLink: function (e) {
    var index = Number(e.currentTarget.dataset.index || 0);
    var notice = (this.data.homeActivityNotices || [])[index] || this.data.homeActivityNotice || {};
    var app = getApp();
    if (app && app.openActivityDetail) app.openActivityDetail(notice.id || notice._id || '', notice.linkUrl || '');
    else if (app && app.openActivityNoticeLink) app.openActivityNoticeLink(notice.linkUrl || '');
  },

  loadVenues: function () {
    var that = this;
    var oldRooms = this.data.rooms || [];
    var oldRoom = oldRooms[this.data.activeIndex] || null;
    var selectedVenueId = oldRoom ? oldRoom.venueId : '';
    this.setData({ loading: true, emptyText: '' });
    bookingApi.getAvailableVenues().then(function (venues) {
      venues = venues || [];
      var rooms = [];
      for (var i = 0; i < venues.length; i++) {
        if (venues[i] && venues[i].enabled === false) continue;
        rooms.push(mapVenueToRoom(venues[i]));
      }
      var nextIndex = 0;
      var removedSelected = false;
      if (selectedVenueId) {
        nextIndex = -1;
        for (var j = 0; j < rooms.length; j++) {
          if (rooms[j].venueId === selectedVenueId) { nextIndex = j; break; }
        }
        if (nextIndex < 0) {
          removedSelected = true;
          nextIndex = 0;
        }
      }
      that.setData({
        rooms: rooms,
        activeIndex: rooms.length ? nextIndex : 0,
        emptyText: rooms.length ? '' : '当前暂无可展示场室'
      });
      if (removedSelected) {
        wx.showToast({ title: '当前选中场室已下线', icon: 'none' });
      }
      that.resolveRoomImageUrls(rooms);
      that.checkVenueBookings();
    }).catch(function () {
      that.setData({ rooms: [], activeIndex: 0, emptyText: '加载场室失败' });
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  resolveRoomImageUrls: function (rooms) {
    var that = this;
    rooms = rooms || [];
    if (!rooms.length) return;
    var tasks = rooms.map(function (room) {
      if (room && room.imageUrls && room.imageUrls.length) return Promise.resolve(normalizeDisplayImageUrls(room.imageUrls));
      return resolveCloudImageUrls(room.images || []);
    });
    Promise.all(tasks).then(function (list) {
      var latest = that.data.rooms || [];
      for (var i = 0; i < latest.length; i++) {
        if (!latest[i]) continue;
        var source = rooms[i] || {};
        if (source.venueId && latest[i].venueId !== source.venueId) continue;
        latest[i].imageUrls = list[i] || [];
      }
      that.setData({ rooms: latest });
    });
  },

  checkVenueBookings: function () {
    var that = this;
    var today = dateUtil.fmtDate(new Date());
    var slots = buildSegments();
    var rooms = this.data.rooms || [];
    if (!rooms.length) {
      that.setData({ rooms: [] });
      return;
    }
    var tasks = [];
    for (var i = 0; i < rooms.length; i++) {
      (function (room) {
        if (!room.enabled) {
          room.isBooked = false;
          room.hasPartialBooking = false;
          room.statusText = '不可预约';
          room.statusClass = 'badge-paused';
          room.actionText = '不可预约';
          tasks.push(Promise.resolve());
          return;
        }
        tasks.push(bookingApi.listVenueDayBookings(room.venueId, today, false).then(function (bookings) {
          var fullyBooked = true;
          for (var s = 0; s < slots.length - 1; s++) {
            var covered = false;
            for (var j = 0; j < bookings.length; j++) {
              var b = bookings[j];
              if (!bookingApi.isOccupyingStatus(b.status)) continue;
              if (isOverlap(slots[s], slots[s + 1], b.startTime, b.endTime)) { covered = true; break; }
            }
            if (!covered) { fullyBooked = false; break; }
          }
          room.isBooked = fullyBooked;
          room.hasPartialBooking = bookings.length > 0;
          room.statusText = fullyBooked ? '今日约满' : '可预约';
          room.statusClass = fullyBooked ? 'badge-booked' : '';
          room.actionText = '去预约';
        }).catch(function () {
          room.isBooked = false;
          room.hasPartialBooking = false;
          room.statusText = '可预约';
          room.statusClass = '';
          room.actionText = '去预约';
        }));
      })(rooms[i]);
    }
    Promise.all(tasks).then(function () {
      var latest = that.data.rooms || [];
      var imageMap = {};
      for (var i = 0; i < latest.length; i++) {
        if (latest[i] && latest[i].venueId) imageMap[latest[i].venueId] = latest[i].imageUrls || [];
      }
      for (var j = 0; j < rooms.length; j++) {
        if (rooms[j] && rooms[j].venueId && imageMap[rooms[j].venueId]) rooms[j].imageUrls = imageMap[rooms[j].venueId];
      }
      that.setData({ rooms: rooms });
    });
  },

  onTagTap: function (e) { this.setData({ activeIndex: Number(e.currentTarget.dataset.index || 0) }); },
  onSwiperChange: function (e) { this.setData({ activeIndex: e.detail.current }); },
  onRoomImageError: function (e) {
    var roomIndex = Number(e.currentTarget.dataset.roomIndex || 0);
    var failedUrl = e.currentTarget.dataset.url || '';
    var rooms = this.data.rooms || [];
    var room = rooms[roomIndex];
    if (!room || !room.imageUrls || !room.imageUrls.length) return;
    var nextUrls = [];
    for (var i = 0; i < room.imageUrls.length; i++) {
      if (room.imageUrls[i] && room.imageUrls[i] !== failedUrl) nextUrls.push(room.imageUrls[i]);
    }
    room.imageUrls = nextUrls;
    this.setData({ rooms: rooms });
  },
  onFontChanging: function (e) {
    var px = Number(e.detail.value || 16);
    this.setData({ uiFontSizePx: px });
    var app = getApp();
    if (app && app.globalData) app.globalData.uiFontSizePx = px;
    var tb = this.getTabBar && this.getTabBar();
    if (tb && tb.syncFont) tb.syncFont(px);
  },
  onFontChange: function (e) {
    var px = uiFont.setFontSizePx(Number(e.detail.value || 16));
    var app = getApp();
    if (app && app.globalData) app.globalData.uiFontSizePx = px;
    this.setData({ uiFontSizePx: px });
    var tb = this.getTabBar && this.getTabBar();
    if (tb && tb.syncFont) tb.syncFont(px);
  },
  goBookCurrent: function () {
    var user = storage.getUser();
    if (!user || user.nickName === '游客') {
      wx.showModal({ title: '请先登录', content: '需要先进行实名登录，才能预约场室哦', confirmText: '去登录', success: function (res) { if (res.confirm) wx.switchTab({ url: '/pages/my/my' }); } });
      return;
    }
    var app = getApp();
    var room = this.data.rooms[this.data.activeIndex];
    if (!room) {
      wx.showToast({ title: '当前暂无可展示场室', icon: 'none' });
      return;
    }
    if (room.enabled && room.isBooked) {
      wx.showToast({ title: '该场室今日时段已满', icon: 'none' });
      return;
    }
    if (app && app.globalData) app.globalData.prefVenueId = room.venueId || '';
    wx.switchTab({ url: "/pages/book/book" });
  }
});
