# Multi-platform official image pinned for repeatable dependency selection.
FROM python:3.13-slim@sha256:2d44738ebf4ce5f63b9d9ea871e9c7cfdc0426f7b0c97cac915fd88ded1d86bb AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

FROM base AS test
COPY analyze.py ./
COPY tests/ ./tests/
RUN python -m unittest discover -s tests -t . -v

FROM base AS runtime
COPY --from=test /app/analyze.py ./analyze.py
RUN mkdir /output && chown 10001:10001 /output
USER 10001:10001
ENTRYPOINT ["python", "/app/analyze.py"]
CMD ["/data/results.json", "--output-dir", "/output"]
