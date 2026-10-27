# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['E:\\Python\\CreateUDS\\NewCode\\Excel2Case(New).py'],
    pathex=[],
    binaries=[],
    datas=[('E:\\\\Python\\\\CreateUDS\\\\NewCode\\\\Logo.ico', '.'), ('E:\\\\Python\\\\CreateUDS\\\\NewCode\\\\Testmodule_UDS.zip', '.'), ('E:\\\\Python\\\\CreateUDS\\\\NewCode\\\\#BT自动化测试工具#V1.0.17.zip', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='#Excel2Case#V1.0.00',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['Logo.ico'],
)
