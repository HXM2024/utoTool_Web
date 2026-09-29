"""
AutoTool 后端核心模块包。

将 AutoTool.py 中的业务逻辑分离为独立的后端模块，
移除 PyQt5 依赖，提供干净的后端代码结构。

子模块:
    - core:       核心业务模块 (UDS, Boot, Function, CAN)
    - processors: Excel处理器 (FunctionProcessor, BTExcelProcessor)
    - services:   配置服务 (ConfigService)
    - utils:      公共工具函数
"""

from backend.services.config_service import ConfigService
from backend.core.base_module import BaseModule
from backend.core.uds_module import UDSModule
from backend.core.boot_module import BootModule
from backend.core.function_module import FunctionModule
from backend.core.can_module import CANModule
from backend.processors.function_processor import FunctionProcessor
from backend.processors.boot_processor import BTExcelProcessor
from backend.utils.helpers import isnotna, return_str

__all__ = [
    "ConfigService",
    "BaseModule",
    "UDSModule",
    "BootModule",
    "FunctionModule",
    "CANModule",
    "FunctionProcessor",
    "BTExcelProcessor",
    "isnotna",
    "return_str",
]
