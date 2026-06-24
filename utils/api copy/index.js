var ENV=require("../config").ENV;
var mock=require("./mock"); var prod=require("./prod");
module.exports = (ENV==="prod") ? prod : mock;
