var storage = require("../storage");
var cfg = require("../config").CONFIG;

function genId(prefix){ return prefix + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }
function toMin(t){
  if(!t) return 0;
  var p = String(t).split(":");
  return Number(p[0]||0)*60 + Number(p[1]||0);
}

function listVenues(){ return Promise.resolve(cfg.venues); }

// 兼容：旧代码可能调用
function listTimeSlots(){ return Promise.resolve(cfg.timeSlots || []); }

function listBookings(params){
  params = params || {};
  var list = storage.getBookings();
  if(params.mineUserId){
    var out = [];
    for(var i=0;i<list.length;i++){
      if(list[i].userId === params.mineUserId) out.push(list[i]);
    }
    return Promise.resolve(out);
  }
  return Promise.resolve(list);
}

function getBooking(id){
  var list = storage.getBookings();
  for(var i=0;i<list.length;i++){ if(list[i].id===id) return Promise.resolve(list[i]); }
  return Promise.resolve(null);
}

function createBooking(payload){
  return new Promise(function(resolve, reject){
    var list = storage.getBookings();

    // 每用户最多1单（未取消）
    for(var i=0;i<list.length;i++){
      var b = list[i];
      if(b.userId === payload.userId && b.status !== "cancelled"){
        var e1 = new Error("你已有一个预约，最多只能约 1 单。请先取消或改期。"); e1.code="LIMIT_ONE";
        reject(e1); return;
      }
    }

    // 冲突校验：同场地同日时间段重叠不可预约（未取消）
    var s = toMin(payload.startTime);
    var e = toMin(payload.endTime);
    for(var j=0;j<list.length;j++){
      var c = list[j];
      if(c.status==="cancelled") continue;
      if(c.venueId===payload.venueId && c.date===payload.date){
        var cs = toMin(c.startTime);
        var ce = toMin(c.endTime);
        if(s < ce && e > cs){
          var e2 = new Error("该时间段已被预约"); e2.code="CONFLICT";
          reject(e2); return;
        }
      }
    }

    // venue info
    var venue=null;
    for(var k=0;k<cfg.venues.length;k++){
      if(cfg.venues[k].id===payload.venueId){ venue=cfg.venues[k]; break; }
    }

    var now = Date.now();
    var booking = {
      id: genId("bk"),
      userId: payload.userId,
      venueId: payload.venueId,
      venueName: venue ? venue.name : "",
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      timeLabel: payload.timeLabel || (payload.startTime + " - " + payload.endTime),
      form: payload.form || {},
      status: "pending", // 默认待确认
      createdAt: now,
      updatedAt: now
    };

    list.unshift(booking);
    storage.setBookings(list);
    resolve(booking);
  });
}

function updateBooking(id, payload){
  return new Promise(function(resolve, reject){
    var list = storage.getBookings();
    var idx=-1;
    for(var i=0;i<list.length;i++){ if(list[i].id===id){ idx=i; break; } }
    if(idx<0){ reject(new Error("未找到预约")); return; }

    var target = list[idx];

    // 改期也要做冲突校验（排除自己）
    var s = toMin(payload.startTime);
    var e = toMin(payload.endTime);
    for(var j=0;j<list.length;j++){
      var c = list[j];
      if(c.id===id) continue;
      if(c.status==="cancelled") continue;
      if(c.venueId===payload.venueId && c.date===payload.date){
        var cs = toMin(c.startTime);
        var ce = toMin(c.endTime);
        if(s < ce && e > cs){
          var e2 = new Error("该时间段已被预约"); e2.code="CONFLICT";
          reject(e2); return;
        }
      }
    }

    var venue=null;
    for(var k=0;k<cfg.venues.length;k++){
      if(cfg.venues[k].id===payload.venueId){ venue=cfg.venues[k]; break; }
    }

    target.venueId = payload.venueId;
    target.venueName = venue ? venue.name : target.venueName;
    target.date = payload.date;
    target.startTime = payload.startTime;
    target.endTime = payload.endTime;
    target.timeLabel = payload.timeLabel || (payload.startTime + " - " + payload.endTime);
    target.form = payload.form || target.form;
    target.updatedAt = Date.now();

    list[idx]=target;
    storage.setBookings(list);
    resolve(target);
  });
}

function cancelBooking(id){
  var list = storage.getBookings();
  for(var i=0;i<list.length;i++){
    if(list[i].id===id){
      list[i].status="cancelled";
      list[i].updatedAt=Date.now();
      storage.setBookings(list);
      return Promise.resolve(list[i]);
    }
  }
  return Promise.reject(new Error("未找到预约"));
}

function setBookingStatus(id, status){
  var list = storage.getBookings();
  for(var i=0;i<list.length;i++){
    if(list[i].id===id){
      list[i].status=status;
      list[i].updatedAt=Date.now();
      storage.setBookings(list);
      return Promise.resolve(list[i]);
    }
  }
  return Promise.reject(new Error("未找到预约"));
}

module.exports = {
  listVenues:listVenues,
  listTimeSlots:listTimeSlots,
  listBookings:listBookings,
  getBooking:getBooking,
  createBooking:createBooking,
  updateBooking:updateBooking,
  cancelBooking:cancelBooking,
  setBookingStatus:setBookingStatus
};
