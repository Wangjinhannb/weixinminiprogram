var subscriptionUtil = require('../../utils/subscription');

function buildHourOptions(maxLeadMinutes) {
  var maxHour = Math.floor(Math.max(0, maxLeadMinutes) / 60);
  var result = [];
  for (var i = 0; i <= maxHour; i++) result.push({ label: i + '小时', value: i });
  return result;
}

function buildMinuteOptions(hour, maxLeadMinutes) {
  hour = Number(hour || 0);
  maxLeadMinutes = Number(maxLeadMinutes || 0);
  var maxMinute = hour === Math.floor(maxLeadMinutes / 60) ? (maxLeadMinutes % 60) : 59;
  var list = [];
  for (var i = 0; i <= maxMinute; i++) {
    if (hour === 0 && i === 0) continue;
    list.push({ label: i + '分钟', value: i });
  }
  if (!list.length) list.push({ label: '0分钟', value: 0 });
  return list;
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    booking: { type: Object, value: null },
    defaultLeadMinutes: { type: Number, value: 0 }
  },
  data: {
    pickerValue: [0, 0],
    hourOptions: [],
    minuteOptions: [],
    maxLeadMinutes: 0,
    leadMinutes: 0,
    leadText: '',
    reminderAtText: '',
    tooLate: false
  },
  observers: {
    'visible, booking, defaultLeadMinutes': function (visible, booking, defaultLeadMinutes) {
      if (!visible) return;
      this.initPicker(booking, defaultLeadMinutes);
    }
  },
  methods: {
    noop: function () {},
    initPicker: function (booking, defaultLeadMinutes) {
      booking = booking || {};
      var maxLeadMinutes = subscriptionUtil.getMaxLeadMinutes(booking);
      var tooLate = maxLeadMinutes <= 0;
      var hourOptions = buildHourOptions(maxLeadMinutes);
      var pickedLead = Number(defaultLeadMinutes || 0);
      if (!pickedLead || pickedLead > maxLeadMinutes) pickedLead = subscriptionUtil.getDefaultLeadMinutes(booking);
      if (!pickedLead || pickedLead > maxLeadMinutes) pickedLead = maxLeadMinutes;
      if (pickedLead <= 0 && maxLeadMinutes > 0) pickedLead = 1;
      var hour = Math.floor(pickedLead / 60);
      var minuteOptions = buildMinuteOptions(hour, maxLeadMinutes);
      var minute = pickedLead % 60;
      var minuteIndex = 0;
      for (var i = 0; i < minuteOptions.length; i++) {
        if (minuteOptions[i].value === minute) { minuteIndex = i; break; }
      }
      this.setData({
        maxLeadMinutes: maxLeadMinutes,
        tooLate: tooLate,
        hourOptions: hourOptions,
        minuteOptions: minuteOptions,
        pickerValue: [hour, minuteIndex]
      });
      if (!tooLate) this.updateSummary(hour, minuteOptions[minuteIndex] ? minuteOptions[minuteIndex].value : 0);
      else this.setData({ leadMinutes: 0, leadText: '', reminderAtText: '' });
    },
    updateSummary: function (hour, minute) {
      var booking = this.properties.booking || {};
      hour = Number(hour || 0);
      minute = Number(minute || 0);
      var leadMinutes = hour * 60 + minute;
      if (leadMinutes <= 0) leadMinutes = 1;
      if (leadMinutes > this.data.maxLeadMinutes) leadMinutes = this.data.maxLeadMinutes;
      var bookingStartMs = subscriptionUtil.buildDateTimeMs(booking.date, booking.startTime);
      var reminderAtMs = bookingStartMs - leadMinutes * 60000;
      this.setData({
        leadMinutes: leadMinutes,
        leadText: subscriptionUtil.formatLeadText(leadMinutes),
        reminderAtText: subscriptionUtil.formatChinaDateTime(reminderAtMs)
      });
    },
    onPickerChange: function (e) {
      if (this.data.tooLate) return;
      var pickerValue = e.detail.value || [0, 0];
      var hourIndex = Number(pickerValue[0] || 0);
      var hourItem = this.data.hourOptions[hourIndex] || this.data.hourOptions[0] || { value: 0 };
      var minuteOptions = buildMinuteOptions(hourItem.value, this.data.maxLeadMinutes);
      var minuteIndex = Number(pickerValue[1] || 0);
      if (minuteIndex >= minuteOptions.length) minuteIndex = minuteOptions.length - 1;
      if (minuteIndex < 0) minuteIndex = 0;
      var minuteItem = minuteOptions[minuteIndex] || minuteOptions[0] || { value: 0 };
      this.setData({
        minuteOptions: minuteOptions,
        pickerValue: [hourIndex, minuteIndex]
      });
      this.updateSummary(hourItem.value, minuteItem.value);
    },
    onSkip: function () {
      this.triggerEvent('skip');
    },
    onConfirm: function () {
      if (this.data.tooLate || this.data.leadMinutes <= 0) {
        this.triggerEvent('skip');
        return;
      }
      this.triggerEvent('confirm', {
        leadMinutes: this.data.leadMinutes,
        leadText: this.data.leadText,
        reminderAtText: this.data.reminderAtText
      });
    }
  }
});
