# logging_config.py
import json
import logging
import os
import sys


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "time": self.formatTime(record, "%Y-%m-%d %H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # 业务字段：log.info("msg", extra={"user": "alice"})
        for key, value in record.__dict__.items():
            if key not in logging.LogRecord("", 0, "", 0, "", (), None).__dict__:
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


_configured = False


def setup_logging(env=None):
    """在应用入口调用一次。env 不传则读 APP_ENV，默认 dev。"""
    global _configured
    if _configured:
        return

    env = (env or os.getenv("APP_ENV", "dev")).lower()
    is_dev = env != "prod"

    root = logging.getLogger()
    root.setLevel(logging.DEBUG if is_dev else logging.INFO)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if is_dev:
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    else:
        handler.setFormatter(JsonFormatter())
    root.addHandler(handler)

    _configured = True


def get_logger(name=None):
    """项目里统一用它拿 logger。"""
    if not _configured:
        setup_logging()
    return logging.getLogger(name)