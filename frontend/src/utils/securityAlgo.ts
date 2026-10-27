/**
 * 主机厂 → 默认安全算法 id。
 *
 * 仅在配置缺少 securityAlgo 的「加载兜底」场景使用（例如历史配置只有 oem），
 * 不在滚轮交互时做联动：用户在侧边栏仍可自由选择其它主机厂的算法。
 *
 * 必须与 backend/templates/capl.py 的 OEM_DEFAULT_ALGO 保持一致，
 * 由 tests/test_oem_default_algo.py 校验。
 */
export const OEM_DEFAULT_ALGO: Record<string, string> = {
  BYD: 'BYD_CBC',
  ChangAn: 'ChangAn_SeedKey',
  CheRy: 'Chery_CMAC',
  'GEEA_1.0': 'Geely10_SeedKey',
  'GEEA_3.0': 'Geely30_CBC',
  SGWM: 'SGMW_SeedKey',
  BaoTeng: 'BaoTeng_SeedKey',
  DongFeng: 'DongFeng_SeedKey',
  Seres: 'Seres_SeedKey',
  SRM: 'SRM_SeedKey',
  GAC: 'GAC_SeedKey',
  RC: 'RC_CMAC',
  CCAG: 'CCAG_CMAC',
}

/** 按主机厂取默认算法；未知主机厂返回空串，由调用方保持原值 */
export function defaultAlgoForOem(oem?: string): string {
  if (!oem) return ''
  return OEM_DEFAULT_ALGO[oem] || ''
}
