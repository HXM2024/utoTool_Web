"""
数据模型包。

提供统一响应格式工具函数。
"""

from backend.models.schemas import success_response, error_response, ApiResponse

__all__ = ["success_response", "error_response", "ApiResponse"]
