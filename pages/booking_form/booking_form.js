var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var dateUtil = require('../../utils/date');
var timeUtil = require('../../utils/time');
var subscriptionUtil = require('../../utils/subscription');

var NOTICE_PARAS = [
  '海龙街道文化站活动场地管理制度',
  '为维护街道文化站活动场地正常使用秩序，保障公众人身安全和使用权益，提高活动场地使用效率，满足辖区居民群众的精神文化需求，特制定本制度。',
  '第一章 总则',
  '第一条 本规定适用于海龙街道文化站（含各分站）所有对公众开放的活动室、功能区、展厅、报告厅、户外广场等文化活动场地（本规定统称“活动场地”）。',
  '第二条 活动场地管理遵循“公益优先、公平有序、共建共享、服务公众”的原则。',
  '第二章 管理职责',
  '第三条 海龙街道党群服务中心是活动场地的管理单位，指定工作人员对活动场地进行管理，主要职责包括：',
  '一、组织活动场所日常开放，维护活动场所设备正常运行；',
  '二、受理活动场地使用申请，统筹安排团队专属活动时间；',
  '三、监督活动场地团队及个人使用情况，确保活动内容健康、合法；',
  '四、处理活动场地使用过程中的突发事件。',
  '第三章 场地使用预约与审批',
  '第四条 场地主要用于开展公益性文化活动，优先保障街道、社区组织的培训讲座、陈列展览等公益性文体活动。',
  '第五条 政府机关、企事业单位、社会组织（本规定统称“团队”）需专属时段使用活动场地，应提前向文化站提出书面或线上预约申请，说明活动内容、使用时间段、人数、现场负责人、安全员、特殊布展需求等信息。',
  '第六条 文化站根据活动性质、规模和时间安排，对申请进行审批，并在2个工作日内予以答复。对存在时间冲突等情形，将及时与申请方协调对接，统筹安排团队专属活动时间，尽量满足各申请方合理需求。对可能存在安全风险、活动内容涉及意识形态或不健康娱乐等情形的申请，保留拒绝申请使用活动场地的权利。',
  '第七条 经批准的活动场地使用计划，如需要保障上级安排的临时性重要活动或其他不可抗力因素，文化站将提前通知申请方，保留调整使用计划的权利。',
  '第八条 申请方取消活动场地使用计划，应当提前1个工作日告知文化站。每一自然年内未按计划使用且未事先告知达两次者，将取消其当年活动场地使用资格；累计两个自然年（连续或非连续均可）均出现以上情形，则将该申请方列入黑名单，永久取消其活动场地使用资格。',
  '第四章 场地使用要求',
  '第九条 使用活动场地的团队、个人应服从工作人员现场管理及调度。',
  '第十条 使用活动场地的团队、个人应自觉爱护场地内的设施设备、文体器材等公共财物，禁止在墙面、地面、设备上乱涂乱画、乱贴乱挂。如需外接设备、特殊布展等需求，应在申请使用活动场地时一并提出，经同意后方可实施。如有公共财物损坏，须照价赔偿或按原状修复到位。活动结束后，团队应将活动场地恢复原状，团队和个人均应当清理因自身产生的各类垃圾杂物。',
  '第十一条 请团队、个人自行妥善保管活动用品、随身物品。文化站工作人员没有保管上述物品的责任与义务。如有上述物品遗失，文化站工作人员可协助调查，但不负上述物品遗失的责任。',
  '第十二条 严禁携带易燃、易爆、易腐蚀及有毒有害等危险物品进入活动场地。活动场地室内严禁吸烟、严禁用火。',
  '第五章 安全与应急',
  '第十三条 团队须指定安全员，配合文化站工作人员做好安全管理工作。如遇火灾、地震等紧急突发情况，须服从文化站工作人员指引，按照应急预案有序撤离。',
  '第十四条 未成年人、老年人等特殊人群使用活动场地，应有团队负责人、未成年人监护人或其他安全责任人员位活动现场承担其活动期间的人身、财产等安全责任。',
  '第六章 附则',
  '第十五条 对于违反本规定的团队、个人，文化站工作人员有权予以劝阻、警告；情节严重的，有权责令其立即停止活动、清理出场，并视情况限制其今后使用场地的资格；造成损失的，依法追究其赔偿责任。',
  '第十六条 本规定由海龙街道党群服务中心负责解释。'
];

