# Sandboxed OpenJDK execution environment for Java.
FROM eclipse-temurin:17-jdk-jammy

RUN useradd -m -u 1000 -s /usr/sbin/nologin coderunner

USER coderunner
WORKDIR /box

CMD ["java", "--version"]
