# Sandboxed Python 3 execution environment.
# Runs as a non-root user; the backend mounts a per-job temp folder at
# /box and controls resource limits at `docker run` time.
FROM python:3.11-slim

RUN useradd -m -u 1000 -s /usr/sbin/nologin coderunner

USER coderunner
WORKDIR /box

# Default CMD is irrelevant — dockerExecutor.js always overrides the
# command with e.g. `python3 main.py`.
CMD ["python3", "--version"]