function findById(list, id) {
  for (var i = 0; i < list.length; i++) {
    if ((list[i].id || list[i].venueId) === id) return list[i];
  }
  return null;
}

function sameDayOrAfter(a, b) {
  return String(a || '') >= String(b || '');
}

function normalizePositiveInt(value) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function formatLimitText(limit) {
  limit = normalizePositiveInt(limit);
  return limit > 0 ? (limit + ' 人') : '不限';
}

function buildFallbackVenue(booking) {
  booking = booking || {};
  var snapshot = booking.venueSnapshot || {};
  return {
    id: booking.venueId,
    venueId: booking.venueId,
    name: booking.venueName || snapshot.name || '历史场室',
    location: snapshot.location || '',
    description: snapshot.description || '',
    bookingNotice: snapshot.bookingNotice || '',
    enabled: true,
    visible: true,
    deleted: false,
    maxPeopleLimit: snapshot.maxPeopleLimit || 0,
    timeSlots: snapshot.timeSlots || [],
    dateOverrides: snapshot.dateOverrides || (snapshot.bookingTimeConfig && snapshot.bookingTimeConfig.dateOverrides) || [],
    bookingTimeConfig: snapshot.bookingTimeConfig || null,
    features: snapshot.features || [],
    capacity: snapshot.capacity || 0
  };
}

function getApplicableMaxPeopleLimit(venue, date, startTime, endTime) {
  if (!venue || !startTime || !endTime) return 0;
  var startSec = timeUtil.timeToSeconds(startTime);
  var endSec = timeUtil.timeToSeconds(endTime);
  if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) return 0;
  var slots = timeUtil.getEffectiveTimeSlots(venue, date, { keepSeconds: true }) || [];
  var matched = [];
  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i] || {};
    if (startSec < slot.endSec && endSec > slot.startSec) {
      var slotLimit = normalizePositiveInt(slot.maxPeopleLimit);
      if (slotLimit > 0) matched.push(slotLimit);
    }
  }
  if (matched.length) return Math.min.apply(null, matched);
  return normalizePositiveInt(venue.maxPeopleLimit);
}

function buildOccupiedText(item) {
  var parts = [item.timeLabel || timeUtil.buildTimeLabel(item.startTime, item.endTime)];
  if (item.peopleCount || item.maxPeopleLimitSnapshot) {
    parts.push('已报 ' + (item.peopleCount || 0) + ' / 上限 ' + formatLimitText(item.maxPeopleLimitSnapshot));
  }
  return parts.join('（') + (parts.length > 1 ? '）' : '');
}

