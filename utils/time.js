
function pad2(v) {
  v = Number(v || 0);
  return v < 10 ? '0' + v : '' + v;
}

function isValidTimeString(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(String(value || '').trim());
}

function hasSeconds(value) {
  return String(value || '').trim().split(':').length === 3;
}

function normalizeTimeString(value, keepSeconds) {
  value = String(value || '').trim();
  if (!isValidTimeString(value)) return '';
  var parts = value.split(':');
  if (parts.length < 3) parts.push('00');
  if (keepSeconds === false) return parts[0] + ':' + parts[1];
  return parts[0] + ':' + parts[1] + ':' + parts[2];
}

function normalizeMaxPeopleLimit(value) {
  if (value === '' || value == null) return 0;
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function formatMaxPeopleLimitText(value) {
  var limit = normalizeMaxPeopleLimit(value);
  return limit > 0 ? (limit + ' 人') : '不限';
}

function buildDateTimeText(date, time) {
  date = String(date || '').trim();
  time = normalizeTimeString(time, true);
  if (!date || !time) return '';
  return date + ' ' + time;
}

function buildDateTimeRangeLabel(date, startTime, endTime) {
  var start = buildDateTimeText(date, startTime);
  var end = buildDateTimeText(date, endTime);
  if (!start || !end) return '';
  return start + ' - ' + end;
}

function timeToSeconds(value) {
  if (typeof value === 'number') return value;
  value = normalizeTimeString(value, true);
  if (!value) return NaN;
  var parts = value.split(':');
  return Number(parts[0] || 0) * 3600 + Number(parts[1] || 0) * 60 + Number(parts[2] || 0);
}

function secondsToTime(value, keepSeconds) {
  value = Number(value);
  if (isNaN(value)) return '';
  if (value < 0) value = 0;
  if (value > 24 * 3600) value = 24 * 3600;
  var hour = Math.floor(value / 3600);
  var minute = Math.floor((value % 3600) / 60);
  var second = value % 60;
  if (hour >= 24) {
    hour = 23;
    minute = 59;
    second = 59;
  }
  if (keepSeconds === false) return pad2(hour) + ':' + pad2(minute);
  return pad2(hour) + ':' + pad2(minute) + ':' + pad2(second);
}

function timeToMinutes(value) {
  var seconds = timeToSeconds(value);
  if (isNaN(seconds)) return NaN;
  return Math.floor(seconds / 60);
}

function minutesToTime(value) {
  value = Number(value);
  if (isNaN(value)) return '';
  if (value < 0) value = 0;
  if (value > 24 * 60) value = 24 * 60;
  var hour = Math.floor(value / 60);
  var minute = value % 60;
  if (hour >= 24 && minute > 0) {
    hour = 23;
    minute = 59;
  }
  return pad2(hour) + ':' + pad2(minute);
}

function buildTimeLabel(startTime, endTime, keepSeconds) {
  if (keepSeconds == null) keepSeconds = hasSeconds(startTime) || hasSeconds(endTime);
  var start = normalizeTimeString(startTime, keepSeconds !== false) || String(startTime || '');
  var end = normalizeTimeString(endTime, keepSeconds !== false) || String(endTime || '');
  return start + '-' + end;
}

function normalizeTimeSlot(slot, options) {
  slot = slot || {};
  options = options || {};
  var startRaw = String(slot.start || '').trim();
  var endRaw = String(slot.end || '').trim();
  if (!isValidTimeString(startRaw) || !isValidTimeString(endRaw)) return null;
  var startSec = timeToSeconds(startRaw);
  var endSec = timeToSeconds(endRaw);
  if (!(endSec > startSec)) return null;
  var keepSeconds = options.keepSeconds !== false;
  var start = normalizeTimeString(startRaw, keepSeconds);
  var end = normalizeTimeString(endRaw, keepSeconds);
  return {
    start: start,
    end: end,
    startMin: Math.floor(startSec / 60),
    endMin: Math.floor(endSec / 60),
    startSec: startSec,
    endSec: endSec,
    label: String(slot.label || '').trim() || buildTimeLabel(start, end, keepSeconds),
    maxPeopleLimit: normalizeMaxPeopleLimit(slot.maxPeopleLimit || slot.maxBookingCount)
  };
}

function sortTimeSlots(list, options) {
  return normalizeTimeSlots(list, options);
}

function normalizeTimeSlots(list, options) {
  list = Array.isArray(list) ? list : [];
  var result = [];
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var item = normalizeTimeSlot(list[i], options);
    if (!item) continue;
    var key = item.start + '_' + item.end;
    if (map[key]) continue;
    map[key] = true;
    result.push(item);
  }
  result.sort(function (a, b) {
    if (a.startSec === b.startSec) return a.endSec - b.endSec;
    return a.startSec - b.startSec;
  });
  return result;
}

