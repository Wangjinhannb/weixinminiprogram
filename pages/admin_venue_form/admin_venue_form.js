var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var dateUtil = require('../../utils/date');
var timeUtil = require('../../utils/time');

function cloneSlot(slot) {
  slot = slot || {};
  return {
    start: slot.start || '',
    end: slot.end || '',
    label: slot.label || ((slot.start && slot.end) ? timeUtil.buildTimeLabel(slot.start, slot.end, true) : ''),
    maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(slot.maxPeopleLimit || slot.maxBookingCount),
    startDateTime: slot.startDateTime || '',
    endDateTime: slot.endDateTime || '',
    dateTimeLabel: slot.dateTimeLabel || ''
  };
}

function cloneDateOverride(item) {
  item = item || {};
  return {
    date: item.date || '',
    timeSlots: (item.timeSlots || []).map(cloneSlot)
  };
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

function getFileExt(filePath) {
  filePath = String(filePath || '').split('?')[0];
  var matched = filePath.match(/(\.[a-zA-Z0-9]+)$/);
  return matched && matched[1] ? matched[1].toLowerCase() : '.jpg';
}

function blankForm() {
  return {
    _id: '',
    venueId: '',
    name: '',
    description: '',
    location: '',
    capacity: '',
    visible: true,
    enabled: true,
    deleted: false,
    sort: 10,
    bookingNotice: '',
    images: [],
    imageUrls: [],
    imagesChanged: false,
    featuresText: '',
    maxPeopleLimit: '',
    timeSlots: [cloneSlot({ start: '09:00:00', end: '10:00:00' })],
    dateOverrides: []
  };
}

function toFormSlots(list, date) {
  list = timeUtil.normalizeTimeSlots(list || [], { keepSeconds: true });
  return list.map(function (slot) {
    return {
      start: slot.start,
      end: slot.end,
      label: slot.label,
      maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(slot.maxPeopleLimit),
      startDateTime: slot.startDateTime || (date ? timeUtil.buildDateTimeText(date, slot.start) : ''),
      endDateTime: slot.endDateTime || (date ? timeUtil.buildDateTimeText(date, slot.end) : ''),
      dateTimeLabel: slot.dateTimeLabel || (date ? timeUtil.buildDateTimeRangeLabel(date, slot.start, slot.end) : '')
    };
  });
}

function toFormDateOverrides(list) {
  list = timeUtil.normalizeDateOverrides(list || [], { keepSeconds: true });
  return list.map(function (item) {
    return {
      date: item.date,
      timeSlots: toFormSlots(item.timeSlots || [], item.date)
    };
  });
}

function parseFeatures(text) {
  var result = [];
  var source = String(text || '').split(/[、,，\n]/);
  for (var i = 0; i < source.length; i++) {
    var item = (source[i] || '').trim();
    if (item) result.push(item);
  }
  return result;
}

function getNextAvailableOverrideDate(list, startDate) {
  var used = {};
  list = Array.isArray(list) ? list : [];
  for (var i = 0; i < list.length; i++) used[list[i].date] = true;
  var base = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  if (isNaN(base.getTime())) base = new Date();
  for (var d = 0; d < 366; d++) {
    var current = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
    var text = dateUtil.fmtDate(current);
    if (!used[text]) return text;
  }
  return dateUtil.fmtDate(new Date());
}

function getSuggestedSlot(list) {
  list = timeUtil.normalizeTimeSlots(list || [], { keepSeconds: true });
  if (!list.length) return { start: '09:00:00', end: '10:00:00', maxPeopleLimit: 0 };
  var last = list[list.length - 1];
  var startSec = last.endSec;
  var endSec = startSec + 3600;
  if (startSec >= 23 * 3600 + 59 * 60) return { start: '22:00:00', end: '23:00:00', maxPeopleLimit: 0 };
  if (endSec > 24 * 3600 - 1) endSec = 24 * 3600 - 1;
  if (endSec <= startSec) endSec = Math.min(startSec + 60, 24 * 3600 - 1);
  return {
    start: timeUtil.secondsToTime(startSec, true),
    end: timeUtil.secondsToTime(endSec, true),
    maxPeopleLimit: 0
  };
}

Page({
  data: {
    uiFontSizePx: 16,
    loading: false,
    saving: false,
    venueId: '',
    allVenues: [],
    form: blankForm(),
    isEdit: false,
    errorText: '',
    saveDisabled: false,
    saveDisabledText: '',
    dateStart: '',
    dateEnd: '',
    timePickerHourOptions: [],
    timePickerMinuteOptions: [],
    timePickerSecondOptions: [],
    timeModalVisible: false,
    timeModalTitle: '',
    timeModalScope: 'default',
    timeModalOverrideIndex: -1,
    timeModalSlotIndex: -1,
    timeModalStartPickerValue: [9, 0, 0],
    timeModalEndPickerValue: [10, 0, 0],
    timeModalStartTime: '09:00:00',
    timeModalEndTime: '10:00:00',
    timeModalPreviewText: '09:00:00-10:00:00',
    timeModalErrorText: '',
    timeModalCanSave: true,
    timeModalCurrentLimit: 0,
    uploadingImages: false
  },

  onLoad: function (options) {
    options = options || {};
    var picker = timeUtil.buildFixedTimePickerOptions();
    this.setData({
      uiFontSizePx: getApp().globalData.uiFontSizePx || 16,
      venueId: options.id || '',
      dateStart: dateUtil.fmtDate(new Date()),
      dateEnd: '2099-12-31',
      timePickerHourOptions: picker.hourOptions,
      timePickerMinuteOptions: picker.minuteOptions,
      timePickerSecondOptions: picker.secondOptions
    });
    this.loadVenues();
  },

  loadVenues: function () {
    var that = this;
    this.setData({ loading: true, errorText: '' });
    bookingApi.getAdminVenues().then(function (list) {
      list = list || [];
      var form = blankForm();
      var isEdit = false;
      if (that.data.venueId) {
        for (var i = 0; i < list.length; i++) {
          var itemId = list[i]._id || list[i].id || list[i].venueId || '';
          if (itemId === that.data.venueId || list[i]._id === that.data.venueId || list[i].venueId === that.data.venueId || list[i].id === that.data.venueId) {
            var imageList = normalizeImages(list[i].images);
            if (!imageList.length) imageList = normalizeImages(list[i].imageUrls || list[i].photos || list[i].pictures || []);
            form = {
              _id: list[i]._id,
              venueId: list[i].venueId,
              name: list[i].name || '',
              description: list[i].description || '',
              location: list[i].location || '',
              capacity: list[i].capacity != null ? String(list[i].capacity) : '',
              visible: list[i].visible !== false,
              enabled: list[i].enabled !== false,
              deleted: !!list[i].deleted,
              sort: list[i].sort != null ? list[i].sort : 10,
              bookingNotice: list[i].bookingNotice || '',
              images: imageList,
              imageUrls: [],
              imagesChanged: false,
              featuresText: (list[i].features || []).join('、'),
              maxPeopleLimit: list[i].maxPeopleLimit != null && list[i].maxPeopleLimit !== 0 ? String(list[i].maxPeopleLimit) : '',
              timeSlots: toFormSlots(list[i].timeSlots || []),
              dateOverrides: toFormDateOverrides((list[i].bookingTimeConfig && list[i].bookingTimeConfig.dateOverrides) || list[i].dateOverrides || [])
            };
            if (!form.timeSlots.length) form.timeSlots = [];
            isEdit = true;
            break;
          }
        }
      }
      that.setData({ allVenues: list, form: form, isEdit: isEdit });
      that.refreshFormImageUrls();
      that.refreshFormValidation();
    }).catch(function (e) {
      that.setData({ errorText: (e && e.message) || '加载场室失败' });
      ui.toast((e && e.message) || '加载场室失败');
    }).finally(function () { that.setData({ loading: false }); });
  },

  refreshFormImageUrls: function () {
    var that = this;
    var images = normalizeImages((this.data.form && this.data.form.images) || []);
    if (!images.length) {
      this.setData({ 'form.imageUrls': [] });
      return;
    }
    resolveCloudImageUrls(images).then(function (urls) {
      var current = normalizeImages((that.data.form && that.data.form.images) || []);
      if (current.join('|') !== images.join('|')) return;
      that.setData({ 'form.imageUrls': urls || [] });
    });
  },

  refreshFormValidation: function () {
    var message = '';
    try {
      this.buildPayload();
    } catch (err) {
      message = err.message || '表单校验失败';
    }
    this.setData({
      saveDisabled: !!message,
      saveDisabledText: message
    });
  },

  updateField: function (key, value) {
    var obj = {};
    obj['form.' + key] = value;
    this.setData(obj);
    this.refreshFormValidation();
  },
  onNameInput: function (e) { this.updateField('name', (e.detail.value || '').trim()); },
  onDescriptionInput: function (e) { this.updateField('description', (e.detail.value || '').trim()); },
  onLocationInput: function (e) { this.updateField('location', (e.detail.value || '').trim()); },
  onCapacityInput: function (e) { this.updateField('capacity', (e.detail.value || '').trim()); },
  onSortInput: function (e) { this.updateField('sort', Number(e.detail.value || 0)); },
  onNoticeInput: function (e) { this.updateField('bookingNotice', (e.detail.value || '').trim()); },
  onFeaturesInput: function (e) { this.updateField('featuresText', (e.detail.value || '').trim()); },
  onMaxPeopleLimitInput: function (e) { this.updateField('maxPeopleLimit', (e.detail.value || '').trim()); },
  onVisibleChange: function (e) { this.updateField('visible', !!e.detail.value); },
  onEnabledChange: function (e) { this.updateField('enabled', !!e.detail.value); },
  noop: function () {},


  chooseVenueImages: function () {
    var that = this;
    if (this.data.uploadingImages) return;
    var choosePromise = new Promise(function (resolve, reject) {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 9,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: function (res) {
            var files = (res.tempFiles || []).map(function (item) { return item.tempFilePath || item.path || ''; }).filter(function (item) { return !!item; });
            resolve(files);
          },
          fail: reject
        });
      } else {
        wx.chooseImage({
          count: 9,
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: function (res) { resolve(res.tempFilePaths || []); },
          fail: reject
        });
      }
    });
    choosePromise.then(function (paths) {
      paths = paths || [];
      if (!paths.length) return;
      that.uploadVenueImages(paths);
    }).catch(function (err) {
      var msg = (err && (err.errMsg || err.message)) || '';
      if (msg.indexOf('cancel') < 0) ui.toast('选择图片失败');
    });
  },

  uploadVenueImages: function (paths) {
    var that = this;
    paths = paths || [];
    if (!paths.length) return;
    this.setData({ uploadingImages: true });
    ui.loading('上传图片中');
    var f = this.data.form || {};
    var folder = String(f.venueId || f._id || f.name || 'new').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_') || 'new';
    var tasks = paths.map(function (filePath, index) {
      var cloudPath = 'venue-images/' + folder + '/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '_' + index + getFileExt(filePath);
      return new Promise(function (resolve, reject) {
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: function (res) { resolve((res && res.fileID) || ''); },
          fail: reject
        });
      });
    });
    Promise.all(tasks).then(function (fileIDs) {
      var images = normalizeImages((that.data.form && that.data.form.images) || []);
      for (var i = 0; i < fileIDs.length; i++) {
        if (fileIDs[i]) images.push(fileIDs[i]);
      }
      that.setData({ 'form.images': images, 'form.imagesChanged': true });
      that.refreshFormImageUrls();
      that.refreshFormValidation();
      ui.toast('图片上传成功');
    }).catch(function (err) {
      ui.toast((err && err.message) || '图片上传失败');
    }).finally(function () {
      that.setData({ uploadingImages: false });
      ui.hideLoading();
    });
  },

  onPreviewVenueImage: function (e) {
    var current = e.currentTarget.dataset.url || '';
    var urls = normalizeImages((this.data.form && this.data.form.imageUrls) || []);
    if (!current || !urls.length) return;
    wx.previewImage({ current: current, urls: urls });
  },

  onDeleteVenueImage: function (e) {
    var that = this;
    var idx = Number(e.currentTarget.dataset.index || 0);
    var images = normalizeImages((this.data.form && this.data.form.images) || []);
    var fileID = images[idx] || '';
    if (!fileID) return;
    wx.showModal({
      title: '删除场室图片',
      content: '删除后将从当前场室图片列表中移除。确认继续吗？',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        var nextImages = normalizeImages((that.data.form && that.data.form.images) || []);
        nextImages.splice(idx, 1);
        that.setData({ 'form.images': nextImages, 'form.imagesChanged': true });
        that.refreshFormImageUrls();
        that.refreshFormValidation();
      }
    });
  },

  getScopeSlotList: function (scope, overrideIndex) {
    if (scope === 'override') {
      var item = (this.data.form.dateOverrides || [])[overrideIndex] || {};
      return (item.timeSlots || []).map(cloneSlot);
    }
    return (this.data.form.timeSlots || []).map(cloneSlot);
  },

  setScopeSlotList: function (scope, overrideIndex, list) {
    var overrideDate = '';
    if (scope === 'override') {
      var source = (this.data.form.dateOverrides || [])[overrideIndex] || {};
      overrideDate = source.date || '';
    }
    list = toFormSlots(list || [], overrideDate);
    if (scope === 'override') {
      var overrides = (this.data.form.dateOverrides || []).map(cloneDateOverride);
      if (!overrides[overrideIndex]) return;
      overrides[overrideIndex].timeSlots = list;
      this.setData({ 'form.dateOverrides': overrides });
    } else {
      this.setData({ 'form.timeSlots': list });
    }
    this.refreshFormValidation();
  },

  buildTimeModalDraftSlot: function () {
    var start = timeUtil.pickerValueToTime(this.data.timeModalStartPickerValue);
    var end = timeUtil.pickerValueToTime(this.data.timeModalEndPickerValue);
    return {
      start: start,
      end: end,
      label: timeUtil.buildTimeLabel(start, end, true),
      maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(this.data.timeModalCurrentLimit)
    };
  },

  syncTimeModalValidation: function () {
    if (!this.data.timeModalVisible) return;
    var draft = this.buildTimeModalDraftSlot();
    var list = this.getScopeSlotList(this.data.timeModalScope, this.data.timeModalOverrideIndex);
    var index = this.data.timeModalSlotIndex;
    if (index >= 0 && index < list.length) list[index] = draft;
    else list.push(draft);
    var validation = timeUtil.validateTimeSlotsDetailed(list, { keepSeconds: true, allowEmpty: false });
    this.setData({
      timeModalStartTime: draft.start,
      timeModalEndTime: draft.end,
      timeModalPreviewText: draft.label,
      timeModalErrorText: validation.ok ? '' : validation.message,
      timeModalCanSave: !!validation.ok
    });
  },

  openTimeModal: function (options) {
    options = options || {};
    var slot = options.slot || getSuggestedSlot(this.getScopeSlotList(options.scope, options.overrideIndex));
    var startValue = timeUtil.timeToPickerValue(slot.start || '09:00:00');
    var endValue = timeUtil.timeToPickerValue(slot.end || '10:00:00');
    this.setData({
      timeModalVisible: true,
      timeModalTitle: options.title || '编辑时间段',
      timeModalScope: options.scope || 'default',
      timeModalOverrideIndex: typeof options.overrideIndex === 'number' ? options.overrideIndex : -1,
      timeModalSlotIndex: typeof options.slotIndex === 'number' ? options.slotIndex : -1,
      timeModalStartPickerValue: startValue,
      timeModalEndPickerValue: endValue,
      timeModalStartTime: timeUtil.pickerValueToTime(startValue),
      timeModalEndTime: timeUtil.pickerValueToTime(endValue),
      timeModalPreviewText: timeUtil.buildTimeLabel(timeUtil.pickerValueToTime(startValue), timeUtil.pickerValueToTime(endValue), true),
      timeModalErrorText: '',
      timeModalCanSave: true,
      timeModalCurrentLimit: timeUtil.normalizeMaxPeopleLimit(slot.maxPeopleLimit)
    });
    this.syncTimeModalValidation();
  },

  closeTimeModal: function () {
    this.setData({ timeModalVisible: false });
  },

  onTimeModalStartChange: function (e) {
    this.setData({ timeModalStartPickerValue: e.detail.value || [0, 0, 0] });
    this.syncTimeModalValidation();
  },

  onTimeModalEndChange: function (e) {
    this.setData({ timeModalEndPickerValue: e.detail.value || [0, 0, 0] });
    this.syncTimeModalValidation();
  },

  onTimeModalLimitInput: function (e) {
    this.setData({ timeModalCurrentLimit: timeUtil.normalizeMaxPeopleLimit(e.detail.value || 0) });
    this.syncTimeModalValidation();
  },

  onTimeModalSave: function () {
    if (!this.data.timeModalCanSave) return;
    var draft = this.buildTimeModalDraftSlot();
    var list = this.getScopeSlotList(this.data.timeModalScope, this.data.timeModalOverrideIndex);
    var index = this.data.timeModalSlotIndex;
    if (index >= 0 && index < list.length) list[index] = draft;
    else list.push(draft);
    var validation = timeUtil.validateTimeSlotsDetailed(list, { keepSeconds: true, allowEmpty: false });
    if (!validation.ok) return ui.toast(validation.message || '时间段不合法');
    this.setScopeSlotList(this.data.timeModalScope, this.data.timeModalOverrideIndex, validation.list);
    this.closeTimeModal();
  },

  onAddSlot: function () {
    this.openTimeModal({
      scope: 'default',
      title: '新增通用时间段'
    });
  },

  onEditSlot: function (e) {
    var idx = Number(e.currentTarget.dataset.index || 0);
    var slot = this.getScopeSlotList('default')[idx] || null;
    if (!slot) return;
    this.openTimeModal({
      scope: 'default',
      slotIndex: idx,
      slot: slot,
      title: '编辑通用时间段'
    });
  },

  onRemoveSlot: function (e) {
    var that = this;
    var idx = Number(e.currentTarget.dataset.index || 0);
    wx.showModal({
      title: '删除通用时间段',
      content: '删除后将立即从通用可预约时段中移除。确认继续吗？',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        var list = that.getScopeSlotList('default');
        list.splice(idx, 1);
        that.setScopeSlotList('default', -1, list);
      }
    });
  },

  onSlotLimitInput: function (e) {
    var idx = Number(e.currentTarget.dataset.index || 0);
    var list = this.getScopeSlotList('default');
    if (!list[idx]) return;
    list[idx].maxPeopleLimit = timeUtil.normalizeMaxPeopleLimit(e.detail.value || 0);
    this.setScopeSlotList('default', -1, list);
  },

  onOverrideSlotLimitInput: function (e) {
    var overrideIndex = Number(e.currentTarget.dataset.overrideIndex || 0);
    var slotIndex = Number(e.currentTarget.dataset.slotIndex || 0);
    var list = this.getScopeSlotList('override', overrideIndex);
    if (!list[slotIndex]) return;
    list[slotIndex].maxPeopleLimit = timeUtil.normalizeMaxPeopleLimit(e.detail.value || 0);
    this.setScopeSlotList('override', overrideIndex, list);
  },

  onAddOverride: function () {
    var overrides = (this.data.form.dateOverrides || []).map(cloneDateOverride);
    overrides.push({
      date: getNextAvailableOverrideDate(overrides, this.data.dateStart),
      timeSlots: []
    });
    overrides.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    this.setData({ 'form.dateOverrides': overrides });
    this.refreshFormValidation();
  },

  onOverrideDateChange: function (e) {
    var idx = Number(e.currentTarget.dataset.index || 0);
    var value = (e.detail.value || '').trim();
    var overrides = (this.data.form.dateOverrides || []).map(cloneDateOverride);
    for (var i = 0; i < overrides.length; i++) {
      if (i !== idx && overrides[i].date === value) {
        ui.toast('同一日期只能配置一组单日时间段');
        return;
      }
    }
    if (!overrides[idx]) return;
    overrides[idx].date = value;
    overrides[idx].timeSlots = toFormSlots(overrides[idx].timeSlots || [], value);
    overrides.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    this.setData({ 'form.dateOverrides': overrides });
    this.refreshFormValidation();
  },

  onDeleteOverride: function (e) {
    var that = this;
    var idx = Number(e.currentTarget.dataset.index || 0);
    wx.showModal({
      title: '删除日期覆盖',
      content: '删除后，该日期将恢复使用通用时间段。确认继续吗？',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        var overrides = (that.data.form.dateOverrides || []).map(cloneDateOverride);
        overrides.splice(idx, 1);
        that.setData({ 'form.dateOverrides': overrides });
        that.refreshFormValidation();
      }
    });
  },

  onAddOverrideSlot: function (e) {
    var idx = Number(e.currentTarget.dataset.index || 0);
    this.openTimeModal({
      scope: 'override',
      overrideIndex: idx,
      title: '新增单日时间段'
    });
  },

  onEditOverrideSlot: function (e) {
    var overrideIndex = Number(e.currentTarget.dataset.overrideIndex || 0);
    var slotIndex = Number(e.currentTarget.dataset.slotIndex || 0);
    var list = this.getScopeSlotList('override', overrideIndex);
    var slot = list[slotIndex] || null;
    if (!slot) return;
    this.openTimeModal({
      scope: 'override',
      overrideIndex: overrideIndex,
      slotIndex: slotIndex,
      slot: slot,
      title: '编辑单日时间段'
    });
  },

  onDeleteOverrideSlot: function (e) {
    var that = this;
    var overrideIndex = Number(e.currentTarget.dataset.overrideIndex || 0);
    var slotIndex = Number(e.currentTarget.dataset.slotIndex || 0);
    var overrides = (this.data.form.dateOverrides || []).map(cloneDateOverride);
    var target = overrides[overrideIndex];
    if (!target) return;
    var isLast = (target.timeSlots || []).length <= 1;
    wx.showModal({
      title: '删除单日时间段',
      content: isLast ? '这是该日期覆盖下的最后一个时间段。删除后将移除该日期覆盖，并恢复使用通用时间段。确认继续吗？' : '删除后该日期覆盖会立即更新。确认继续吗？',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        if (isLast) {
          overrides.splice(overrideIndex, 1);
        } else {
          target.timeSlots.splice(slotIndex, 1);
        }
        that.setData({ 'form.dateOverrides': overrides });
        that.refreshFormValidation();
      }
    });
  },

  buildPayload: function () {
    var f = this.data.form || {};
    if (!f.name) throw new Error('请填写场室名称');
    var timeConfig = timeUtil.validateVenueTimeConfigDetailed(f.timeSlots || [], f.dateOverrides || [], { keepSeconds: true });
    if (!timeConfig.ok) throw new Error(timeConfig.message || '可预约时间配置不合法');
    var payload = {
      _id: f._id || '',
      name: f.name,
      description: f.description,
      location: f.location,
      capacity: Number(f.capacity || 0),
      visible: !!f.visible,
      enabled: !!f.enabled,
      deleted: !!f.deleted,
      sort: Number(f.sort || 0),
      bookingNotice: f.bookingNotice,
      images: normalizeImages(f.images),
      imagesChanged: !!f.imagesChanged,
      features: parseFeatures(f.featuresText),
      maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(f.maxPeopleLimit),
      timeSlots: timeConfig.defaultSlots.map(function (slot) {
        return {
          start: slot.start,
          end: slot.end,
          label: slot.label,
          maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(slot.maxPeopleLimit)
        };
      }),
      dateOverrides: (timeConfig.dateOverrides || []).map(function (item) {
        return {
          date: item.date,
          timeSlots: (item.timeSlots || []).map(function (slot) {
            return {
              start: slot.start,
              end: slot.end,
              label: slot.label,
              maxPeopleLimit: timeUtil.normalizeMaxPeopleLimit(slot.maxPeopleLimit),
              startDateTime: slot.startDateTime || timeUtil.buildDateTimeText(item.date, slot.start),
              endDateTime: slot.endDateTime || timeUtil.buildDateTimeText(item.date, slot.end),
              dateTimeLabel: slot.dateTimeLabel || timeUtil.buildDateTimeRangeLabel(item.date, slot.start, slot.end)
            };
          })
        };
      })
    };
    payload.bookingTimeConfig = {
      defaultSlots: payload.timeSlots,
      dateOverrides: payload.dateOverrides,
      maxPeopleLimit: payload.maxPeopleLimit
    };
    if (f.venueId) payload.venueId = f.venueId;
    return payload;
  },

  onSave: function () {
    var that = this;
    var payload;
    try { payload = this.buildPayload(); } catch (err) { ui.toast(err.message || '表单校验失败'); return; }
    this.setData({ saving: true });
    ui.loading(this.data.isEdit ? '保存中' : '新增中');
    bookingApi.saveVenue(payload).then(function () {
      ui.toast(that.data.isEdit ? '保存成功' : '新增成功');
      setTimeout(function () { wx.navigateBack({ delta: 1 }); }, 600);
    }).catch(function (err) {
      ui.toast((err && err.message) || '保存失败');
    }).finally(function () {
      that.setData({ saving: false });
      ui.hideLoading();
    });
  }
});
