import os
import sys

# Make the modules in python/ (echo_canceller, echo_cancel_cli, ...) importable
# from python/tests without installing them as a package.
PYTHON_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PYTHON_DIR not in sys.path:
    sys.path.insert(0, PYTHON_DIR)


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: long synthetic signals (minutes of audio)")
