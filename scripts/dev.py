"""Start both local servers; stop both when either exits or Ctrl+C is pressed."""
import subprocess
import sys
import time
import os
import signal
from pathlib import Path

root = Path(__file__).resolve().parent.parent
processes = []
exit_code = 0
try:
    processes.append(subprocess.Popen([sys.executable, "-m", "backend.app"], cwd=root, start_new_session=os.name != "nt"))
    processes.append(subprocess.Popen(["npm", "run", "dev"], cwd=root, start_new_session=os.name != "nt"))
    while all(process.poll() is None for process in processes):
        time.sleep(0.25)
    exit_code = next((process.returncode for process in processes if process.returncode), 0)
except KeyboardInterrupt:
    pass
finally:
    # Ignore a second Ctrl+C while the two server process groups are stopping.
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    for process in processes:
        if process.poll() is None:
            try:
                if os.name != "nt":
                    os.killpg(process.pid, signal.SIGTERM)
                else:
                    process.terminate()
            except ProcessLookupError:
                pass
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
sys.exit(exit_code)
