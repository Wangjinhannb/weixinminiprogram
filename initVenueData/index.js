const svc = require('_shared/bookingService')
const { cloud, seedLegacyVenuesIfEmpty, translateCollectionError, success, fail } = svc

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  try {
    const res = await seedLegacyVenuesIfEmpty(wxContext.OPENID)
    return success(res, res.skipped ? 'venues 集合已有数据，未重复初始化' : '默认场室已初始化')
  } catch (err) {
    console.error('initVenueData error', err)
    err = translateCollectionError(err, 'venues')
    return fail(err.code || 500, err.message || '初始化场室数据失败')
  }
}
