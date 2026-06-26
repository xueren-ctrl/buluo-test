"""
WxPusher 推送服务
==================

通过 WxPusher API 给用户发送微信通知
文档: https://wxpusher.zjiecode.com/docs/

配置须知:
  1. 在 https://wxpusher.zjiecode.com/admin/ 创建应用获取 appToken
  2. 用户在 WxPusher 公众号中获取自己的 UID
  3. 将 appToken 填入 .env 的 WSPUSHER_APP_TOKEN
"""
import logging
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class WsPusherService:
    """WxPusher 推送客户端"""

    def __init__(self):
        self.api_url = settings.WSPUSHER_API_URL
        self.app_token = settings.WSPUSHER_APP_TOKEN

    def send(self, uid: str, message: str) -> bool:
        """
        发送推送通知

        Args:
            uid: 用户的 WxPusher UID (如 "UID_xxxxxxxx")
            message: 通知内容 (纯文本)

        Returns:
            True 成功, False 失败
        """
        if not uid:
            logger.warning("WxPusher UID 为空, 跳过发送")
            return False

        if not self.app_token:
            logger.warning("WxPusher APP_TOKEN 未配置, 跳过发送")
            return False

        payload = {
            "appToken": self.app_token,
            "content": message,
            "summary": "部落冲突升级提醒",
            "contentType": 1,  # 1=纯文本, 2=HTML, 3=Markdown
            "uids": [uid],
        }

        headers = {
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                )

                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("code") == 1000 and body.get("success"):
                        logger.info(f"推送成功 -> uid={uid}")
                        return True
                    else:
                        logger.error(f"推送失败: {body}")
                        return False
                else:
                    logger.error(
                        f"推送失败 status={resp.status_code} body={resp.text}"
                    )
                    return False

        except httpx.TimeoutException:
            logger.error(f"推送超时 -> uid={uid}")
            return False
        except Exception as e:
            logger.error(f"推送异常 -> uid={uid} error={e}")
            return False
