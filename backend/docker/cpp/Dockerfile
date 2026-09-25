# Sandboxed GCC/G++ execution environment for C++.
FROM gcc:13-bookworm

RUN useradd -m -u 1000 -s /usr/sbin/nologin coderunner

USER coderunner
WORKDIR /box

CMD ["g++", "--version"]
