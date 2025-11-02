# Release Guide

This document describes how to create a new release for KubeMCP.

## Automated Release Process

Releases are automated via GitHub Actions. When you push a version tag, the workflow automatically:

1. Runs tests
2. Builds the project
3. Creates a GitHub Release
4. Attaches build artifacts
5. Extracts and includes changelog notes

## Creating a New Release

### 1. Update Version and Changelog

First, update the `CHANGELOG.md` with new features, changes, and fixes:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Security
- Security fixes
```

### 2. Update Package Version

Update the version in `package.json`:

```bash
# For patch release (1.1.0 -> 1.1.1)
pnpm version patch

# For minor release (1.1.0 -> 1.2.0)
pnpm version minor

# For major release (1.1.0 -> 2.0.0)
pnpm version major
```

Or manually edit `package.json` and commit.

### 3. Commit Changes

```bash
git add CHANGELOG.md package.json pnpm-lock.yaml
git commit -m "chore: bump version to vX.Y.Z"
```

### 4. Create and Push Tag

```bash
# Create a tag (must start with 'v')
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push the tag to trigger the release workflow
git push origin vX.Y.Z
```

### 5. Monitor Release

Go to GitHub Actions to monitor the release workflow:
- https://github.com/icy-r/kubemcp/actions

Once complete, the release will be available at:
- https://github.com/icy-r/kubemcp/releases

## Release Workflow Details

The automated workflow (`.github/workflows/release.yml`) performs:

1. **Checkout**: Fetches the repository with full history
2. **Setup**: Installs Node.js 18 and pnpm
3. **Test**: Runs the test suite
4. **Build**: Compiles TypeScript to JavaScript
5. **Package**: Creates a `.tar.gz` archive with:
   - Compiled `dist/` directory
   - `package.json` and `pnpm-lock.yaml`
   - Documentation (README, CHANGELOG, LICENSE)
6. **Extract Changelog**: Pulls release notes from CHANGELOG.md
7. **Create Release**: Creates GitHub release with:
   - Version tag
   - Changelog notes
   - Build artifacts

## Manual Release (if needed)

If the automated workflow fails, you can create a manual release:

### 1. Build the Project

```bash
pnpm install
pnpm run build
pnpm test
```

### 2. Create Archive

```bash
tar -czf kubemcp-vX.Y.Z.tar.gz \
  dist/ \
  package.json \
  pnpm-lock.yaml \
  README.md \
  LICENSE \
  CHANGELOG.md
```

### 3. Create GitHub Release

1. Go to https://github.com/icy-r/kubemcp/releases/new
2. Choose the tag
3. Fill in release notes from CHANGELOG.md
4. Upload the `.tar.gz` file
5. Click "Publish release"

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (1.X.0): New features, backward compatible
- **PATCH** (1.1.X): Bug fixes, backward compatible

## Pre-release Versions

For beta/alpha releases:

```bash
# Create pre-release tag
git tag -a v1.2.0-beta.1 -m "Beta release v1.2.0-beta.1"
git push origin v1.2.0-beta.1
```

The workflow will create a release marked as "pre-release".

## Troubleshooting

### Workflow Fails

Check GitHub Actions logs for errors. Common issues:

- Test failures: Fix tests before releasing
- Build errors: Ensure TypeScript compiles locally
- Permission errors: Check GitHub token permissions

### Wrong Tag Pushed

Delete the tag locally and remotely:

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Then delete the release on GitHub if it was created.

### Update Existing Release

You can edit releases on GitHub:
1. Go to the release page
2. Click "Edit release"
3. Update notes or files
4. Save changes

## Post-Release Checklist

After a successful release:

- [ ] Verify the release appears on GitHub
- [ ] Check that artifacts are downloadable
- [ ] Test the release artifact
- [ ] Update documentation if needed
- [ ] Announce the release (if applicable)
- [ ] Close related issues/PRs

## CI Workflow

The CI workflow (`.github/workflows/ci.yml`) runs on every push and PR:

- Tests on Node.js 18 and 20
- Linting and type checking
- Build verification
- Format checking

Make sure CI passes before creating a release.

