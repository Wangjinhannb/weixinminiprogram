var cfg = require("../config").CONFIG;

function request(method, path, data){
  return new Promise(function(resolve, reject){
    wx.request({
      url: cfg.baseURL + path,
      method: method,
      data: data || {},
      header: { "content-type":"application/json" },
      success: function(res){
        if(res.statusCode>=200 && res.statusCode<300){ resolve(res.data); }
        else{ reject(new Error("请求失败：" + res.statusCode)); }
      },
      fail: function(err){ reject(err); }
    });
  });
}

module.exports = {
  listVenues: function(){ return request("GET","/venues"); },
  listTimeSlots: function(){ return request("GET","/timeslots"); },
  listBookings: function(params){ return request("GET","/bookings", params); },
  listOccupied: function(venueId, date){ return request("GET","/occupied", { venueId:venueId, date:date }); },
  createBooking: function(payload){ return request("POST","/bookings", payload); },
  updateBooking: function(id, patch){ return request("PATCH","/bookings/"+id, patch); },
  cancelBooking: function(id){ return request("POST","/bookings/"+id+"/cancel"); },
  getBooking: function(id){ return request("GET","/bookings/"+id); }
};
