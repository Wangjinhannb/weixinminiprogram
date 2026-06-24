function trim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeImages(list) {
  if (typeof list === 'string') {
    var text = trim(list);
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
    var item = trim(raw);
    if (item) out.push(item);
  }
  return out;
}

function isCloudFileID(url) {
  return trim(url).indexOf('cloud://') === 0;
}

function isDisplayableImageUrl(url) {
  url = trim(url);
  return !!url && !isCloudFileID(url);
}

function uniquePush(list, item) {
  item = trim(item);
  if (!item) return;
  for (var i = 0; i < list.length; i++) {
    if (list[i] === item) return;
  }
  list.push(item);
}

function emptyNotice() {
  return {
    id: '',
    _id: '',
    enabled: false,
    deleted: false,
    title: '',
    content: '',
    imageUrl: '',
    displayImageUrl: '',
    imageUrls: [],
    images: [],
    linkUrl: '',
    linkText: '立即报名',
    hasActivity: false,
    emptyText: '暂无活动',
    list: [],
    total: 0
  };
}

function normalizeNotice(raw) {
  raw = raw || {};
  var id = trim(raw.id || raw._id || raw.noticeId || raw.activityId);
  var title = trim(raw.title);
  var content = trim(raw.content || raw.text || raw.description);
  var imageUrl = trim(raw.imageUrl || raw.image || raw.cover || raw.coverUrl);
  var imageList = normalizeImages(raw.images);
  if (!imageList.length) imageList = normalizeImages(raw.imageUrls || raw.photos || raw.pictures || []);
  if (!imageUrl && imageList.length) imageUrl = imageList[0];
  if (imageUrl && !imageList.length) imageList = [imageUrl];

  var displayImageUrl = trim(raw.displayImageUrl || raw.tempImageUrl || raw.imageTempUrl);
  if (!isDisplayableImageUrl(displayImageUrl)) displayImageUrl = '';

  var imageUrls = [];
  var rawImageUrls = normalizeImages(raw.imageUrls || []);
  for (var i = 0; i < rawImageUrls.length; i++) {
    if (isDisplayableImageUrl(rawImageUrls[i])) uniquePush(imageUrls, rawImageUrls[i]);
  }
  if (displayImageUrl) uniquePush(imageUrls, displayImageUrl);
  if (!displayImageUrl && isDisplayableImageUrl(imageUrl)) displayImageUrl = imageUrl;
  if (isDisplayableImageUrl(imageUrl)) uniquePush(imageUrls, imageUrl);

  var linkUrl = trim(raw.linkUrl || raw.url || raw.link);
  var linkText = trim(raw.linkText || raw.buttonText) || '立即报名';
  var deleted = raw.deleted === true;
  var enabled = raw.enabled !== false;
  var hasContent = !!(title || content || imageUrl || linkUrl);
  return {
    id: id,
    _id: id,
    enabled: enabled,
    deleted: deleted,
    title: title,
    content: content,
    imageUrl: imageUrl,
    displayImageUrl: displayImageUrl,
    imageUrls: imageUrls,
    images: imageList,
    imagesChanged: raw.imagesChanged === true || raw.imagesDirty === true,
    linkUrl: linkUrl,
    linkText: linkText,
    hasActivity: !!(!deleted && enabled && hasContent),
    emptyText: '暂无活动',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    updatedAtText: trim(raw.updatedAtText || '')
  };
}

function normalizeNoticeList(raw) {
  var source = raw;
  if (source && !Array.isArray(source) && Array.isArray(source.list)) source = source.list;
  if (source && !Array.isArray(source) && Array.isArray(source.activities)) source = source.activities;
  if (source && !Array.isArray(source) && Array.isArray(source.notices)) source = source.notices;
  if (!Array.isArray(source)) source = source ? [source] : [];

  var list = [];
  for (var i = 0; i < source.length; i++) {
    var item = normalizeNotice(source[i]);
    if (item.hasActivity) list.push(item);
  }
  return list;
}

function normalizeNoticeGroup(raw) {
  var list = normalizeNoticeList(raw);
  if (!list.length) return emptyNotice();
  var first = list[0] || normalizeNotice(null);
  var group = {};
  Object.keys(first).forEach(function (key) { group[key] = first[key]; });
  group.hasActivity = true;
  group.list = list;
  group.total = list.length;
  group.emptyText = '暂无活动';
  return group;
}

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

function getTempFileURL(fileID) {
  fileID = trim(fileID);
  if (!fileID || !isCloudFileID(fileID) || !wx.cloud || !wx.cloud.getTempFileURL) return Promise.resolve('');
  return new Promise(function (resolve) {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: function (res) {
        var item = res && res.fileList && res.fileList[0] ? res.fileList[0] : null;
        var url = item && (item.tempFileURL || item.download_url || item.url || '');
        resolve(isDisplayableImageUrl(url) ? url : '');
      },
      fail: function () { resolve(''); }
    });
  });
}