function normalizeRange(range, options) {
  range = range || {};
  options = options || {};
  var startSec = typeof range.startSec === 'number' ? range.startSec : timeToSeconds(range.start);
  var endSec = typeof range.endSec === 'number' ? range.endSec : timeToSeconds(range.end);
  if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) return null;
  var keepSeconds = options.keepSeconds !== false;
  var start = secondsToTime(startSec, keepSeconds === false ? false : true);
  var end = secondsToTime(endSec, keepSeconds === false ? false : true);
  return {
    start: start,
    end: end,
    startMin: Math.floor(startSec / 60),
    endMin: Math.floor(endSec / 60),
    startSec: startSec,
    endSec: endSec,
    label: range.label || buildTimeLabel(start, end, keepSeconds)
  };
}

function mergeRanges(list, options) {
  list = Array.isArray(list) ? list : [];
  var normalized = [];
  for (var i = 0; i < list.length; i++) {
    var item = normalizeRange(list[i], options);
    if (item) normalized.push(item);
  }
  normalized.sort(function (a, b) {
    if (a.startSec === b.startSec) return a.endSec - b.endSec;
    return a.startSec - b.startSec;
  });
  var result = [];
  for (var j = 0; j < normalized.length; j++) {
    var current = normalized[j];
    var last = result[result.length - 1];
    if (!last) {
      result.push(current);
      continue;
    }
    if (current.startSec <= last.endSec) {
      if (current.endSec > last.endSec) {
        last.endSec = current.endSec;
        last.endMin = Math.floor(last.endSec / 60);
        last.end = secondsToTime(last.endSec, true);
        last.label = buildTimeLabel(last.start, last.end, true);
      }
    } else {
      result.push(current);
    }
  }
  return result;
}

function mergeTimeSlotsToRanges(list, options) {
  return mergeRanges(normalizeTimeSlots(list, options), options);
}

function subtractRanges(openRanges, occupiedRanges) {
  var source = mergeRanges(openRanges);
  var blocked = mergeRanges(occupiedRanges);
  var result = [];
  for (var i = 0; i < source.length; i++) {
    var segments = [source[i]];
    for (var j = 0; j < blocked.length; j++) {
      var block = blocked[j];
      var nextSegments = [];
      for (var k = 0; k < segments.length; k++) {
        var seg = segments[k];
        if (block.endSec <= seg.startSec || block.startSec >= seg.endSec) {
          nextSegments.push(seg);
          continue;
        }
        if (block.startSec > seg.startSec) {
          nextSegments.push(normalizeRange({ startSec: seg.startSec, endSec: block.startSec }));
        }
        if (block.endSec < seg.endSec) {
          nextSegments.push(normalizeRange({ startSec: block.endSec, endSec: seg.endSec }));
        }
      }
      segments = [];
      for (var n = 0; n < nextSegments.length; n++) {
        if (nextSegments[n]) segments.push(nextSegments[n]);
      }
      if (!segments.length) break;
    }
    for (var m = 0; m < segments.length; m++) result.push(segments[m]);
  }
  return mergeRanges(result);
}

