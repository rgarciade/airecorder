"""#174: the cleaned file keeps the mode of the original mic file (not mkstemp's 0600).

Reuses the helpers of test_echo_cancel_cli.py (same ffmpeg lookup and skip).
"""

import os
import stat

import pytest

from test_echo_cancel_cli import FFMPEG, echo_result, make_echo_recording, run_echo_cancel

pytestmark = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not available")


@pytest.mark.parametrize("mode", [0o644, 0o640])
def test_cleaned_output_has_the_same_mode_as_the_mic_file(tmp_path, mode):
    mic, ref = make_echo_recording(tmp_path)
    os.chmod(mic, mode)
    out = tmp_path / "rec-echo-tmp.webm"

    result = run_echo_cancel(mic, ref, out)

    assert result.returncode == 0, result.stderr
    assert echo_result(result.stdout)["applied"] is True
    assert stat.S_IMODE(os.stat(out).st_mode) == mode