function downloadCloudFile(fileID) {
  fileID = trim(fileID);
  if (!fileID || !isCloudFileID(fileID) || !wx.cloud || !wx.cloud.downloadFile) return Promise.resolve('');
  return new Promise(function (resolve) {
    wx.cloud.downloadFile({
      fileID: fileID,
      success: function (res) {
        var path = res && res.tempFilePath ? res.tempFilePath : '';
        resolve(path || '');
      },
      fail: function () { resolve(''); }
    });
  });
}

function resolveCloudImageUrl(fileID) {
  fileID = trim(fileID);
  if (!isCloudFileID(fileID)) return Promise.resolve(isDisplayableImageUrl(fileID) ? fileID : '');
  return getTempFileURL(fileID).then(function (url) {
    if (url) return url;
    return downloadCloudFile(fileID);
  });
}

function resolveCloudImageUrls(images) {
  images = normalizeImages(images);
  if (!images.length) return Promise.resolve([]);
  var tasks = [];
  for (var i = 0; i < images.length; i++) tasks.push(resolveCloudImageUrl(images[i]));
  return Promise.all(tasks).then(function (urls) {
    var out = [];
    for (var i = 0; i < urls.length; i++) {
      if (isDisplayableImageUrl(urls[i])) uniquePush(out, urls[i]);
    }
    return out;
  });
}

function resolveDisplayImageUrl(notice) {
  notice = normalizeNotice(notice);
  var displayUrls = normalizeImages(notice.imageUrls || []).filter(isDisplayableImageUrl);
  if (notice.displayImageUrl && isDisplayableImageUrl(notice.displayImageUrl)) uniquePush(displayUrls, notice.displayImageUrl);
  if (displayUrls.length) {
    notice.displayImageUrl = displayUrls[0];
    notice.imageUrls = displayUrls;
    return Promise.resolve(notice);
  }

  var sources = normalizeImages(notice.images || []);
  if (notice.imageUrl) uniquePush(sources, notice.imageUrl);
  if (!sources.length) return Promise.resolve(notice);

  return resolveCloudImageUrls(sources).then(function (urls) {
    notice.imageUrls = urls || [];
    notice.displayImageUrl = notice.imageUrls.length ? notice.imageUrls[0] : '';
    return notice;
  });
}

function resolveNoticeList(list) {
  list = normalizeNoticeList(list);
  var tasks = [];
  for (var i = 0; i < list.length; i++) tasks.push(resolveDisplayImageUrl(list[i]));
  return Promise.all(tasks);
}

function resolveNoticeGroup(raw) {
  return resolveNoticeList(raw).then(function (list) {
    return normalizeNoticeGroup(list);
  });
}

function getNotice() {
  return callCloud('getActivityNotice', {}).then(function (data) {
    return resolveNoticeGroup(data);
  }).catch(function (err) {
    console.error('读取活动预告失败', err);
    return emptyNotice();
  });
}

function getActivityList() {
  return callCloud('getActivityList', {}).then(function (data) {
    var list = Array.isArray(data) ? data : ((data && data.list) || []);
    return resolveNoticeList(list);
  });
}

function saveNotice(payload) {
  payload = normalizeNotice(payload || {});
  return callCloud('saveActivityNotice', {
    id: payload.id || payload._id || '',
    enabled: true,
    title: payload.title,
    content: payload.content,
    imageUrl: payload.imageUrl,
    images: normalizeImages(payload.images || (payload.imageUrl ? [payload.imageUrl] : [])),
    imagesChanged: payload.imagesChanged === true,
    linkUrl: payload.linkUrl,
    linkText: payload.linkText || '立即报名'
  }).then(function (data) {
    return resolveDisplayImageUrl(data);
  });
}

function deleteNotice(id) {
  id = trim(id);
  if (!id) return Promise.reject(new Error('缺少活动ID'));
  return callCloud('deleteActivityNotice', { id: id });
}

function hasNoticeContent(form) {
  form = form || {};
  return !!(trim(form.title) || trim(form.content) || trim(form.imageUrl) || trim(form.linkUrl));
}

module.exports = {
  emptyNotice: emptyNotice,
  normalizeNotice: normalizeNotice,
  normalizeNoticeList: normalizeNoticeList,
  normalizeNoticeGroup: normalizeNoticeGroup,
  getNotice: getNotice,
  getActivityList: getActivityList,
  saveNotice: saveNotice,
  deleteNotice: deleteNotice,
  hasNoticeContent: hasNoticeContent,
  isCloudFileID: isCloudFileID,
  isDisplayableImageUrl: isDisplayableImageUrl,
  normalizeImages: normalizeImages,
  resolveCloudImageUrl: resolveCloudImageUrl,
  resolveCloudImageUrls: resolveCloudImageUrls,
  resolveDisplayImageUrl: resolveDisplayImageUrl
};