function isTimeRangeConflict(startA, endA, startB, endB) {
  var startASec = timeToSeconds(startA);
  var endASec = timeToSeconds(endA);
  var startBSec = timeToSeconds(startB);
  var endBSec = timeToSeconds(endB);
  if ([startASec, endASec, startBSec, endBSec].some(isNaN)) return false;
  return startASec < endBSec && endASec > startBSec;
}

function isRangeWithinRanges(startTime, endTime, ranges) {
  var startSec = timeToSeconds(startTime);
  var endSec = timeToSeconds(endTime);
  if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) return false;
  ranges = mergeRanges(ranges);
  for (var i = 0; i < ranges.length; i++) {
    if (startSec >= ranges[i].startSec && endSec <= ranges[i].endSec) return true;
  }
  return false;
}

function findContainingRange(ranges, value) {
  var second = typeof value === 'number' ? (value > 24 * 60 ? value : value * 60) : timeToSeconds(value);
  if (isNaN(second)) return null;
  ranges = mergeRanges(ranges);
  for (var i = 0; i < ranges.length; i++) {
    if (second >= ranges[i].startSec && second < ranges[i].endSec) return ranges[i];
  }
  return null;
}

function buildMinuteListFromRanges(ranges, includeEnd) {
  ranges = mergeRanges(ranges);
  var result = [];
  for (var i = 0; i < ranges.length; i++) {
    var range = ranges[i];
    var startMinute = Math.ceil(range.startSec / 60);
    var endMinute = Math.floor(range.endSec / 60);
    var max = includeEnd ? endMinute : endMinute - 1;
    for (var current = startMinute; current <= max; current++) result.push(current);
  }
  return result;
}

function buildEndMinuteList(freeRanges, startMinute) {
  startMinute = typeof startMinute === 'number' ? startMinute : timeToMinutes(startMinute);
  if (isNaN(startMinute)) return [];
  var startSec = startMinute * 60;
  freeRanges = mergeRanges(freeRanges);
  for (var i = 0; i < freeRanges.length; i++) {
    var range = freeRanges[i];
    if (startSec >= range.startSec && startSec < range.endSec) {
      var result = [];
      var maxMinute = Math.floor(range.endSec / 60);
      for (var current = startMinute + 1; current <= maxMinute; current++) result.push(current);
      return result;
    }
  }
  return [];
}

function buildPickerState(minutes, preferredMinute) {
  minutes = Array.isArray(minutes) ? minutes.slice() : [];
  minutes.sort(function (a, b) { return a - b; });
  if (!minutes.length) {
    return {
      selectedMinute: null,
      selectedTime: '',
      hourValues: [],
      minuteMap: {},
      hourOptions: [],
      minuteOptions: [],
      pickerValue: [0, 0],
      availableMinutes: []
    };
  }
  var minuteMap = {};
  for (var i = 0; i < minutes.length; i++) {
    var total = Number(minutes[i]);
    var hour = Math.floor(total / 60);
    var minute = total % 60;
    if (!minuteMap[hour]) minuteMap[hour] = [];
    minuteMap[hour].push(minute);
  }
  var hourValues = Object.keys(minuteMap).map(function (item) { return Number(item); }).sort(function (a, b) { return a - b; });
  var selectedMinute = typeof preferredMinute === 'number' ? preferredMinute : timeToMinutes(preferredMinute);
  if (isNaN(selectedMinute) || minutes.indexOf(selectedMinute) < 0) selectedMinute = minutes[0];
  var selectedHour = Math.floor(selectedMinute / 60);
  if (hourValues.indexOf(selectedHour) < 0) selectedHour = hourValues[0];
  var minuteValues = minuteMap[selectedHour] || [];
  var selectedMinuteValue = selectedMinute % 60;
  if (minuteValues.indexOf(selectedMinuteValue) < 0) {
    selectedMinuteValue = minuteValues[0];
    selectedMinute = selectedHour * 60 + selectedMinuteValue;
  }
  var hourOptions = [];
  for (var h = 0; h < hourValues.length; h++) hourOptions.push({ label: pad2(hourValues[h]) + ' 时', value: hourValues[h] });
  var minuteOptions = [];
  for (var m = 0; m < minuteValues.length; m++) minuteOptions.push({ label: pad2(minuteValues[m]) + ' 分', value: minuteValues[m] });
  return {
    selectedMinute: selectedMinute,
    selectedTime: minutesToTime(selectedMinute),
    hourValues: hourValues,
    minuteMap: minuteMap,
    hourOptions: hourOptions,
    minuteOptions: minuteOptions,
    pickerValue: [hourValues.indexOf(selectedHour), minuteValues.indexOf(selectedMinuteValue)],
    availableMinutes: minutes
  };
}

