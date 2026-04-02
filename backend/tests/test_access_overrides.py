import unittest
from unittest.mock import patch

from app.models.user import User
from app.services.access_overrides import email_is_allowlisted


class AccessOverrideAllowlistTests(unittest.TestCase):
    @patch("app.services.access_overrides.settings.complimentary_access_allowlist_emails", "a@example.com, b@example.com\nc@example.com")
    def test_email_is_allowlisted(self) -> None:
        self.assertTrue(email_is_allowlisted("a@example.com"))
        self.assertTrue(email_is_allowlisted("B@example.com"))
        self.assertTrue(email_is_allowlisted("c@example.com"))
        self.assertFalse(email_is_allowlisted("missing@example.com"))

    @patch("app.services.access_overrides.settings.complimentary_access_allowlist_emails", "tester@example.com")
    def test_email_is_allowlisted_rejects_empty(self) -> None:
        self.assertFalse(email_is_allowlisted(""))
        self.assertFalse(email_is_allowlisted(None))


if __name__ == "__main__":
    unittest.main()
