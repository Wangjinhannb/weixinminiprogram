# weixinminiprogram
# 微信小程序场地预约系统

一个基于微信小程序和微信云开发的场地预约管理系统，支持用户在线预约场室、查看预约记录、报名活动，以及管理员进行场室、预约、用户和活动管理。

## 项目简介

本项目主要面向场地预约场景，用户可以在小程序中查看可预约场室、选择日期和时间段提交预约，也可以查看和管理自己的预约记录。管理员可以在后台管理场室信息、预约状态、用户权限和活动通知。

## 功能模块

### 用户端

* 首页信息展示
* 活动列表查看
* 活动报名与取消报名
* 场室列表查看
* 场室预约申请
* 按日期和时间段选择预约时间
* 查看我的预约记录
* 查看预约详情
* 修改预约信息
* 取消预约
* 预约提醒订阅
* 用户登录与个人信息管理

### 管理端

* 管理员首页
* 场室管理
* 新增、编辑、删除场室
* 启用或停用场室
* 控制场室是否展示
* 查看全部预约记录
* 查看预约详情
* 更新预约状态
* 用户权限管理
* 设置用户管理员权限
* 活动通知管理
* 活动报名信息管理

## 技术栈

* 微信小程序原生开发
* WXML
* WXSS
* JavaScript
* 微信云开发
* 云函数
* 云数据库

## 项目结构

```text
.
├── miniprogram/
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── assets/
│   ├── components/
│   ├── custom-tab-bar/
│   ├── pages/
│   ├── utils/
│   └── cloudfunctions/
├── project.config.json
├── sitemap.json
├── README.md
└── .gitignore
```

## 主要页面

```text
pages/home                     首页
pages/activity                 活动页
pages/book                     场室预约
pages/schedule                 时间表
pages/my                       我的
pages/login                    登录
pages/settings                 设置
pages/booking_form             预约表单
pages/booking_detail           预约详情

pages/admin                    管理员首页
pages/admin_venues             场室管理
pages/admin_venue_form         场室编辑
pages/admin_users              用户管理
pages/admin_activities         活动管理
pages/admin_activity_form      活动编辑
pages/admin_booking_detail     管理员预约详情
```

## 主要组件

```text
components/activity_notice_modal       活动通知弹窗
components/booking_card                预约卡片
components/reminder_picker_modal       提醒时间选择弹窗
custom-tab-bar                         自定义底部导航栏
```

## 云函数

```text
createBooking                  创建预约
cancelBooking                  取消预约
updateBooking                  修改预约
updateBookingStatus            更新预约状态
getMyBookings                  获取我的预约
getBookingDetail               获取预约详情
getBookingSummary              获取预约统计
getAvailableVenues             获取可预约场室
getVenueDayBookings            获取场室某日预约情况

getAdminBookings               管理员获取预约列表
getAdminVenues                 管理员获取场室列表
saveVenue                      保存场室信息
deleteVenue                    删除场室
toggleVenueStatus              启用或停用场室
toggleVenueVisible             控制场室显示状态

syncUser                       同步用户信息
getAdminUsers                  获取用户列表
setUserAdminPermission         设置管理员权限

getActivityList                获取活动列表
getActivityNotice              获取活动通知
saveActivityNotice             保存活动通知
deleteActivityNotice           删除活动通知
submitActivityRegistration     提交活动报名
cancelActivityRegistration     取消活动报名
getMyActivityRegistrations     获取我的活动报名
getAdminActivityRegistrations  管理员获取活动报名信息

saveSubscription               保存订阅提醒
notifyBookingSubscribers       发送预约提醒
initVenueData                  初始化场室数据
```

## 数据集合

```text
users                          用户信息
venues                         场室信息
bookings                       预约记录
booking_subscriptions          预约提醒订阅
booking_notifications          预约通知记录
activity_registrations         活动报名记录
```

## 项目特点

* 支持用户端和管理员端两套功能
* 使用微信云函数处理核心业务逻辑
* 支持场室预约、修改、取消和状态管理
* 支持活动通知发布和活动报名
* 支持管理员权限控制
* 使用自定义底部导航栏提升页面体验
* 代码按页面、组件、工具函数和云函数进行模块化管理

## 运行方式

1. 使用微信开发者工具导入项目
2. 选择项目根目录
3. 配置微信云开发环境
4. 部署 `miniprogram/cloudfunctions/` 下的云函数
5. 创建所需云数据库集合
6. 编译运行小程序

## 项目说明

本项目用于场地预约业务场景，包含用户预约流程、管理员管理流程、活动报名流程和云函数后端逻辑。
