"""
统一响应模型。

所有 API 返回统一的 JSON 格式：
    成功: {"code": 200, "data": {...}, "message": "success"}
    错误: {"code": 400/404/500, "data": null, "message": "错误描述"}
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ApiResponse:
    """统一响应数据结构"""
    code: int = 200
    data: Any = None
    message: str = "success"

    def to_dict(self) -> dict:
        """转换为字典，供 jsonify 使用"""
        return {
            "code": self.code,
            "data": self.data,
            "message": self.message,
        }


def success_response(data: Any = None, message: str = "success") -> dict:
    """构建成功响应字典

    Args:
        data: 响应数据
        message: 响应消息

    Returns:
        {"code": 200, "data": ..., "message": ...}
    """
    return {"code": 200, "data": data, "message": message}


def error_response(message: str, code: int = 400, data: Any = None) -> dict:
    """构建错误响应字典

    Args:
        message: 错误描述
        code: HTTP 状态码（默认 400）
        data: 附加数据（通常为 None）

    Returns:
        {"code": code, "data": null, "message": ...}
    """
    return {"code": code, "data": data, "message": message}
