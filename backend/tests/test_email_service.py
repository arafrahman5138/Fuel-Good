import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.services import email as email_service


class EmailServiceTests(unittest.IsolatedAsyncioTestCase):
    @patch("app.services.email.httpx.AsyncClient")
    async def test_send_transactional_email_uses_resend_payload(self, mock_client_cls):
        original_api_key = email_service.settings.resend_api_key
        original_from = email_service.settings.email_from
        original_reply_to = email_service.settings.email_reply_to
        email_service.settings.resend_api_key = "re_test_123"
        email_service.settings.email_from = "noreply@fuelgood.app"
        email_service.settings.email_reply_to = "support@fuelgood.app"

        try:
            mock_response = Mock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = {"id": "email_123"}

            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_cls.return_value.__aenter__.return_value = mock_client

            payload = await email_service.send_transactional_email(
                to_email="user@example.com",
                subject="Test Email",
                html_body="<p>Hello world</p>",
                tags=[{"name": "type", "value": "generic"}],
            )

            self.assertEqual(payload["id"], "email_123")
            mock_client.post.assert_awaited_once()
            _, kwargs = mock_client.post.await_args
            self.assertEqual(kwargs["json"]["from"], "noreply@fuelgood.app")
            self.assertEqual(kwargs["json"]["to"], ["user@example.com"])
            self.assertEqual(kwargs["json"]["subject"], "Test Email")
            self.assertEqual(kwargs["json"]["reply_to"], "support@fuelgood.app")
        finally:
            email_service.settings.resend_api_key = original_api_key
            email_service.settings.email_from = original_from
            email_service.settings.email_reply_to = original_reply_to


if __name__ == "__main__":
    unittest.main()
