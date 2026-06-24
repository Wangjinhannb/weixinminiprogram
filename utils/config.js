var ENV = "mock"; // mock / prod
var CONFIG = {
  env: ENV,
  baseURL: "https://example.com/api",
  legacyVenues: [
    { id:"v_meeting", name:"多功能会议室", capacity:160, features:["WiFi","麦克风","两个屏幕","四台音响"] },
    { id:"v_e_reading", name:"电子阅览室", capacity:11, features:["11台电脑"] },
    { id:"v_reading", name:"综合阅览室", capacity:30, features:["书籍","书桌","椅子","沙发"] },
    { id:"v_dance", name:"综合活动室", capacity:30, features:["木地板","镜面墙","活动空间"] },
    { id:"v_kids", name:"儿童阅览室", capacity:10, features:["儿童书籍","两张桌子","八张椅子"] },
    { id:"v_scitech", name:"科教文卫室", capacity:30, features:["宣教活动","学习交流","多功能使用"] },
    { id:"v_qinqi_art", name:"琴祺书画室", capacity:20, features:["书画创作","艺术交流","安静环境"] }
  ]
};
module.exports = { ENV: ENV, CONFIG: CONFIG };
