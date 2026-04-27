import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
APP_WEB_SERVER_PATH = REPO_ROOT / "app" / "web_server"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

if str(APP_WEB_SERVER_PATH) not in sys.path:
    sys.path.insert(0, str(APP_WEB_SERVER_PATH))
