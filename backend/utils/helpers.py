"""
公共工具函数模块。

从 AutoTool.py 中提取的通用数据处理函数，
不依赖任何 UI 框架。
"""

import re

import pandas as pd


def isnotna(row):
    """判断 pandas 值是否非 NaN，非 NaN 时返回原值，否则返回 0。

    对应 AutoTool.py 中的全局函数 _isnotna()。
    """
    return row if pd.notna(row) else 0


def return_str(Strtxt):
    """将字符串中的特殊字符替换为下划线，用于生成合法的变量名。

    对应 AutoTool.py 中的全局函数 _returnStr()。
    """
    Strtxt = re.sub(r'[^a-zA-Z0-9\s]', '_', str(Strtxt))
    Strtxt = re.sub(' ', '_', str(Strtxt))
    return Strtxt


def safe_int(value, default=0):
    """安全转换为 int，失败时返回默认值。"""
    try:
        if pd.isna(value):
            return default
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_float(value, default=0.0):
    """安全转换为 float，失败时返回默认值。"""
    try:
        if pd.isna(value):
            return default
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_str(value, default=''):
    """安全转换为 str，NaN 时返回默认值。"""
    try:
        if pd.isna(value):
            return default
        return str(value)
    except (ValueError, TypeError):
        return default