function resolvePickerSelection(meta, pickerValue, currentMinuteOptions) {
  meta = meta || {};
  pickerValue = Array.isArray(pickerValue) ? pickerValue : [0, 0];
  var hourValues = meta.hourValues || [];
  var minuteMap = meta.minuteMap || {};
  if (!hourValues.length) return { selectedMinute: null, selectedTime: '' };
  var hourIndex = Number(pickerValue[0] || 0);
  if (hourIndex < 0) hourIndex = 0;
  if (hourIndex >= hourValues.length) hourIndex = hourValues.length - 1;
  var selectedHour = hourValues[hourIndex];
  var minuteValues = minuteMap[selectedHour] || [];
  if (!minuteValues.length) return { selectedMinute: null, selectedTime: '' };
  var minuteIndex = Number(pickerValue[1] || 0);
  if (minuteIndex < 0) minuteIndex = 0;
  var preferredMinute = null;
  if (Array.isArray(currentMinuteOptions) && currentMinuteOptions[minuteIndex]) preferredMinute = Number(currentMinuteOptions[minuteIndex].value);
  if (preferredMinute == null || minuteValues.indexOf(preferredMinute) < 0) {
    if (minuteIndex >= minuteValues.length) minuteIndex = minuteValues.length - 1;
    preferredMinute = minuteValues[minuteIndex];
  }
  var selectedMinute = selectedHour * 60 + preferredMinute;
  return {
    selectedMinute: selectedMinute,
    selectedTime: minutesToTime(selectedMinute)
  };
}

function buildFixedTimePickerOptions() {
  var hourOptions = [];
  var minuteOptions = [];
  var secondOptions = [];
  for (var h = 0; h < 24; h++) hourOptions.push({ label: pad2(h), value: h });
  for (var m = 0; m < 60; m++) {
    minuteOptions.push({ label: pad2(m), value: m });
    secondOptions.push({ label: pad2(m), value: m });
  }
  return {
    hourOptions: hourOptions,
    minuteOptions: minuteOptions,
    secondOptions: secondOptions
  };
}

function timeToPickerValue(value) {
  var text = normalizeTimeString(value, true) || '00:00:00';
  var parts = text.split(':');
  return [Number(parts[0] || 0), Number(parts[1] || 0), Number(parts[2] || 0)];
}

function pickerValueToTime(value) {
  value = Array.isArray(value) ? value : [0, 0, 0];
  return pad2(value[0] || 0) + ':' + pad2(value[1] || 0) + ':' + pad2(value[2] || 0);
}

function formatTimeRangeText(start, end, keepSeconds) {
  return buildTimeLabel(start, end, keepSeconds);
}

