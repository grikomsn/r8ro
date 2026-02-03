# Security Policy

## Supported Versions

Only the latest version of r8ro receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not** open a public issue.

Instead, send an email to: <griko@nibras.com>

Please include:

- A detailed description of the vulnerability
- Steps to reproduce the issue
- Any potential impact assessment

## Response

Security reports will be acknowledged within 48 hours, and you'll receive a response regarding the next steps within 7 days.

## Security Best Practices

r8ro is designed with security in mind:

- All database tables protected by Row Level Security (RLS)
- Anonymous-first authentication with optional GitHub binding
- No sensitive data stored in client-side code
- Environment variables for all configuration secrets

For detailed security architecture, see the [Security section in README.md](README.md#security).
