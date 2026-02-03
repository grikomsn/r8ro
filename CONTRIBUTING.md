# Contributing to r8ro

Thank you for your interest in contributing to r8ro! This document provides guidelines and processes for contributing to this open-source project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Use inclusive language
- Focus on constructive feedback
- Help others learn and grow
- Report harassment or inappropriate behavior

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm package manager
- Git
- Supabase account (for local development)

### Initial Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/r8ro.git
   cd r8ro
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Set Up Environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Database Setup**

   ```bash
   # If using local Supabase
   supabase start
   supabase db reset

   # Or connect to your Supabase project
   # See docs/operations.md for details
   ```

5. **Start Development**
   ```bash
   pnpm dev
   ```

### Development Tools

This project uses several tools for code quality:

- **Biome/Ultracite**: Formatting and linting
- **TypeScript**: Static type checking
- **Next.js**: Framework tooling

See `AGENTS.md` for detailed tooling instructions.

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Follow existing code patterns and conventions
- Use TypeScript properly with explicit types
- Write clean, readable code
- Add comments only when necessary

### 3. Run Validation

```bash
# Format and lint
pnpm fix

# Type checking
pnpm check-types

# Build test
pnpm build
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature description"
# or
git commit -m "fix: resolve bug description"
```

Use conventional commit format:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `refactor:` for code refactoring
- `test:` for test additions
- `chore:` for maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Pull Request Process

### PR Requirements

1. **Clear Description**: Explain what changes you made and why
2. **Testing**: Include how you tested your changes
3. **Screenshots**: For UI changes, include before/after screenshots
4. **Documentation**: Update relevant documentation if needed
5. **Checks Pass**: All CI/CD checks must pass

### PR Template

When creating a PR, include:

```markdown
## Description

Brief description of the change

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

How you tested the changes

## Screenshots (if applicable)

Before/after screenshots

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Documentation updated
- [ ] Build passes
- [ ] Types pass
```

### Review Process

1. **Automated Checks**: CI runs type checking, linting, and build
2. **Peer Review**: At least one maintainer review required
3. **Testing**: Manual testing by reviewer
4. **Approval**: Merge after approval and checks pass

## Code Style Guidelines

This project follows the style defined in [`AGENTS.md`](AGENTS.md). Key points:

### Formatting

- No semicolons, no trailing commas, prefer double quotes
- Use Biome/Ultracite formatter (`pnpm fix`)
- Import order: React/Next → external packages → `@/` aliases → relative paths

### Code Patterns

- Function components only, never declare components inside other components
- `async/await` exclusively, `try/catch` around Supabase mutations
- Prefer `const` over `let`, use arrow callbacks
- Shared types in `lib/types.ts`, explicit return types for exports

### Validation

Run these commands before submitting:

```bash
pnpm fix              # Format and lint
pnpm check-types      # TypeScript validation
pnpm build            # Production build check
```

## Testing

### Current Testing Approach

This project currently uses manual testing for validation:

1. **Type Checking**: `pnpm check-types`
2. **Build Validation**: `pnpm build`
3. **Manual QA**: Browser testing with multiple tabs for realtime features

### Testing Checklist

When adding features, test:

- [ ] Basic functionality works
- [ ] Error states are handled
- [ ] Loading states display correctly
- [ ] Realtime updates work across multiple tabs
- [ ] Mobile responsiveness
- [ ] Accessibility basics
- [ ] RLS policies enforce correctly

### Manual Testing Process

- Open two browser contexts to validate realtime flows
- Test presence, voting, locks, and timers
- Verify RLS policies are respected
- Check mobile responsiveness

## Documentation

### When to Update Documentation

Update documentation when:

- Adding new features
- Changing existing behavior
- Updating configuration
- Modifying data models
- Changing deployment procedures

### Documentation Files

- `README.md`: Project overview and quick start
- `docs/overview.md`: Product and architecture details
- `docs/features/*.md`: Feature-specific documentation
- `docs/operations.md`: Development setup and processes
- `docs/deployment.md`: Deployment guides
- `docs/data-model/supabase.md`: Database schema documentation

### Writing Style

- Use clear, concise language
- Include code examples
- Add diagrams when helpful (Mermaid format)
- Link to relevant source files
- Keep documentation up-to-date

## Bug Reports

### Reporting Bugs

Use the GitHub issue tracker with:

1. **Clear Title**: Brief description of the issue
2. **Environment**: OS, browser, version info
3. **Steps to Reproduce**: Detailed reproduction steps
4. **Expected Behavior**: What should happen
5. **Actual Behavior**: What actually happens
6. **Screenshots**: If applicable
7. **Additional Context**: Any other relevant information

### Bug Report Template

```markdown
**Bug Description**
Brief description of the bug

**Environment**

- OS:
- Browser:
- Version:

**Steps to Reproduce**

1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Screenshots**
If applicable, add screenshots

**Additional Context**
Any other relevant information
```

## Feature Requests

### Requesting Features

Use the GitHub issue tracker with:

1. **Clear Title**: Brief description of the feature
2. **Problem**: What problem does this solve?
3. **Proposed Solution**: How should it work?
4. **Alternatives**: What alternatives have you considered?
5. **Additional Context**: Any other relevant information

### Feature Request Template

```markdown
**Feature Description**
Brief description of the feature

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How should the feature work?

**Alternatives Considered**
What alternatives have you considered?

**Additional Context**
Any other relevant information
```

## Realtime Development

When working with Supabase Realtime:

- Follow `retro-${slug}` and `poker-${slug}` channel patterns
- Always unsubscribe and untrack on cleanup
- Prevent duplicate state entries when realtime inserts fire
- Maintain presence hygiene with `visibilitychange` + `beforeunload` listeners

## Security Considerations

- Never commit secrets or API keys
- Respect RLS policies in UI logic
- Use `createClient` from appropriate context (`client` vs `server`)
- Validate user inputs before database operations

## Getting Help

- **Documentation**: Check `docs/` folder first
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Maintainers**: Tag maintainers in issues for urgent matters

## Recognition

Contributors are recognized in:

- `CONTRIBUTORS.md` file
- Release notes for significant contributions
- Project README for major contributors

## License

By contributing, you agree your changes will be licensed under the MIT License.

Thank you for contributing to r8ro! 🎉