function validateTimeSlotsDetailed(list, options) {
  options = options || {};
  list = Array.isArray(list) ? list : [];
  if (!list.length) {
    if (options.allowEmpty) return { ok: true, list: [] };
    return { ok: false, message: '请至少配置一个可预约时间段', list: [] };
  }
  var normalized = [];
  var keyMap = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var start = String(item.start || '').trim();
    var end = String(item.end || '').trim();
    if (!start || !end) return { ok: false, message: '请完整填写所有时间段', list: normalized };
    if (!isValidTimeString(start) || !isValidTimeString(end)) return { ok: false, message: '时间格式不正确，请使用 HH:mm 或 HH:mm:ss', list: normalized };
    var slot = normalizeTimeSlot({ start: start, end: end, label: item.label, maxPeopleLimit: item.maxPeopleLimit || item.maxBookingCount }, { keepSeconds: options.keepSeconds !== false });
    if (!slot) return { ok: false, message: '结束时间必须晚于开始时间', list: normalized };
    var key = slot.start + '_' + slot.end;
    if (keyMap[key]) return { ok: false, message: '存在重复的可预约时间段', list: normalized };
    keyMap[key] = true;
    normalized.push(slot);
  }
  normalized.sort(function (a, b) {
    if (a.startSec === b.startSec) return a.endSec - b.endSec;
    return a.startSec - b.startSec;
  });
  for (var j = 1; j < normalized.length; j++) {
    if (normalized[j].startSec < normalized[j - 1].endSec) {
      return { ok: false, message: '可预约时间段存在重叠：' + normalized[j - 1].label + ' 与 ' + normalized[j].label, list: normalized };
    }
  }
  return { ok: true, list: normalized };
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return false;
  var date = new Date(String(value).trim() + 'T00:00:00');
  return !isNaN(date.getTime()) && date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) === String(value).trim();
}

function normalizeDateOverride(item, options) {
  item = item || {};
  var date = String(item.date || '').trim();
  if (!isValidDateString(date)) return null;
  var slots = normalizeTimeSlots(item.timeSlots || [], options);
  for (var i = 0; i < slots.length; i++) {
    slots[i].startDateTime = buildDateTimeText(date, slots[i].start);
    slots[i].endDateTime = buildDateTimeText(date, slots[i].end);
    slots[i].dateTimeLabel = buildDateTimeRangeLabel(date, slots[i].start, slots[i].end);
  }
  return {
    date: date,
    timeSlots: slots
  };
}

function normalizeDateOverrides(list, options) {
  list = Array.isArray(list) ? list : [];
  var result = [];
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var item = normalizeDateOverride(list[i], options);
    if (!item) continue;
    map[item.date] = item;
  }
  for (var date in map) result.push(map[date]);
  result.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
  return result;
}

function validateDateOverridesDetailed(list, options) {
  options = options || {};
  list = Array.isArray(list) ? list : [];
  var result = [];
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var date = String(item.date || '').trim();
    if (!date) return { ok: false, message: '请完整填写日期覆盖配置中的日期', list: result };
    if (!isValidDateString(date)) return { ok: false, message: '指定日期格式不正确，请使用 YYYY-MM-DD', list: result };
    if (map[date]) return { ok: false, message: '同一日期只能配置一组单日时间段：' + date, list: result };
    var slotValidation = validateTimeSlotsDetailed(item.timeSlots || [], { keepSeconds: options.keepSeconds !== false, allowEmpty: false });
    if (!slotValidation.ok) return { ok: false, message: date + '：' + slotValidation.message, list: result };
    var normalizedItem = { date: date, timeSlots: slotValidation.list };
    for (var j = 0; j < normalizedItem.timeSlots.length; j++) {
      normalizedItem.timeSlots[j].startDateTime = buildDateTimeText(date, normalizedItem.timeSlots[j].start);
      normalizedItem.timeSlots[j].endDateTime = buildDateTimeText(date, normalizedItem.timeSlots[j].end);
      normalizedItem.timeSlots[j].dateTimeLabel = buildDateTimeRangeLabel(date, normalizedItem.timeSlots[j].start, normalizedItem.timeSlots[j].end);
    }
    map[date] = true;
    result.push(normalizedItem);
  }
  result.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
  return { ok: true, list: result };
}

function validateVenueTimeConfigDetailed(defaultSlots, dateOverrides, options) {
  options = options || {};
  var defaultValidation = validateTimeSlotsDetailed(defaultSlots || [], { keepSeconds: options.keepSeconds !== false, allowEmpty: true });
  if (!defaultValidation.ok) return defaultValidation;
  var overrideValidation = validateDateOverridesDetailed(dateOverrides || [], { keepSeconds: options.keepSeconds !== false });
  if (!overrideValidation.ok) return overrideValidation;
  if (!defaultValidation.list.length && !overrideValidation.list.length) {
    return { ok: false, message: '请至少配置一个通用可预约时间段，或一个指定日期覆盖配置', defaultSlots: [], dateOverrides: [] };
  }
  return { ok: true, defaultSlots: defaultValidation.list, dateOverrides: overrideValidation.list };
}

