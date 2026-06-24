const svc = require('_shared/bookingService')
const { cloud, assertAdminUser, listAdminVenues, success, fail } = svc

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  try {
    await assertAdminUser(wxContext.OPENID)
    const data = await listAdminVenues()
    return success(data)
  } catch (err) {
    console.error('getAdminVenues error', err)
    return fail(err.code || 500, err.message || '查询场室列表失败')
  }
}