Page({
  data: {
    uiFontSizePx: 16,
    venueId: '',
    date: '',
    dateStart: '',
    dateEnd: '',
    venue: null,
    allVenueOptions: [],
    venueNames: [],
    venueIndex: 0,
    openRangeTextList: [],
    activeTimeRangeSourceText: '',
    startHourOptions: [],
    startMinuteOptions: [],
    startPickerValue: [0, 0],
    endHourOptions: [],
    endMinuteOptions: [],
    endPickerValue: [0, 0],
    startTime: '',
    endTime: '',
    occupiedList: [],
    occupiedTextList: [],
    hasConflict: false,
    conflictText: '',
    loadingOccupied: false,
    loadingVenue: false,
    submitDisabled: true,
    submitDisabledText: '',
    form: { name: '', phone: '', people: '', idCard: '', note: '' },
    name: '',
    phone: '',
    people: '',
    idCard: '',
    note: '',
    isEdit: false,
    bookingId: '',
    detailLoaded: false,
    noticeVisible: false,
    noticeParas: NOTICE_PARAS,
    pendingPayload: null,
    formError: '',
    venueUnavailableText: '',
    slotLimitHintText: '',
    currentMaxPeopleLimit: 0,
    reminderModalVisible: false,
    reminderBooking: null,
    reminderDefaultLeadMinutes: 30,
    pendingSubscriptionContext: null,
    subscriptionSaving: false
  },

  onShow: function () {
    var app = getApp();
    this.setData({ uiFontSizePx: (app && app.globalData && app.globalData.uiFontSizePx) || 16 });
    var tb = this.getTabBar && this.getTabBar();
    if (tb && tb.syncFont) tb.syncFont();
    if (this.data.venueId && this.data.date && this.data.venue) this.refreshOccupied();
  },

  onLoad: function (options) {
    options = options || {};
    var today = dateUtil.fmtDate(new Date());
    this.setData({
      venueId: options.venueId || '',
      date: options.date || today,
      dateStart: today,
      dateEnd: '2099-12-31',
      isEdit: options.mode === 'edit' || options.edit === '1',
      bookingId: options.bookingId || options.id || ''
    });
    var currentUser = storage.getUser();
    if (!this.data.isEdit && currentUser && currentUser.userId) {
      var presetName = (currentUser.isWechatBound && currentUser.nickName && currentUser.nickName !== '微信用户') ? currentUser.nickName : '';
      var presetPhone = currentUser.phone || '';
      if (presetName || presetPhone) {
        this.setData({
          'form.name': presetName,
          'form.phone': presetPhone,
          name: presetName,
          phone: presetPhone
        });
      }
    }
    this.loadInitialContext();
  },

  loadInitialContext: function () {
    if (this.data.isEdit && this.data.bookingId) {
      this.loadBookingAndVenueOptions();
      return;
    }
    this.loadVenueOptions(this.data.venueId || '', null);
  },

  loadBookingAndVenueOptions: function () {
    var that = this;
    ui.loading('加载原预约');
    bookingApi.getBooking(this.data.bookingId).then(function (b) {
      if (!b) throw new Error('未找到原预约记录');
      var form = b.form || {};
      var nextForm = {
        name: form.name || '',
        phone: form.phone || '',
        people: form.people != null ? String(form.people) : '',
        idCard: form.idCard || '',
        note: form.note || ''
      };
      that.pendingPreferredStartTime = b.startTime || '';
      that.pendingPreferredEndTime = b.endTime || '';
      that.setData({
        venueId: b.venueId || that.data.venueId,
        date: b.date || that.data.date,
        form: nextForm,
        name: nextForm.name,
        phone: nextForm.phone,
        people: nextForm.people,
        idCard: nextForm.idCard,
        note: nextForm.note,
        detailLoaded: true,
        formError: ''
      });
      return that.loadVenueOptions(b.venueId || that.data.venueId, buildFallbackVenue(b));
    }).catch(function (e) {
      that.setData({ formError: (e && e.message) || '原预约加载失败' });
      ui.toast((e && e.message) || '原预约加载失败');
    }).finally(function () { ui.hideLoading(); });
  },

  loadVenueOptions: function (selectedVenueId, fallbackVenue) {
    var that = this;
    this.setData({ loadingVenue: true, formError: '' });
    return bookingApi.getAvailableVenues().then(function (venues) {
      venues = venues || [];
      if (fallbackVenue) {
        var existing = findById(venues, fallbackVenue.id || fallbackVenue.venueId);
        if (!existing) venues.unshift(fallbackVenue);
      }
      var names = [];
      for (var i = 0; i < venues.length; i++) {
        var suffix = venues[i].capacity ? ('（容量 ' + venues[i].capacity + ' 人）') : '';
        var limitText = normalizePositiveInt(venues[i].maxPeopleLimit) > 0 ? (' · 默认上限 ' + venues[i].maxPeopleLimit + ' 人') : '';
        names.push((venues[i].name || '未命名场室') + suffix + limitText);
      }
      var index = -1;
      if (selectedVenueId) {
        for (var j = 0; j < venues.length; j++) {
          if ((venues[j].id || venues[j].venueId) === selectedVenueId) { index = j; break; }
        }
      }
      var selectedVenue = index >= 0 ? venues[index] : null;
      if (!selectedVenue && venues.length === 1 && !that.data.isEdit) {
        index = 0;
        selectedVenue = venues[0];
      }
      that.setData({
        allVenueOptions: venues,
        venueNames: names,
        venueIndex: index >= 0 ? index : 0
      });
      if (!selectedVenue) {
        that.setVenueData(null);
        if (that.data.venueId) that.setData({ formError: '当前场室已删除、隐藏或不存在' });
        that.refreshSelectionState();
        return null;
      }
      that.setData({ venueId: selectedVenue.id || selectedVenue.venueId });
      that.setVenueData(selectedVenue);
      that.refreshOccupied();
      return null;
    }).catch(function (e) {
      that.setData({ formError: (e && e.message) || '加载场室失败' });
      that.setVenueData(null);
      ui.toast((e && e.message) || '加载场室失败');
    }).finally(function () {
      that.setData({ loadingVenue: false });
    });
  },

  setVenueData: function (venue) {
    venue = venue || null;
    this.setData({
      venue: venue,
      venueUnavailableText: (venue && venue.enabled === false) ? '当前不可预约' : ''
    });
  },

  onVenueChange: function (e) {
    var idx = Number(e.detail.value || 0);
    var venue = (this.data.allVenueOptions || [])[idx] || null;
    this.setData({ venueIndex: idx });
    if (!venue) return;
    this.setData({ venueId: venue.id || venue.venueId, venue: venue, startTime: '', endTime: '' });
    this.setVenueData(venue);
    this.refreshOccupied();
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value || '' });
    this.refreshOccupied();
  },

  buildPastBlockedRange: function () {
    var today = dateUtil.fmtDate(new Date());
    if (this.data.date !== today) return null;
    var now = new Date();
    var nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    var nextMinuteSec = Math.ceil(nowSec / 60) * 60;
    if (nextMinuteSec <= 0) return null;
    if (nextMinuteSec >= 24 * 3600) nextMinuteSec = 24 * 3600 - 1;
    return {
      start: '00:00:00',
      end: timeUtil.secondsToTime(nextMinuteSec, true),
      timeLabel: '今天已过去时间'
    };
  },

  refreshOccupied: function () {
    var that = this;
    if (!this.data.venueId || !this.data.date) {
      this.setData({ occupiedList: [], occupiedTextList: [] });
      this.refreshTimePickerState();
      return;
    }
    this.setData({ loadingOccupied: true });
    bookingApi.listVenueDayBookings(this.data.venueId, this.data.date, false).then(function (list) {
      list = list || [];
      var occupied = [];
      var occupiedTextList = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        if (!bookingApi.isOccupyingStatus(item.status)) continue;
        if (that.data.isEdit && that.data.bookingId && item.id === that.data.bookingId) continue;
        occupied.push({
          id: item.id,
          startTime: item.startTime,
          endTime: item.endTime,
          peopleCount: item.peopleCount || 0,
          maxPeopleLimitSnapshot: item.maxPeopleLimitSnapshot || 0,
          timeLabel: item.timeLabel || timeUtil.buildTimeLabel(item.startTime, item.endTime)
        });
        occupiedTextList.push(buildOccupiedText(item));
      }
      occupied.sort(function (a, b) {
        return timeUtil.timeToMinutes(a.startTime) - timeUtil.timeToMinutes(b.startTime);
      });
      that.setData({ occupiedList: occupied, occupiedTextList: occupiedTextList });
      that.refreshTimePickerState();
    }).catch(function (e) {
      console.error('加载占用时间失败：', e);
      that.setData({ occupiedList: [], occupiedTextList: [] });
      that.refreshTimePickerState();
      ui.toast((e && e.message) || '加载占用时间失败');
    }).finally(function () {
      that.setData({ loadingOccupied: false });
    });
  },

  refreshTimePickerState: function () {
    var preferredStart = this.pendingPreferredStartTime || this.data.startTime || '';
    var preferredEnd = this.pendingPreferredEndTime || this.data.endTime || '';
    this.pendingPreferredStartTime = '';
    this.pendingPreferredEndTime = '';

    var openRanges = timeUtil.getEffectiveOpenRanges(this.data.venue || {}, this.data.date, { keepSeconds: true });
    var occupiedRanges = [];
    for (var i = 0; i < this.data.occupiedList.length; i++) {
      occupiedRanges.push({ start: this.data.occupiedList[i].startTime, end: this.data.occupiedList[i].endTime });
    }
    var pastRange = this.buildPastBlockedRange();
    if (pastRange) occupiedRanges.push({ start: pastRange.start, end: pastRange.end });
    var freeRanges = timeUtil.subtractRanges(openRanges, occupiedRanges);
    this.openRanges = openRanges;
    this.freeRanges = freeRanges;

    var startMinutes = timeUtil.buildMinuteListFromRanges(freeRanges, false);
    var startState = timeUtil.buildPickerState(startMinutes, preferredStart);
    this.startPickerMeta = startState;

    var startTime = startState.selectedTime || '';
    var endMinutes = timeUtil.buildEndMinuteList(freeRanges, startState.selectedMinute);
    var endState = timeUtil.buildPickerState(endMinutes, preferredEnd);
    this.endPickerMeta = endState;

    var hasDateOverride = timeUtil.hasDateOverride(this.data.venue || {}, this.data.date);
    this.setData({
      openRangeTextList: openRanges.map(function (item) { return item.label; }),
      activeTimeRangeSourceText: '',
      startHourOptions: startState.hourOptions,
      startMinuteOptions: startState.minuteOptions,
      startPickerValue: startState.pickerValue,
      startTime: startTime,
      endHourOptions: endState.hourOptions,
      endMinuteOptions: endState.minuteOptions,
      endPickerValue: endState.pickerValue,
      endTime: endState.selectedTime || ''
    });
    this.refreshSelectionState();
  },

  updateEndPickerByStartMinute: function (startMinute, preferredEnd) {
    var endMinutes = timeUtil.buildEndMinuteList(this.freeRanges || [], startMinute);
    var endState = timeUtil.buildPickerState(endMinutes, preferredEnd);
    this.endPickerMeta = endState;
    return endState;
  },

  refreshSelectionState: function () {
    var venue = this.data.venue;
    var openRanges = this.openRanges || [];
    var freeRanges = this.freeRanges || [];
    var startTime = this.data.startTime;
    var endTime = this.data.endTime;
    var conflictText = '';
    var submitDisabledText = '';
    var slotLimitHintText = '';
    var currentMaxPeopleLimit = 0;

    if (!venue) submitDisabledText = '场室信息加载中';
    else if (venue.enabled === false) submitDisabledText = '该场室当前不可预约';
    else if (!this.data.date) submitDisabledText = '请选择预约日期';
    else if (!sameDayOrAfter(this.data.date, this.data.dateStart)) submitDisabledText = '预约日期不能早于今天';
    else if (!openRanges.length) submitDisabledText = '该日期暂无可预约时间配置';
    else if (!freeRanges.length) submitDisabledText = this.buildPastBlockedRange() ? '今天剩余时间已不可预约' : '当前日期已无可预约时间';
    else if (!startTime || !endTime) submitDisabledText = '请选择开始和结束时间';
    else if (!(timeUtil.timeToMinutes(endTime) > timeUtil.timeToMinutes(startTime))) conflictText = '结束时间必须晚于开始时间';
    else if (!timeUtil.isRangeWithinRanges(startTime, endTime, openRanges)) conflictText = '当前选择超出场室开放时间';
    else if (!timeUtil.isRangeWithinRanges(startTime, endTime, freeRanges)) conflictText = '当前所选时段与已占用时间冲突';

    if (!submitDisabledText && !conflictText && venue && startTime && endTime) {
      currentMaxPeopleLimit = getApplicableMaxPeopleLimit(venue, this.data.date, startTime, endTime);
      if (currentMaxPeopleLimit > 0) slotLimitHintText = '当前所选时段最多可报名 ' + currentMaxPeopleLimit + ' 人';
      else if (normalizePositiveInt(venue.maxPeopleLimit) > 0) slotLimitHintText = '当前场室默认人数上限：' + venue.maxPeopleLimit + ' 人';
      var peopleNum = normalizePositiveInt((this.data.form || {}).people);
      if (peopleNum > 0 && currentMaxPeopleLimit > 0 && peopleNum > currentMaxPeopleLimit) {
        conflictText = '填写人数超过当前时段人数上限';
      }
    }

    if (!submitDisabledText && conflictText) submitDisabledText = '当前预约时间不可提交';

    this.setData({
      hasConflict: !!conflictText,
      conflictText: conflictText,
      submitDisabled: !!submitDisabledText,
      submitDisabledText: submitDisabledText,
      slotLimitHintText: slotLimitHintText,
      currentMaxPeopleLimit: currentMaxPeopleLimit
    });
    return !submitDisabledText && !conflictText;
  },

  onStartPickerChange: function (e) {
    var resolved = timeUtil.resolvePickerSelection(this.startPickerMeta, e.detail.value, this.data.startMinuteOptions);
    if (resolved.selectedMinute == null) return;
    var endState = this.updateEndPickerByStartMinute(resolved.selectedMinute, this.data.endTime);
    var nextStartState = timeUtil.buildPickerState((this.startPickerMeta && this.startPickerMeta.availableMinutes) || [], resolved.selectedMinute);
    this.startPickerMeta = nextStartState;
    this.setData({
      startHourOptions: nextStartState.hourOptions,
      startMinuteOptions: nextStartState.minuteOptions,
      startPickerValue: nextStartState.pickerValue,
      startTime: nextStartState.selectedTime,
      endHourOptions: endState.hourOptions,
      endMinuteOptions: endState.minuteOptions,
      endPickerValue: endState.pickerValue,
      endTime: endState.selectedTime || ''
    });
    this.refreshSelectionState();
  },

  onEndPickerChange: function (e) {
    var resolved = timeUtil.resolvePickerSelection(this.endPickerMeta, e.detail.value, this.data.endMinuteOptions);
    if (resolved.selectedMinute == null) return;
    var nextEndState = timeUtil.buildPickerState((this.endPickerMeta && this.endPickerMeta.availableMinutes) || [], resolved.selectedMinute);
    this.endPickerMeta = nextEndState;
    this.setData({
      endHourOptions: nextEndState.hourOptions,
      endMinuteOptions: nextEndState.minuteOptions,
      endPickerValue: nextEndState.pickerValue,
      endTime: nextEndState.selectedTime
    });
    this.refreshSelectionState();
  },

  onNameInput: function (e) { var v = (e.detail.value || '').trim(); this.setData({ 'form.name': v, name: v }); },
  onPhoneInput: function (e) { var v = (e.detail.value || '').trim(); this.setData({ 'form.phone': v, phone: v }); },
  onPeopleInput: function (e) { var v = (e.detail.value || '').trim(); this.setData({ 'form.people': v, people: v }); this.refreshSelectionState(); },
  onIdCardInput: function (e) { var v = (e.detail.value || '').trim(); this.setData({ 'form.idCard': v, idCard: v }); },
  onNoteInput: function (e) { var v = (e.detail.value || '').trim(); this.setData({ 'form.note': v, note: v }); },
  onName: function (e) { this.onNameInput(e); },
  onPhone: function (e) { this.onPhoneInput(e); },
  onPeople: function (e) { this.onPeopleInput(e); },
  onIdCard: function (e) { this.onIdCardInput(e); },
  onNote: function (e) { this.onNoteInput(e); },
  noop: function () {},
  onNoticeClose: function () { this.setData({ noticeVisible: false, pendingPayload: null }); },
  onNoticeConfirm: function () {
    var payload = this.data.pendingPayload;
    this.setData({ noticeVisible: false, pendingPayload: null });
    if (payload) this.submitPayload(payload);
  },

  closeReminderModal: function () {
    this.setData({
      reminderModalVisible: false,
      reminderBooking: null,
      reminderDefaultLeadMinutes: 30,
      pendingSubscriptionContext: null
    });
  },

  buildReminderSubscriptionContext: function (booking, acceptResultMap) {
    return {
      booking: booking,
      tmplIds: subscriptionUtil.getRequestTemplateIds(),
      acceptResultMap: acceptResultMap || {},
      templateConfigMap: subscriptionUtil.getTemplateConfigMap()
    };
  },

  finalizeCreateFlow: function (message, silent) {
    var title = message || '预约成功';
    if (!silent) wx.showToast({ title: title, icon: 'success' });
    setTimeout(function () { wx.switchTab({ url: '/pages/my/my' }); }, 900);
  },

  finalizeEditFlow: function (booking) {
    var pages = getCurrentPages();
    var prev = pages.length > 1 ? pages[pages.length - 2] : null;
    if (prev && typeof prev.applyUpdatedBooking === 'function') prev.applyUpdatedBooking(booking);
    wx.showToast({ title: '改期成功', icon: 'success' });
    setTimeout(function () {
      if (prev) wx.navigateBack({ delta: 1 });
      else if (booking && booking.id) wx.redirectTo({ url: '/pages/booking_detail/booking_detail?id=' + encodeURIComponent(booking.id) });
      else wx.switchTab({ url: '/pages/my/my' });
    }, 800);
  },

  startCreateSubscriptionFlow: function (booking) {
    var that = this;
    if (!booking || !booking.id) {
      this.finalizeCreateFlow('预约成功');
      return;
    }
    if (!subscriptionUtil.isTemplateConfigReady()) {
      ui.toast('预约成功，请先在 app.js 配置订阅消息模板 ID');
      this.finalizeCreateFlow('预约成功', true);
      return;
    }
    var tmplIds = subscriptionUtil.getRequestTemplateIds();
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: function (res) {
        if (!subscriptionUtil.hasAcceptedTemplate(res || {})) {
          ui.toast('预约成功，可稍后在“我的预约”再次开启订阅');
          that.finalizeCreateFlow('预约成功', true);
          return;
        }
        that.setData({
          reminderModalVisible: true,
          reminderBooking: booking,
          reminderDefaultLeadMinutes: subscriptionUtil.getDefaultLeadMinutes(booking),
          pendingSubscriptionContext: that.buildReminderSubscriptionContext(booking, res || {})
        });
      },
      fail: function (err) {
        ui.toast((err && err.errMsg) || '预约成功，订阅授权未完成');
        that.finalizeCreateFlow('预约成功', true);
      }
    });
  },

  saveBookingSubscription: function (ctx, reminderEnabled, reminderLeadMinutes) {
    var that = this;
    if (!ctx || !ctx.booking || !ctx.booking.id) {
      this.closeReminderModal();
      this.finalizeCreateFlow('预约成功');
      return;
    }
    if (this.data.subscriptionSaving) return;
    this.setData({ subscriptionSaving: true });
    ui.loading(reminderEnabled ? '保存提醒中' : '保存订阅中');
    bookingApi.saveSubscription({
      bookingId: ctx.booking.id,
      enabled: true,
      tmplIds: ctx.tmplIds,
      acceptResultMap: ctx.acceptResultMap,
      templateConfigMap: ctx.templateConfigMap,
      reminderEnabled: !!reminderEnabled,
      reminderLeadMinutes: reminderEnabled ? Number(reminderLeadMinutes || 0) : 0
    }).then(function () {
      return bookingApi.notifyBookingSubscribers({
        bookingId: ctx.booking.id,
        type: 'BOOKING_CREATED'
      }).catch(function (err) {
        console.error('booking created notify failed', err);
        return null;
      });
    }).then(function () {
      that.closeReminderModal();
      that.finalizeCreateFlow(reminderEnabled ? '预约成功，已开启提醒' : '预约成功，已订阅通知');
    }).catch(function (err) {
      ui.toast((err && err.message) || '保存订阅失败，可稍后在“我的预约”补充设置');
      that.finalizeCreateFlow('预约成功', true);
    }).finally(function () {
      that.setData({ subscriptionSaving: false });
      ui.hideLoading();
    });
  },

  onReminderConfirm: function (e) {
    var detail = e.detail || {};
    this.saveBookingSubscription(this.data.pendingSubscriptionContext, true, detail.leadMinutes);
  },

  onReminderSkip: function () {
    this.saveBookingSubscription(this.data.pendingSubscriptionContext, false, 0);
  },

  submitPayload: function (payload) {
    var that = this;
    ui.loading(this.data.isEdit ? '保存中' : '提交中');
    var req = this.data.isEdit ? bookingApi.updateBooking(payload) : bookingApi.createBooking(payload);
    req.then(function (savedBooking) {
      ui.hideLoading();
      if (that.data.isEdit) {
        that.finalizeEditFlow(savedBooking);
        return;
      }
      that.startCreateSubscriptionFlow(savedBooking);
    }).catch(function (e) {
      ui.toast((e && e.message) || '提交失败');
    }).finally(function () { ui.hideLoading(); });
  },

  onSubmit: function () {
    var user = storage.getUser();
    if (!user || user.nickName === '游客') return ui.toast('请先在「我的」登录');
    if (!this.data.venueId) return ui.toast('缺少场室');
    if (this.data.venue && this.data.venue.enabled === false) return ui.toast('该场室当前不可预约');
    if (!this.data.date) return ui.toast('缺少日期');
    if (!sameDayOrAfter(this.data.date, this.data.dateStart)) return ui.toast('预约日期不能早于今天');
    if (!this.data.startTime || !this.data.endTime) return ui.toast('请选择时间');
    if (!this.refreshSelectionState()) return ui.toast(this.data.conflictText || this.data.submitDisabledText || '当前时间不可预约');

    var f = this.data.form || {};
    if (!f.name) return ui.toast('请填写负责人姓名');
    if (!f.phone) return ui.toast('请填写手机号');
    if (!/^1\d{10}$/.test(f.phone)) return ui.toast('手机号格式不正确');
    if (!f.people) return ui.toast('请填写人数');
    if (normalizePositiveInt(f.people) <= 0) return ui.toast('人数必须大于 0');
    if (this.data.currentMaxPeopleLimit > 0 && normalizePositiveInt(f.people) > this.data.currentMaxPeopleLimit) {
      return ui.toast('填写人数超过当前时段人数上限');
    }
    if (!f.idCard) return ui.toast('请填写负责人身份证');
    if (!/^\d{17}[\dXx]$/.test(f.idCard)) return ui.toast('身份证格式不正确');

    var payload = {
      bookingId: this.data.bookingId,
      userId: user.userId,
      venueId: this.data.venueId,
      date: this.data.date,
      startTime: this.data.startTime,
      endTime: this.data.endTime,
      timeLabel: timeUtil.buildTimeLabel(this.data.startTime, this.data.endTime),
      form: {
        name: f.name,
        phone: f.phone,
        people: f.people,
        idCard: f.idCard,
        note: f.note || ''
      }
    };

    this.setData({ noticeVisible: true, pendingPayload: payload });
  }
});