function getVenueDefaultTimeSlots(venue, options) {
  venue = venue || {};
  var config = venue.bookingTimeConfig || {};
  var slots = config.defaultSlots || venue.timeSlots || [];
  return normalizeTimeSlots(slots, options);
}

function getVenueDateOverrides(venue, options) {
  venue = venue || {};
  var config = venue.bookingTimeConfig || {};
  var overrides = config.dateOverrides || venue.dateOverrides || [];
  return normalizeDateOverrides(overrides, options);
}

function getEffectiveTimeSlots(venue, date, options) {
  var overrides = getVenueDateOverrides(venue, options);
  var targetDate = String(date || '').trim();
  for (var i = 0; i < overrides.length; i++) {
    if (overrides[i].date === targetDate) return overrides[i].timeSlots;
  }
  return getVenueDefaultTimeSlots(venue, options);
}

function getEffectiveOpenRanges(venue, date, options) {
  return mergeTimeSlotsToRanges(getEffectiveTimeSlots(venue, date, options), options);
}

function hasDateOverride(venue, date) {
  var overrides = getVenueDateOverrides(venue);
  var targetDate = String(date || '').trim();
  for (var i = 0; i < overrides.length; i++) {
    if (overrides[i].date === targetDate) return true;
  }
  return false;
}

module.exports = {
  pad2: pad2,
  isValidTimeString: isValidTimeString,
  hasSeconds: hasSeconds,
  normalizeTimeString: normalizeTimeString,
  normalizeMaxPeopleLimit: normalizeMaxPeopleLimit,
  formatMaxPeopleLimitText: formatMaxPeopleLimitText,
  buildDateTimeText: buildDateTimeText,
  buildDateTimeRangeLabel: buildDateTimeRangeLabel,
  timeToSeconds: timeToSeconds,
  secondsToTime: secondsToTime,
  timeToMinutes: timeToMinutes,
  minutesToTime: minutesToTime,
  buildTimeLabel: buildTimeLabel,
  formatTimeRangeText: formatTimeRangeText,
  normalizeTimeSlot: normalizeTimeSlot,
  normalizeTimeSlots: normalizeTimeSlots,
  sortTimeSlots: sortTimeSlots,
  normalizeRange: normalizeRange,
  mergeRanges: mergeRanges,
  mergeTimeSlotsToRanges: mergeTimeSlotsToRanges,
  subtractRanges: subtractRanges,
  isTimeRangeConflict: isTimeRangeConflict,
  isRangeWithinRanges: isRangeWithinRanges,
  findContainingRange: findContainingRange,
  buildMinuteListFromRanges: buildMinuteListFromRanges,
  buildEndMinuteList: buildEndMinuteList,
  buildPickerState: buildPickerState,
  resolvePickerSelection: resolvePickerSelection,
  buildFixedTimePickerOptions: buildFixedTimePickerOptions,
  timeToPickerValue: timeToPickerValue,
  pickerValueToTime: pickerValueToTime,
  validateTimeSlotsDetailed: validateTimeSlotsDetailed,
  isValidDateString: isValidDateString,
  normalizeDateOverride: normalizeDateOverride,
  normalizeDateOverrides: normalizeDateOverrides,
  validateDateOverridesDetailed: validateDateOverridesDetailed,
  validateVenueTimeConfigDetailed: validateVenueTimeConfigDetailed,
  getVenueDefaultTimeSlots: getVenueDefaultTimeSlots,
  getVenueDateOverrides: getVenueDateOverrides,
  getEffectiveTimeSlots: getEffectiveTimeSlots,
  getEffectiveOpenRanges: getEffectiveOpenRanges,
  hasDateOverride: hasDateOverride
};
