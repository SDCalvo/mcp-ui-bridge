# Publishing mcp-ui-bridge Python Package to PyPI

This guide walks you through publishing the Python version of mcp-ui-bridge to PyPI.

## Prerequisites

1. **Create PyPI accounts:**

   - [PyPI](https://pypi.org/account/register/) (for production releases)
   - [TestPyPI](https://test.pypi.org/account/register/) (for testing - recommended first)

2. **Install required tools:**
   ```bash
   pip install --upgrade pip build twine
   ```

## Step 1: Prepare the Package

1. **Update version in pyproject.toml** if needed
2. **Update the GitHub URLs** in `pyproject.toml` to match your actual repository
3. **Update author email** in `pyproject.toml` with your real email

## Step 2: Build the Package

Navigate to the `mcp-ui-bridge-python` directory and build:

```bash
cd mcp-ui-bridge-python

# Clean any previous builds
rm -rf build/ dist/ *.egg-info/

# Build the package
python -m build
```

This creates two files in the `dist/` directory:

- `mcp_ui_bridge-0.1.0.tar.gz` (source distribution)
- `mcp_ui_bridge-0.1.0-py3-none-any.whl` (wheel distribution)

## Step 3: Test Upload (Recommended)

**First test on TestPyPI:**

```bash
# Upload to TestPyPI first
python -m twine upload --repository testpypi dist/*
```

You'll be prompted for:

- Username: Your TestPyPI username
- Password: Your TestPyPI password (or API token)

**Test the installation:**

```bash
# Install from TestPyPI to verify it works
pip install --index-url https://test.pypi.org/simple/ mcp-ui-bridge
```

## Step 4: Production Upload

**Upload to production PyPI:**

```bash
python -m twine upload dist/*
```

You'll be prompted for:

- Username: Your PyPI username
- Password: Your PyPI password (or API token)

## Step 5: Verify Installation

```bash
# Install from PyPI
pip install mcp-ui-bridge

# Test import
python -c "from mcp_ui_bridge_python import run_mcp_server; print('✅ Package imported successfully!')"
```

## API Tokens (Recommended)

For security, use API tokens instead of passwords:

1. **PyPI API Token:**

   - Go to [PyPI Account Settings](https://pypi.org/manage/account/)
   - Create a new API token
   - Use `__token__` as username and the token as password

2. **TestPyPI API Token:**
   - Go to [TestPyPI Account Settings](https://test.pypi.org/manage/account/)
   - Create a new API token
   - Use `__token__` as username and the token as password

## Automated Publishing (Optional)

You can also configure automated publishing via GitHub Actions. Create `.github/workflows/publish.yml`:

```yaml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.x"
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install build twine
      - name: Build package
        run: python -m build
        working-directory: ./mcp-ui-bridge-python
      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          user: __token__
          password: ${{ secrets.PYPI_API_TOKEN }}
          packages_dir: mcp-ui-bridge-python/dist/
```

## Common Issues

1. **Package name already taken:** Change the name in `pyproject.toml`
2. **Build failures:** Check dependencies and Python version compatibility
3. **Upload failures:** Verify credentials and package format

## Next Steps After Publishing

1. **Update documentation** with installation instructions
2. **Add badges** to README for PyPI version and downloads
3. **Create GitHub releases** to tag versions
4. **Set up CI/CD** for automated testing and publishing

## Package Name Considerations

The package is currently named `mcp-ui-bridge` which matches the TypeScript version. If this name is taken on PyPI, consider alternatives:

- `mcp-ui-bridge-py`
- `mcpuibridge`
- `mcp-web-bridge`

You can check name availability at: https://pypi.org/project/[package-name]/
