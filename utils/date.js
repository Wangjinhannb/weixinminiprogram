function pad(n){return n<10?"0"+n:""+n;}
function fmtDate(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function addDays(d,days){var t=new Date(d.getTime()); t.setDate(t.getDate()+days); return t;}
module.exports={fmtDate:fmtDate,addDays:addDays};
