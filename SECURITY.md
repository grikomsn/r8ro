# Security Policy

## Supported Versions

Only the latest version of r8ro receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not** open a public issue.

Use
[GitHub's private vulnerability reporting](https://github.com/grikomsn/r8ro/security/advisories/new).
If private reporting is unavailable, email <griko@nibras.co>.

Please include:

- A detailed description of the vulnerability
- Steps to reproduce the issue
- Any potential impact assessment

You can expect an acknowledgement within seven days. Please allow time to
investigate and coordinate a fix before public disclosure.

## Security Best Practices

r8ro is designed with security in mind:

- All database tables protected by Row Level Security (RLS)
- Anonymous-first authentication with optional GitHub binding
- Server credentials are read only from environment variables
- Automated Gitleaks checks reject newly committed credentials

For detailed security architecture, see the [Security section in README.md](README.md#security).
