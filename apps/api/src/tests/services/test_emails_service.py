"""Tests for src/services/users/emails.py."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.db.organizations import OrganizationRead
from src.db.users import UserRead
from src.services.users.emails import (
    send_account_creation_email,
    send_account_deleted_email,
    send_email_verification_email,
    send_invitation_email,
    send_org_created_email,
    send_org_deleted_email,
    send_org_join_email,
    send_password_reset_email,
    send_password_reset_email_platform,
    send_role_changed_email,
)


def _user(**overrides):
    data = dict(
        id=1,
        username="user<script>",
        first_name="User",
        last_name="Test",
        email="user@test.com",
        user_uuid="user_uuid",
        email_verified=True,
        avatar_image="",
        bio="",
    )
    data.update(overrides)
    return UserRead(**data)


def _org(**overrides):
    data = dict(
        id=1,
        name="Org & Co",
        slug="org",
        email="org@test.com",
        org_uuid="org_uuid",
        creation_date="2024-01-01",
        update_date="2024-01-01",
    )
    data.update(overrides)
    return OrganizationRead(**data)


class TestEmailsService:
    def test_lifecycle_confirmation_emails(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            assert send_org_created_email("a@test.com", "Org & Co", "https://learnhouse.io/home") is True
            created = send_email.call_args
            assert "Org &amp; Co" in created.kwargs["body"]  # name html-escaped
            assert "https://learnhouse.io/home" in created.kwargs["body"]  # CTA link
            assert "Org &amp; Co" in created.kwargs["subject"]

            assert send_org_deleted_email("a@test.com", "Org & Co") is True
            assert "deleted" in send_email.call_args.kwargs["subject"].lower()

            assert send_account_deleted_email("a@test.com", "user<script>") is True
            assert "deleted" in send_email.call_args.kwargs["subject"].lower()

    def test_send_account_creation_email_escapes_username(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            result = send_account_creation_email(_user(), "user@test.com")

        assert result is True
        body = send_email.call_args.kwargs["body"]
        assert "user&lt;script&gt;" in body
        # No cta_url could be resolved, so the button is omitted entirely rather
        # than pointed at an arbitrary destination. With the Academy footer gone
        # too, this email should contain no links at all.
        assert "Get Started" not in body
        assert "<a href" not in body

    def test_orgless_welcome_uses_cta_url_and_platform_branding(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_account_creation_email(
                _user(), "user@test.com", cta_url="https://platform.test/organizations"
            )
        call = send_email.call_args.kwargs
        assert "https://platform.test/organizations" in call["body"]
        # Org-less keeps the platform-branded subject, no org logo.
        assert "Welcome to LearnOrbit" in call["subject"]
        # The Academy footer link is gone: it pointed at a LearnHouse property and
        # has no LearnOrbit equivalent. Guard both the label and the old host, so
        # neither the dead link nor the LearnHouse URL can come back.
        assert "Academy" not in call["body"]
        assert "learnhouse" not in call["body"].lower()
        assert "<img" not in call["body"]

    def test_welcome_is_whitelabeled_when_org_supplied(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_account_creation_email(
                _user(),
                "user@test.com",
                cta_url="https://acme.test/home",
                org_name="Acme & Co",
                logo_url="https://api.test/content/orgs/org_uuid/logos/logo.png",
            )
        call = send_email.call_args.kwargs
        # Subject/body name the org (html-escaped), not the platform.
        assert "Acme &amp; Co" in call["subject"]
        assert "Welcome to LearnOrbit" not in call["subject"]
        assert "Acme &amp; Co" in call["body"]
        # Org logo replaces the mark; Academy link is gone; powered-by remains.
        assert '<img src="https://api.test/content/orgs/org_uuid/logos/logo.png"' in call["body"]
        assert "LearnOrbit Academy" not in call["body"]
        assert "Powered by LearnOrbit" in call["body"]
        assert "https://acme.test/home" in call["body"]

    def test_whitelabel_without_logo_falls_back_to_learnorbit_wordmark(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_account_creation_email(
                _user(), "user@test.com", org_name="Acme", logo_url=None
            )
        call = send_email.call_args.kwargs
        # No org logo → LearnOrbit text wordmark, but the copy stays white-labeled.
        assert "<img" not in call["body"]
        # The mark is HTML text, never markup: the old LearnHouse lockup was an
        # inline <svg> that Gmail and Outlook strip, so this asserts both that the
        # LearnHouse artwork is gone and that we have not reintroduced a form of
        # logo most recipients cannot see.
        assert "<svg" not in call["body"]
        assert ">LearnOrbit</span>" in call["body"]
        assert "Acme" in call["subject"]
        # Sourced from translations.py, so it exercises the copy as well as the mark.
        assert "Powered by LearnOrbit" in call["body"]

    def test_role_changed_email_links_back_to_the_org(self):
        """Telling someone their permissions changed is useless without a way
        to go use them."""
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_role_changed_email(
                email="user@test.com",
                username="learner",
                org_name="Acme & Co",
                new_role_name="Admin",
                cta_url="https://learn.acme.test",
            )
        body = send_email.call_args.kwargs["body"]
        assert 'href="https://learn.acme.test"' in body
        assert "Acme &amp; Co" in body

    def test_role_changed_email_without_a_link_renders_no_button(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_role_changed_email(
                email="user@test.com",
                username="learner",
                org_name="Acme",
                new_role_name="Admin",
            )
        assert "<a href" not in send_email.call_args.kwargs["body"]

    def test_org_join_email_is_whitelabeled_and_links_to_the_org(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            assert send_org_join_email(
                email="user@test.com",
                username="user<script>",
                org_name="Acme & Co",
                cta_url="https://acme.test/home",
                logo_url="https://api.test/content/orgs/org_uuid/logos/logo.png",
            ) is True
        call = send_email.call_args.kwargs
        # Named after the org, with the org's own logo, not the LearnHouse mark.
        assert "Acme &amp; Co" in call["subject"]
        assert '<img src="https://api.test/content/orgs/org_uuid/logos/logo.png"' in call["body"]
        # The whole point of the email: a working way back into the org.
        assert "https://acme.test/home" in call["body"]
        # Hostile username/org names are escaped, never rendered as markup.
        assert "<script>" not in call["body"]

    def test_org_join_email_falls_back_to_learnorbit_wordmark_without_logo(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_org_join_email(
                email="user@test.com",
                username="learner",
                org_name="Acme",
                cta_url="https://acme.test/home",
            )
        call = send_email.call_args.kwargs
        assert "<img" not in call["body"]
        # Text wordmark, not the old inline <svg> LearnHouse lockup.
        assert "<svg" not in call["body"]
        assert ">LearnOrbit</span>" in call["body"]

    def test_org_join_email_translates(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_org_join_email(
                email="user@test.com",
                username="learner",
                org_name="Acme",
                cta_url="https://acme.test/home",
                lang="fr",
            )
        call = send_email.call_args.kwargs
        assert "Bienvenue" in call["subject"]

    def test_send_password_reset_email_variants_encode_params(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_password_reset_email(
                "code 123",
                _user(),
                _org(),
                "user+tag@test.com",
                "https://app.test",
            )
            send_password_reset_email_platform(
                "code 123",
                _user(),
                "user+tag@test.com",
                "https://app.test",
            )

        first_body = send_email.call_args_list[0].kwargs["body"]
        second_body = send_email.call_args_list[1].kwargs["body"]
        # Both variants now point at the real .io route `/reset` (the platform
        # variant previously used `/reset-password`, which 404s on .io).
        assert "/reset?email=user%2Btag%40test.com&amp;resetCode=code%20123" in first_body
        assert "/reset?email=user%2Btag%40test.com&amp;resetCode=code%20123" in second_body

    def test_send_invitation_role_change_and_verification_email(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org & Co",
                "owner<script>",
                "https://app.test/signup",
                invite_code="INV-123",
            )
            send_role_changed_email(
                "invitee@test.com",
                "member<script>",
                "Org & Co",
                "Admin",
            )
            send_email_verification_email(
                "token 123",
                _user(),
                _org(),
                "invitee@test.com",
                "https://app.test",
            )

        invite_body = send_email.call_args_list[0].kwargs["body"]
        role_body = send_email.call_args_list[1].kwargs["body"]
        verification_body = send_email.call_args_list[2].kwargs["body"]
        assert "INV-123" in invite_body
        assert "@owner&lt;script&gt;" in invite_body
        assert "member&lt;script&gt;" in role_body
        assert "verify-email?token=token%20123&amp;user=user_uuid&amp;org=org_uuid" in verification_body

    def test_send_invitation_email_without_invite_code(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Test Org",
                "inviter",
                "https://app.test/signup",
            )
        invite_body = send_email.call_args.kwargs["body"]
        assert "Click the button below" in invite_body

    def test_send_emails_in_french_when_lang_is_fr(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org & Co",
                "owner",
                "https://app.test/signup",
                invite_code="INV-123",
                lang="fr",
            )
            send_password_reset_email(
                "abcd1234",
                _user(),
                _org(),
                "user@test.com",
                "https://app.test",
                lang="fr",
            )
            send_role_changed_email(
                "user@test.com",
                "member",
                "Org & Co",
                "Admin",
                lang="fr",
            )

        invite_call = send_email.call_args_list[0].kwargs
        reset_call = send_email.call_args_list[1].kwargs
        role_call = send_email.call_args_list[2].kwargs

        assert "Vous êtes invité" in invite_call["body"]
        assert "Vous êtes invité à rejoindre Org &amp; Co" == invite_call["subject"]
        assert "Réinitialisez votre mot de passe" in reset_call["body"]
        assert "Réinitialisez votre mot de passe" == reset_call["subject"]
        assert "Votre rôle a été mis à jour" in role_call["body"]

    def test_send_emails_falls_back_to_english_for_unknown_lang(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org",
                "owner",
                "https://app.test/signup",
                lang="xx",
            )
        body = send_email.call_args.kwargs["body"]
        assert "You've been invited" in body


class TestNotificationEmailResilience:
    """Lifecycle mail must never take the request down with it."""

    def test_notification_email_failure_does_not_propagate(self):
        from fastapi import HTTPException

        with patch(
            "src.services.users.emails.send_email",
            side_effect=HTTPException(status_code=503, detail="Email service temporarily unavailable"),
        ):
            # A signup whose welcome email fails still returns — the account is
            # already created, so a dead mail provider must not 5xx the caller.
            assert send_account_creation_email(_user(), "user@test.com") is False

    def test_password_reset_email_still_raises(self):
        from fastapi import HTTPException

        from src.services.users.emails import send_password_reset_email

        with patch(
            "src.services.users.emails.send_email",
            side_effect=HTTPException(status_code=503, detail="down"),
        ):
            with pytest.raises(HTTPException):
                send_password_reset_email(
                    "code 123",
                    _user(),
                    _org(),
                    "user@test.com",
                    "https://app.test",
                )


class TestResendTransientRetry:
    def test_timeout_is_retried_once_then_succeeds(self, monkeypatch):
        from src.services.email import utils as email_utils

        monkeypatch.setattr(email_utils.time, "sleep", lambda _s: None)
        calls = []

        def flaky(payload):
            calls.append(payload)
            if len(calls) == 1:
                raise RuntimeError("Read timed out. (read timeout=30)")
            return {"id": "sent"}

        monkeypatch.setattr(email_utils.resend.Emails, "send", staticmethod(flaky))

        result = email_utils._send_email_resend(
            "LearnHouse <no-reply@test>", "user@test.com", "hi", "<p>hi</p>",
            SimpleNamespace(resend_api_key="key"),
        )

        assert result == {"id": "sent"}
        assert len(calls) == 2

    def test_quota_error_is_not_retried(self, monkeypatch):
        from fastapi import HTTPException

        from src.services.email import utils as email_utils

        monkeypatch.setattr(email_utils.time, "sleep", lambda _s: None)
        calls = []

        def over_quota(payload):
            calls.append(payload)
            raise RuntimeError("You have reached your daily email sending quota.")

        monkeypatch.setattr(email_utils.resend.Emails, "send", staticmethod(over_quota))

        with pytest.raises(HTTPException) as exc_info:
            email_utils._send_email_resend(
                "LearnHouse <no-reply@test>", "user@test.com", "hi", "<p>hi</p>",
                SimpleNamespace(resend_api_key="key"),
            )

        assert exc_info.value.status_code == 503
        assert len(calls) == 1  # a quota error will not clear on retry
