FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    pkg-config \
    texlive texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
    dvisvgm \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

RUN pip install manim==0.19.0

RUN useradd --create-home --uid 1000 renderer \
    && mkdir -p /task/src /task/out /work/media \
    && chown -R renderer:renderer /task /work

USER renderer
WORKDIR /work

COPY --chown=renderer:renderer entrypoint.py /app/entrypoint.py

ENTRYPOINT ["python", "/app/entrypoint.py"]
